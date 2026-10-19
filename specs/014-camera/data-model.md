# Data Model: Camera moves and layer parallax

## The camera (spec JSON, optional)

```
camera: {
  move: "static" | "pan" | "zoom" | "push" | "parallax"
  from: { frame: number, zoom: number, x: number, y: number }
  to?:  { frame: number, zoom: number, x: number, y: number }   // required unless static
  ease?: "linear" | "smooth"                                    // default linear
}
```

`x`/`y` are normalised (0.5 = frame centre); `zoom` is an isotropic scale ≥ some positive
value (validated > 0).

## State at frame n (closed form)

```
p  = clamp((n − from.frame) / (to.frame − from.frame), 0, 1)
p' = ease === "smooth" ? p²(3 − 2p) : p
zoom(n) = from.zoom + (to.zoom − from.zoom) · p'        // pan holds zoom
x(n)    = from.x    + (to.x    − from.x)    · p'        // zoom holds x/y
y(n)    = from.y    + (to.y    − from.y)    · p'
static → from only
```

## Transform per layer

```
depth d = clamp(layer.depth ?? 1, 0, 1)      // only parallax reads it
s  = move === "parallax" ? 1 + (zoom(n) − 1)·d : zoom(n)
lx = move === "parallax" ? 0.5 + (x(n) − 0.5)·d : x(n)
ly = move === "parallax" ? 0.5 + (y(n) − 0.5)·d : y(n)

save → translate(W/2, H/2) → scale(s, s) → translate(−lx·W, −ly·H) → draw → restore
```

Identity when `zoom = 1` and `(x, y) = (0.5, 0.5)`.

## Validation

| condition | outcome |
| --- | --- |
| unknown `move`, unknown `ease`, non-object `from`/`to` | camera dropped, reported |
| `zoom` ≤ 0 or non-finite; `frame` non-finite; `x`/`y` non-finite | dropped, reported |
| non-static move without `to`, or `to.frame` ≤ `from.frame` | dropped, reported |
| `x`/`y` outside 0..1 | clamped |
| `depth` non-number | 1; out-of-range clamped to 0..1 |

## Invariants the gates enforce

1. Un-camera'd specs render byte-identically (no golden hash moves).
2. A camera spec rendered in chunks is byte-identical to the whole render.
3. A depth-0 layer is fixed across a parallax move; a depth-1 layer follows it.
4. A push camera is the identity at `from.frame` and fully zoomed at `to.frame`.
5. Every malformed-camera case is dropped and reported; the spec still renders.
