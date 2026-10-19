# Krok 1: rozreze list postavicek s PRUHLEDNYM pozadim na jednotlive dilky.
#
#   python -I cut.py <list.png> <slozka_pro_dilky>
#
# Postavicka = souvisla oblast s alfou >= 40; male kousky (hulky, mice) do 30 px
# se pripoji k nejblizsi. Oblast sirsi nez 130 px a nizsi nez 130 px jsou dve
# postavicky, ktere se dotykaji - rozdeli se v nejuzsim sloupci. Pixely sousedu,
# ktere zasahnou do obdelniku, se vymazou. Dilky se jmenuji rRR_SS (radek, poradi
# zleva) a zvetsi se 2x. Pocty v radcich se vypisou - nesedi-li, podivej se
# na nahled (contact.py) a uprav prahy.
#
# List s NEpruhlednym pozadim (krem, cerna) tudy nejde - viz CLAUDE.md,
# "Druha varka" u dumplingu (vyplneni od okraje s tesnou mezi barvy).
import sys, os, json
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
im = Image.open(src).convert('RGBA')
W, H = im.size
a = im.getchannel('A').load()
TH = 40
lab = [-1] * (W * H)
comps = []
for y in range(H):
    for x in range(W):
        i = y * W + x
        if lab[i] >= 0 or a[x, y] < TH:
            continue
        cid = len(comps)
        stack = [(x, y)]; lab[i] = cid
        x0 = x1 = x; y0 = y1 = y; n = 0
        while stack:
            cx, cy = stack.pop(); n += 1
            x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
            for nx, ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                if 0 <= nx < W and 0 <= ny < H:
                    j = ny * W + nx
                    if lab[j] < 0 and a[nx, ny] >= TH:
                        lab[j] = cid; stack.append((nx, ny))
        comps.append({'box': [x0, y0, x1, y1], 'n': n, 'ids': [cid], 'xcut': None})
big = [c for c in comps if c['n'] >= 800]
def dist(b, c):
    dx = max(b[0]-c[2], c[0]-b[2], 0); dy = max(b[1]-c[3], c[1]-b[3], 0)
    return dx*dx + dy*dy
for idx, s in enumerate(comps):
    if s['n'] >= 800 or s['n'] < 15: continue
    b = min(big, key=lambda b: dist(b['box'], s['box']))
    if dist(b['box'], s['box']) < 30*30:
        b['ids'].append(idx)
        bb, sb = b['box'], s['box']
        b['box'] = [min(bb[0],sb[0]), min(bb[1],sb[1]), max(bb[2],sb[2]), max(bb[3],sb[3])]
# prilis siroke komponenty (dve postavicky se dotykaji) rozdelit v nejtenci miste
final = []
for c in big:
    x0, y0, x1, y1 = c['box']
    if x1 - x0 > 130 and y1 - y0 < 130:
        best = None
        for x in range(x0 + 40, x1 - 40):
            s = sum(1 for y in range(y0, y1 + 1) if lab[y*W+x] in c['ids'])
            if best is None or s < best[0]: best = (s, x)
        xc = best[1]
        final.append({**c, 'box': [x0, y0, xc, y1], 'xr': (x0, xc)})
        final.append({**c, 'box': [xc, y0, x1, y1], 'xr': (xc, x1 + 1)})
    else:
        final.append({**c, 'xr': (x0, x1 + 1)})
final.sort(key=lambda c: (c['box'][1] + c['box'][3]) / 2)
rows = []
for c in final:
    cy = (c['box'][1] + c['box'][3]) / 2
    if rows and abs(cy - rows[-1][0]) < 50: rows[-1][1].append(c)
    else: rows.append([cy, [c]])
res = []
px = im.load()
for r, (cy, cs) in enumerate(rows):
    cs.sort(key=lambda c: c['box'][0])
    for k, c in enumerate(cs):
        name = f'r{r+1:02d}_{k+1:02d}'
        x0, y0, x1, y1 = c['box']
        pad = 2
        bx0, by0, bx1, by1 = max(x0-pad,0), max(y0-pad,0), min(x1+pad+1,W), min(y1+pad+1,H)
        tile = Image.new('RGBA', (bx1-bx0, by1-by0), (0,0,0,0))
        tp = tile.load()
        ids = set(c['ids'])
        xa, xb = c['xr']
        for y in range(by0, by1):
            for x in range(bx0, bx1):
                l = lab[y*W+x]
                if l in ids:
                    if not (xa <= x < xb): continue
                elif l >= 0:
                    continue  # pixel jine postavicky
                else:
                    # slaby okraj (alpha < TH) - vezmi jen kdyz sousedi s vlastnim pixelem
                    ok = False
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                        nx, ny = x+dx, y+dy
                        if 0 <= nx < W and 0 <= ny < H and lab[ny*W+nx] in ids and xa <= nx < xb:
                            ok = True; break
                    if not ok: continue
                tp[x-bx0, y-by0] = px[x, y]
        tile = tile.resize((tile.width*2, tile.height*2), Image.LANCZOS)
        tile.save(os.path.join(out, name + '.png'))
        res.append({'name': name, 'box': [bx0, by0, bx1, by1]})
print(len(res), [len(cs) for _, cs in rows])
json.dump(res, open(os.path.join(out, 'boxes.json'), 'w'), indent=1)
