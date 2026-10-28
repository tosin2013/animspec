/**
 * `npm run showcase:generate` — render every showcase case (scripts/lib/showcase.ts)
 * into `showcase/`: stills as PNG, loops as one-second GIFs. The output is
 * committed and copied into the site by `generate-site.ts`; the registry gate
 * re-renders the stills and fails when one is stale. No clock, no randomness,
 * no network.
 */
import fs from "node:fs";
import path from "node:path";
import { GifEncoder } from "@napi-rs/canvas";
import { encodeFrame } from "./lib/referenceSets.js";
import { SHOWCASE, SHOWCASE_DIMS, preloadShowcaseAssets, renderShowcase, showcaseFile } from "./lib/showcase.js";

const dir = path.join("showcase");
fs.mkdirSync(dir, { recursive: true });
await preloadShowcaseAssets();
for (const c of SHOWCASE) {
  const { width, height } = c.dims ?? SHOWCASE_DIMS;
  const frames = renderShowcase(c);
  let bytes: Buffer;
  if (c.kind === "still") bytes = await encodeFrame(frames[0], width, height);
  else {
    const encoder = new GifEncoder(width, height, { repeat: 0, quality: 10 });
    for (const rgba of frames) encoder.addFrame(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height, { delay: 33 });
    bytes = Buffer.from(encoder.finish());
  }
  fs.writeFileSync(path.join(dir, showcaseFile(c)), bytes);
}
console.log(`showcase: wrote ${SHOWCASE.length} cases to showcase/`);
