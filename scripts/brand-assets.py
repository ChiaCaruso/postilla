"""Genera le versioni del logo di Postilla da brand/postilla-logo-sorgente.jpg.

Uso: python3 scripts/brand-assets.py   (serve Pillow: pip install pillow)

- toglie lo sfondo chiaro partendo dai bordi (riempimento a tolleranza),
  così i bianchi dentro il disegno (occhi, foglio) restano;
- public/brand/postilla-logo.png      logo completo, sfondo trasparente
- public/brand/postilla-mascotte.png  solo la mascotte, sfondo trasparente
- public/favicon-16.png, favicon-32.png  icona della scheda (solo il foglio con la faccia)
- public/favicon-192.png               icona grande (mascotte)
- public/favicon.ico                   icona classica, 16/32/48 px (foglio con la faccia)
- public/apple-touch-icon.png         icona per iPhone/iPad, sfondo bianco (Apple non vuole trasparenze)
- brand/postilla-logo-readme.png      logo su fondo bianco per il README (leggibile anche col tema scuro di GitHub)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'brand' / 'postilla-logo-sorgente.jpg'
OUT = ROOT / 'public'
KEY = (255, 0, 255)


def ink_rows_cols(im):
    px = im.load()
    W, H = im.size
    rows, cols = [0] * H, [0] * W
    for y in range(H):
        for x in range(0, W):
            r, g, b = px[x, y]
            if min(r, g, b) < 215 or max(r, g, b) - min(r, g, b) > 40:
                rows[y] += 1
                cols[x] += 1
    return rows, cols


def bbox(rows, cols, y0=0, y1=None):
    y1 = len(rows) if y1 is None else y1
    ys = [y for y in range(y0, y1) if rows[y] > 2]
    xs = [x for x, c in enumerate(cols) if c > 2]
    return min(xs), ys[0], max(xs), ys[-1]


def transparent(im, pad=24):
    """Ritaglio con margine, sfondo trasparente dai bordi."""
    im = im.copy()
    W, H = im.size
    seeds = [(x, 0) for x in range(0, W, 8)] + [(x, H - 1) for x in range(0, W, 8)] + \
            [(0, y) for y in range(0, H, 8)] + [(W - 1, y) for y in range(0, H, 8)]
    for s in seeds:
        if im.getpixel(s) != KEY:
            ImageDraw.floodfill(im, s, KEY, thresh=26)
    rgba = Image.new('RGBA', im.size)
    out = []
    for p in im.getdata():
        out.append((255, 255, 255, 0) if p == KEY else (*p, 255))
    rgba.putdata(out)
    return rgba


def fit(im, width):
    h = round(im.height * width / im.width)
    return im.resize((width, h), Image.LANCZOS)


def square(im, size, bg=None):
    side = max(im.size)
    canvas = Image.new('RGBA', (side, side), (255, 255, 255, 0) if bg is None else (*bg, 255))
    canvas.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


src = Image.open(SRC).convert('RGB')
small = src.resize((src.width // 2, src.height // 2), Image.LANCZOS)  # per misurare in fretta
rows, cols = ink_rows_cols(small)
x0, y0, x1, y1 = [v * 2 for v in bbox(rows, cols)]
# La mascotte finisce (ombra compresa) alla riga 1036 dell'immagine sorgente;
# sotto comincia la scritta con le sue decorazioni (misurato sul profilo delle righe).
SPLIT_Y = 1036
P = 24
logo = transparent(src.crop((x0 - P, y0 - P, x1 + P, y1 + P)))
mascot_box = (x0 - P, y0 - P, x1 + P, SPLIT_Y)
mascot = transparent(src.crop(mascot_box))
mascot = mascot.crop(mascot.getbbox())

(OUT / 'brand').mkdir(parents=True, exist_ok=True)
fit(logo, 480).save(OUT / 'brand' / 'postilla-logo.png', optimize=True)
fit(mascot, 256).save(OUT / 'brand' / 'postilla-mascotte.png', optimize=True)
# Icona della scheda: a 16-32 px la mascotte intera è illeggibile; si usa solo il foglio con la faccia.
FACE_BOX = (1150, 330, 1665, 985)  # coordinate nell'immagine sorgente
face = transparent(src.crop(FACE_BOX), pad=0)
face = face.crop(face.getbbox())
square(face, 16).save(OUT / 'favicon-16.png', optimize=True)
square(face, 32).save(OUT / 'favicon-32.png', optimize=True)
square(mascot, 192).save(OUT / 'favicon-192.png', optimize=True)
# Logo per il README di GitHub: su fondo bianco con margine, così resta leggibile anche con il tema scuro.
readme = Image.new('RGBA', (logo.width + 160, logo.height + 120), (255, 255, 255, 255))
readme.alpha_composite(logo, (80, 60))
fit(readme, 360).convert('RGB').save(ROOT / 'brand' / 'postilla-logo-readme.png', optimize=True)
# favicon.ico classico (16, 32, 48 px in un solo file): lo cercano da soli browser, segnalibri e Windows
square(face, 256).save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
square(mascot.crop(mascot.getbbox()), 180, bg=(255, 255, 255)).convert('RGB').save(OUT / 'apple-touch-icon.png', optimize=True)
print('logo', logo.size, 'mascotte', mascot.size)
