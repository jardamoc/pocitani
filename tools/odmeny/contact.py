# Krok 2: nahledovy list vyrezanych dilku na fialovem podkladu - podle nej
# se dilky pojmenuji a rozdeli do kategorii (mapovani.json pro towebp.py).
# Fialova schvalne: je na ni videt zbytek pozadi i odriznuty kus postavicky.
#
#   python -I contact.py <slozka_z_cut> <vystup.png>
import json, sys
from PIL import Image, ImageDraw

tiles, out = sys.argv[1], sys.argv[2]
b = json.load(open(tiles + '/boxes.json'))
cols = 14; cw, ch = 130, 170
rows = (len(b) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cw, rows * ch), (255, 0, 255)); d = ImageDraw.Draw(sheet)
for i, t in enumerate(b):
    im = Image.open(f"{tiles}/{t['name']}.png"); im.thumbnail((cw - 6, ch - 20))
    x = (i % cols) * cw; y = (i // cols) * ch
    sheet.paste(im, (x + 3, y + 16), im); d.text((x + 3, y + 2), t['name'], fill=(0, 0, 0))
sheet.save(out)
