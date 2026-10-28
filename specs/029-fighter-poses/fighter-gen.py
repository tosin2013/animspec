# Builds the `fighter` sprite (28 x 34, facing right) from shapes, then adds a
# 1-px outline (O) around every filled pixel, as the hero's frames have.
import json, sys
W, H = 28, 34
def blank(): return [["."]*W for _ in range(H)]
def put(g, x, y, ch):
    if 0 <= x < W and 0 <= y < H: g[y][x] = ch
def rect(g, x0, y0, x1, y1, ch):
    for y in range(y0, y1+1):
        for x in range(x0, x1+1): put(g, x, y, ch)
def line(g, x0, y0, x1, y1, ch, t=2):
    n = max(abs(x1-x0), abs(y1-y0), 1)
    for i in range(n+1):
        x = round(x0 + (x1-x0)*i/n); y = round(y0 + (y1-y0)*i/n)
        rect(g, x, y, x+t-1, y+t-1, ch)
def outline(g):
    out = [row[:] for row in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] != ".": continue
            if any(0 <= x+dx < W and 0 <= y+dy < H and g[y+dy][x+dx] not in (".", "O") for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                out[y][x] = "O"
    return ["".join(r) for r in out]

def head(g, ox, oy, blink=False, back=0):
    # hair cap and back of head, face, eye, headband with tails trailing left
    rect(g, ox+1, oy, ox+5, oy+1, "H"); put(g, ox+2, oy, "h"); put(g, ox+3, oy, "h")
    rect(g, ox, oy+2, ox+1, oy+5, "H")
    rect(g, ox+2, oy+2, ox+6, oy+6, "S")
    put(g, ox+6, oy+5, "S"); put(g, ox+7, oy+4, "S")          # nose
    rect(g, ox+1, oy+2, ox+6, oy+2, "G")                      # headband
    put(g, ox-1, oy+2, "G"); put(g, ox-2, oy+3, "G"); put(g, ox-3, oy+3, "G"); put(g, ox-4, oy+4, "G")
    if not blink: put(g, ox+5, oy+3, "E")
    else: put(g, ox+4, oy+4, "E"); put(g, ox+5, oy+4, "E")
    rect(g, ox+3, oy+6, ox+4, oy+7, "S")                      # neck

def torso(g, ox, oy):
    # gi top (cloak), shade on the back, open collar, belt (tunic) with a knot tail
    rect(g, ox, oy, ox+7, oy+8, "C"); rect(g, ox, oy+1, ox+1, oy+8, "c")
    put(g, ox+4, oy, "S"); put(g, ox+5, oy, "S"); put(g, ox+5, oy+1, "S")
    rect(g, ox, oy+9, ox+7, oy+10, "T"); put(g, ox-1, oy+10, "T"); put(g, ox-1, oy+11, "T")

def guard(g, ox, oy):
    # rear fist near the chin, front fist forward: gi sleeves, skin forearms, gloves (boots role)
    line(g, ox+6, oy+2, ox+9, oy+1, "C"); line(g, ox+9, oy+1, ox+10, oy-2, "S"); rect(g, ox+10, oy-4, ox+12, oy-2, "K")
    line(g, ox+6, oy+5, ox+11, oy+4, "C"); line(g, ox+11, oy+4, ox+14, oy+2, "S"); rect(g, ox+14, oy+1, ox+16, oy+3, "K")

def punch_arm(g, ox, oy):
    line(g, ox+6, oy+2, ox+9, oy+1, "C"); line(g, ox+9, oy+1, ox+10, oy-1, "S"); rect(g, ox+10, oy-3, ox+12, oy-1, "K")
    line(g, ox+6, oy+3, ox+11, oy+3, "C"); line(g, ox+11, oy+3, ox+15, oy+3, "S"); rect(g, ox+16, oy+2, ox+18, oy+4, "K")

def legs(g, hx, hy, front, back, fy):
    # pants (cloak), back leg shaded, bare feet (skin)
    rect(g, hx, hy, hx+7, hy+2, "C")
    line(g, hx+1, hy+2, back, fy-1, "c", 3); rect(g, back-2, fy, back+1, fy+1, "S")
    line(g, hx+5, hy+2, front, fy-1, "C", 3); rect(g, front, fy, front+3, fy+1, "S")

def stand(bob=0, front=17, back=6, blink=False):
    g = blank(); oy = bob
    head(g, 9, 1+oy, blink); torso(g, 8, 9+oy); guard(g, 8, 9+oy); legs(g, 8, 20+oy, front, back, 31)
    return outline(g)

def punch():
    g = blank()
    head(g, 8, 2); torso(g, 7, 10); punch_arm(g, 7, 10); legs(g, 7, 21, 18, 5, 31)
    return outline(g)

def hit():
    g = blank()
    # thrown back: head and torso shifted left and down, arms flung back, eye shut
    head(g, 6, 3, blink=True); torso(g, 5, 11)
    line(g, 6, 13, 2, 9, "C"); line(g, 2, 9, 1, 6, "S"); rect(g, 0, 4, 2, 6, "K")
    line(g, 12, 13, 15, 10, "C"); line(g, 15, 10, 17, 8, "S"); rect(g, 17, 6, 19, 8, "K")
    legs(g, 5, 22, 15, 4, 31)
    return outline(g)

def ko():
    g = blank()
    # flat on the ground, head to the left, body along the bottom rows
    y = 25
    rect(g, 1, y+1, 2, y+4, "H"); rect(g, 3, y, 7, y+5, "S"); rect(g, 3, y, 7, y, "H")
    rect(g, 2, y+1, 2, y+4, "G"); put(g, 6, y+2, "E"); put(g, 7, y+2, "E")
    rect(g, 8, y+1, 16, y+5, "C"); rect(g, 8, y+4, 16, y+5, "c"); rect(g, 17, y+1, 18, y+5, "T")
    rect(g, 19, y+2, 24, y+5, "C"); rect(g, 19, y+4, 24, y+5, "c"); rect(g, 25, y+2, 26, y+3, "S"); rect(g, 25, y+4, 26, y+5, "S")
    line(g, 12, y+1, 15, y-2, "S"); rect(g, 15, y-4, 17, y-2, "K")
    return outline(g)

def jump():
    g = blank()
    head(g, 9, 0); torso(g, 8, 8); guard(g, 8, 8)
    rect(g, 8, 19, 15, 21, "C"); line(g, 9, 21, 7, 25, "c", 3); line(g, 13, 21, 18, 24, "C", 3)
    rect(g, 4, 26, 7, 27, "S"); rect(g, 18, 25, 21, 26, "S")
    return outline(g)

frames = {
  "walk": [stand(0, 17, 6), stand(1, 15, 8)],
  "idle": [stand(0), stand(1, blink=False)],
  "jump": jump(), "punch": [punch()], "hit": [hit()], "ko": [ko()],
}
json.dump(frames, sys.stdout)
