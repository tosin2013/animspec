# Builds the `ship` sprite (24 x 26, nose up, left-right symmetric) from shapes,
# then adds a 1-px outline (O). Roles reuse the hero's names: hull = cloak,
# hull shade = cloak-shade, canopy = hair-light, trim = tunic, flame = gold,
# wing tips = boots.
import json, sys
W, H = 24, 26
def blank(): return [["."]*W for _ in range(H)]
def put(g, x, y, ch):
    if 0 <= x < W and 0 <= y < H: g[y][x] = ch
def hline(g, y, x0, x1, ch):
    for x in range(x0, x1+1): put(g, x, y, ch)
def mirror(g):
    for y in range(H):
        for x in range(W//2):
            if g[y][x] != "." and g[y][W-1-x] == ".": g[y][W-1-x] = g[y][x]
            elif g[y][W-1-x] != "." and g[y][x] == ".": g[y][x] = g[y][W-1-x]
def outline(g):
    out = [row[:] for row in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] != ".": continue
            if any(0 <= x+dx < W and 0 <= y+dy < H and g[y+dy][x+dx] not in (".", "O") for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                out[y][x] = "O"
    return ["".join(r) for r in out]
def ship(flame):
    g = blank(); c = W // 2  # columns c-1 and c are the centre pair
    # nose and fuselage (left half drawn, then mirrored)
    for y, half in [(1,1),(2,1),(3,2),(4,2),(5,2),(6,3),(7,3),(8,3),(9,3),(10,3),(11,4),(12,4),(13,4),(14,4),(15,4),(16,4),(17,3)]:
        hline(g, y, c-half, c-1, "C")
    for y in range(6, 18): put(g, c-1-(3 if y < 11 else 4)+1, y, "c")      # shade down the left flank
    for y in range(4, 8): hline(g, y, c-1, c-1, "h")                       # canopy
    put(g, c-1, 8, "c")
    for y in (12, 14): hline(g, y, c-3, c-1, "T")                          # trim stripes
    # swept wings
    for y, x0 in [(11,6),(12,4),(13,3),(14,2),(15,1),(16,1),(17,2),(18,4)]:
        hline(g, y, x0, c-5, "C")
    for y in range(13, 18): put(g, 2 if y > 13 else 3, y, "K")              # wing tips
    hline(g, 18, 4, 6, "c")
    # engines
    for y in range(17, 21): hline(g, y, c-4, c-3, "c")
    # flame: long and short frames
    for y in range(21, 21 + (4 if flame else 2)): hline(g, y, c-4, c-3, "G")
    if flame: put(g, c-4, 25 if 25 < H else 24, ".")
    mirror(g)
    return outline(g)
frames = {"walk": [ship(True), ship(False)], "idle": [ship(True), ship(False)]}
json.dump(frames, sys.stdout)
