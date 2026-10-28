/**
 * The render subcommand (spec 010). Reads a spec (validated) and a signal
 * track (per-frame reads; the sidecar parsed once), draws the requested frame
 * range with `drawSpec`, and writes frames to stdout (raw RGBA) or a PNG
 * folder. Reports on stderr as JSON lines. See cli/animspec.ts for the
 * contract. Offline; no network; the only files touched are the arguments
 * and the PNG assets a spec declares (spec 022), checked by sha256.
 */
import { parseArgs } from "node:util";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { drawSpec, validateAnimSpec, readSignalTrackHeader, readSignalFrame, indexSignalTrackSidecar, checkAssets, registerPlugin, registeredPlugins, VOCABULARY_VERSION, } from "../dist/index.js";
const EXIT_OK = 0;
const EXIT_USAGE = 2;
const EXIT_TRACK = 3;
const EXIT_RANGE = 4;
const EXIT_ASSET = 5;
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
/** One JSON line on stderr. */
const line = (obj) => {
    process.stderr.write(JSON.stringify(obj) + "\n");
};
const fail = (code, message) => {
    line({ error: message, exit: code });
    return code;
};
const usage = (message) => fail(EXIT_USAGE, `${message} — usage: animspec render <spec.json> --signal <track.asft> [--seed n] [--start n] [--end n] [--width n] [--height n] [--creative] [--assets <dir>] [--plugin <module>]... [--strict] (--raw | --png <dir>)`);
const intArg = (name, raw, fallback) => {
    const v = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(v))
        throw new Error(`${name} must be an integer`);
    return v;
};
export async function main(argv) {
    let args;
    try {
        args = parseArgs({
            args: argv,
            options: {
                signal: { type: "string" },
                seed: { type: "string", default: "0" },
                start: { type: "string", default: "0" },
                end: { type: "string" },
                width: { type: "string", default: "1920" },
                height: { type: "string", default: "1080" },
                raw: { type: "boolean" },
                png: { type: "string" },
                creative: { type: "boolean" },
                assets: { type: "string" },
                plugin: { type: "string", multiple: true },
                strict: { type: "boolean" },
            },
            allowPositionals: true,
        });
    }
    catch (e) {
        return usage(e.message);
    }
    const specFile = args.positionals[0];
    if (!specFile || args.positionals.length !== 1)
        return usage("expected exactly one spec file");
    if (!args.values.signal)
        return usage("--signal <track.asft> is required");
    const modes = [args.values.raw ? "raw" : "", args.values.png !== undefined ? "png" : ""].filter(Boolean);
    if (modes.length !== 1)
        return usage("exactly one of --raw or --png <dir> is required");
    const pngDir = args.values.png;
    let seed, start, width, height;
    try {
        seed = intArg("--seed", args.values.seed, 0);
        start = intArg("--start", args.values.start, 0);
        width = intArg("--width", args.values.width, 1920);
        height = intArg("--height", args.values.height, 1080);
        if (start < 0 || seed < 0)
            throw new Error("--seed and --start must be ≥ 0");
        if (width < 1 || height < 1)
            throw new Error("--width and --height must be ≥ 1");
    }
    catch (e) {
        return usage(e.message);
    }
    // Plugins (spec 024): each module's default export is registered before the
    // spec is validated, and its file digest is kept for the manifest.
    const pluginDigests = new Map();
    for (const file of args.values.plugin ?? []) {
        try {
            const resolved = path.resolve(file);
            const mod = await import(pathToFileURL(resolved).href);
            registerPlugin(mod.default);
            pluginDigests.set(mod.default.id, crypto.createHash("sha256").update(fs.readFileSync(resolved)).digest("hex"));
        }
        catch (e) {
            return fail(EXIT_USAGE, `plugin ${file}: ${e.message}`);
        }
    }
    // The spec is untrusted input: validate first, report what was dropped and
    // why, and render what remains (Principle IV); --strict refuses a spec with
    // any validation error instead (#154).
    let specText;
    try {
        specText = fs.readFileSync(specFile, "utf8");
    }
    catch (e) {
        return fail(EXIT_USAGE, `cannot read spec file: ${e.message}`);
    }
    let rawSpec;
    try {
        rawSpec = JSON.parse(specText);
    }
    catch {
        return fail(EXIT_USAGE, "spec file is not valid JSON");
    }
    const validated = validateAnimSpec(rawSpec);
    if (validated.dropped.length > 0)
        line({ dropped: validated.dropped });
    if (validated.errors.length > 0)
        line({ errors: validated.errors });
    if (args.values.strict && (validated.errors.length > 0 || validated.dropped.length > 0)) {
        return fail(EXIT_USAGE, "spec has validation errors (--strict)");
    }
    const spec = validated.spec;
    if (!spec)
        return fail(EXIT_USAGE, "spec validated to nothing");
    // Assets (spec 022): `<id>.png` from --assets or the spec's folder, each
    // checked against its declared sha256 before anything renders.
    const assetDir = args.values.assets ?? path.dirname(specFile);
    const assetIds = Object.keys(spec.assets ?? {}).sort();
    const assetBytes = {};
    for (const id of assetIds) {
        const file = path.join(assetDir, `${id}.png`);
        if (!fs.existsSync(file))
            return fail(EXIT_ASSET, `asset ${id}: missing ${file}`);
        assetBytes[id] = fs.readFileSync(file);
    }
    // Every file exists at this point, so a problem is a digest mismatch.
    const check = checkAssets(spec, assetBytes);
    if (!check.ok)
        return fail(EXIT_ASSET, `asset ${check.problems[0].replace(/ sha256 mismatch$/, "")}: sha256 mismatch`);
    const assets = {};
    for (const id of assetIds) {
        try {
            assets[id] = await loadImage(Buffer.from(assetBytes[id]));
        }
        catch (e) {
            return fail(EXIT_ASSET, `asset ${id}: not a decodable PNG (${e.message})`);
        }
    }
    const creative = args.values.creative === true;
    // The signal track: header once, sidecar once, frames per-frame — a chunk
    // render never decodes the whole file (spec 011's reader at work).
    let bytes;
    let header;
    let sidecar;
    try {
        bytes = fs.readFileSync(args.values.signal);
        header = readSignalTrackHeader(bytes);
        const sidecarPath = `${args.values.signal}.ndjson`;
        const sidecarText = fs.existsSync(sidecarPath) ? fs.readFileSync(sidecarPath, "utf8") : null;
        sidecar = indexSignalTrackSidecar(sidecarText, header.frameCount);
    }
    catch (e) {
        return fail(EXIT_TRACK, `signal track: ${e.message}`);
    }
    const end = args.values.end === undefined ? header.frameCount : intArg("--end", args.values.end, header.frameCount);
    if (!(Number.isSafeInteger(start) && Number.isSafeInteger(end)) || start > end || end > header.frameCount) {
        return fail(EXIT_RANGE, `range [${start}, ${end}) outside the track (${header.frameCount} frames)`);
    }
    const usedIds = new Set(spec.layers.map((l) => /^ext:([^/]+)\//.exec(l.type)?.[1]).filter((x) => !!x));
    const usedPlugins = registeredPlugins().filter((p) => usedIds.has(p.id)).map((p) => ({ id: p.id, version: p.version, licence: p.licence, ...(pluginDigests.has(p.id) ? { sha256: pluginDigests.get(p.id) } : {}) }));
    const dims = { width, height };
    // One canvas for the whole range: drawSpec repaints from the background
    // every frame, so reuse is byte-identical to fresh canvases and keeps the
    // native surface from piling up in the GC's way on long ranges (issue #67).
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const yieldToLoop = () => new Promise((resolve) => setImmediate(resolve));
    for (let n = start; n < end; n++) {
        const frame = readSignalFrame(bytes, header, n, sidecar);
        drawSpec(ctx, dims, frame, spec, { reducedFlicker: true, creative, seed, assets, onLayerError: (type, e) => line({ layerError: { frame: n, type, message: e instanceof Error ? e.message : String(e) } }) });
        if (pngDir !== undefined) {
            const png = await canvas.encode("png");
            fs.mkdirSync(pngDir, { recursive: true });
            fs.writeFileSync(path.join(pngDir, `${String(n).padStart(6, "0")}.png`), png);
        }
        else {
            const rgba = ctx.getImageData(0, 0, width, height).data;
            // Backpressure: when the consumer (an encoder pipe) is slower than the
            // renderer, wait for stdout to drain instead of buffering frames
            // without bound (issue #67).
            const ok = process.stdout.write(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength));
            if (!ok)
                await once(process.stdout, "drain");
        }
        line({ frame: n });
        // Give the loop a turn so freshly released native buffers are freed even
        // when the consumer never pushes back (e.g. /dev/null).
        await yieldToLoop();
    }
    line({
        manifest: {
            version: pkg.version,
            vocabulary: VOCABULARY_VERSION,
            canvas: pkg.dependencies["@napi-rs/canvas"],
            arch: process.arch,
            width,
            height,
            start,
            end,
            seed,
            frames: end - start,
            // Spec 021: the intended pixel shape, for the encoder; never changes a pixel.
            ...(spec.pixelAspect !== undefined ? { pixelAspect: spec.pixelAspect } : {}),
            // Spec 022: which asset bytes were rendered, and in which mode.
            ...(assetIds.length ? { assets: Object.fromEntries(assetIds.map((id) => [id, spec.assets[id].sha256])) } : {}),
            creative,
            // Spec 024: every plugin the spec uses (with the digest of the module file
            // loaded); plugin output is outside the core reference guarantee.
            ...(usedPlugins.length ? { plugins: usedPlugins, guarantee: "core-only" } : {}),
            // Spec 025: a sequence spec records its clip count.
            ...(spec.sequence?.length ? { clips: spec.sequence.length } : {}),
        },
    });
    return EXIT_OK;
}
