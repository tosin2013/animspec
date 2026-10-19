# Data Model: Per-layer signal bindings

## The binding object (spec JSON, optional per layer)

```
bind (map: paramName → binding)
  paramName               // a declared NUMERIC param of the layer's primitive
  from: string            // "amplitude" | "energy" | "band:<n>" | "osc"
  in?:  [number, number]  // feature range, default [0, 1]
  out?: [number, number]  // target range, default the param's registry bounds
  curve?: "linear" | "smooth"   // default linear (smooth = smoothstep)
  wave?:  "pulse" | "sine"      // osc only, default pulse
  period?: number               // osc only, seconds, > 0
  duty?:  number                // osc pulse only, 0..1, default 0.5
```

## Evaluation (per frame, in drawSpec)

```
feature(f, from, seed, layerIndex, paramName):
  "amplitude"  → f.amplitude
  "energy"     → f.energy
  "band:<n>"   → f.values[n]           (n ≥ values.length → cannot evaluate)
  "osc"        → pulse or sine of f.t (phase seeded per layer+param)

value = out[0] + (smooth(norm(in→feature)) ) × (out[1] − out[0])
clamp to the param's registry [min, max]
static sanitized value applies whenever the bind cannot evaluate
```

No state crosses frames; the sanitized spec is never mutated (each driven layer gets a
shallow per-frame view).

## Validation rules (sanitizeBind)

| condition | outcome |
| --- | --- |
| key not a declared param of the primitive | bind entry dropped, reported |
| target param not numeric (enum/boolean/string) | dropped, reported |
| `from` not a known source form | dropped, reported |
| `in`/`out` not two finite numbers, or reversed/zero-width `in` | dropped, reported |
| `period` not a positive finite number (osc) | dropped, reported |
| `duty` outside 0..1 (osc pulse) | dropped, reported |
| unknown `curve`/`wave` | dropped, reported |
| `band:<n>` beyond the frame's bands **at render time** | static value applies that frame (not an error) |

A layer is never dropped because its bind was malformed.

## Invariants the gates enforce

1. Specs without `bind` render byte-identically to the pre-bindings interpreter.
2. A bound spec rendered forward equals the same render split into chunks.
3. A bound param at a quiet vs loud frame differs exactly as the mapping predicts.
4. Every malformed-bind case is dropped **and reported**; the layer still renders.
5. Driven values never leave the target param's registry bounds.
