# Krok 3: vyrezane postavicky (PNG z cut.py) prevede na ctvercove .webp
# do public/img/odmeny/<sbirka>/<kategorie>/ a vypise radky pro rewards-data.js.
#
#   python -I towebp.py <slozka_z_cut> <mapovani.json> <cil> <predpona_id>
#   napr. python -I towebp.py %TEMP%\tiles labubu.json ..\..\public\img\odmeny\labubu lab_
#
# Mapovani (viz labubu.json): { "basic": [["r01_01", "soubor", "Ceske jmeno"], ...], ... }
# Poradi v seznamu = poradi ID (lab_basic_01, 02 ...). Kazdy dilek smi byt jen jednou.
# Radky pro rewards-data.js zapise do <cil>/../<predpona>items.js - ten soubor
# do public/ nepatri, po prekopirovani ho smaz.
import json, sys, os
from PIL import Image

tiles, mapping, dest, prefix = sys.argv[1:5]
m = json.load(open(mapping, encoding='utf-8'))
used = set()
js = []
for cat, rows in m.items():
    os.makedirs(f'{dest}/{cat}', exist_ok=True)
    js.append(f'  {cat}: [')
    for i, (tile, f, name) in enumerate(rows, 1):
        assert tile not in used, f'dilek {tile} je v mapovani dvakrat'
        used.add(tile)
        im = Image.open(f'{tiles}/{tile}.png').convert('RGBA')
        # ctverec, postavicka stoji dole uprostred
        side = max(im.size)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(im, ((side - im.width) // 2, side - im.height))
        sq.save(f'{dest}/{cat}/{f}.webp', 'WEBP', quality=90, method=6)
        js.append(f"    {{ id: '{prefix}{cat}_{i:02d}', file: '{f}', name: '{name}' }},")
    js.append('  ],')
print(len(used), 'postavicek')
out = os.path.join(os.path.dirname(os.path.abspath(dest)), f'{prefix}items.js')
open(out, 'w', encoding='utf-8').write('\n'.join(js) + '\n')
print('radky pro rewards-data.js:', out)
