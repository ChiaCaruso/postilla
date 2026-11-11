"""Scarica da Google Fonts i font metricamente compatibili con quelli d'ufficio e li salva in public/fonts.

Uso: python3 scripts/fetch-compatible-fonts.py   (serve fontTools: pip install fonttools)

Stesse larghezze dei caratteri di:
  Arimo → Arial/Helvetica · Tinos → Times New Roman · Cousine → Courier New
  Carlito → Calibri · Caladea → Cambria · Gelasio → Georgia
Arimo e Gelasio sono distribuiti solo come font "variabili": se ne ricavano le varianti statiche
(normale 400, grassetto 700), perché la libreria che scrive i PDF incorpora un file per variante.
"""
import urllib.request
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'fonts'
LIC = OUT / 'licenze'
BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'

STATIC = {
    'Tinos': 'tinos', 'Cousine': 'cousine', 'Carlito': 'carlito', 'Caladea': 'caladea',
}
VARIABLE = {
    'Arimo': ('arimo', 'Arimo[wght].ttf', 'Arimo-Italic[wght].ttf'),
    'Gelasio': ('gelasio', 'Gelasio[wght].ttf', 'Gelasio-Italic[wght].ttf'),
}
# Tinos non ha il file di licenza nella sua cartella: è OFL come Arimo e Cousine (stesso autore e titolare).
LICENSE_FROM = {'Tinos': 'arimo'}


def get(url: str) -> bytes:
    url = url.replace('[', '%5B').replace(']', '%5D')
    with urllib.request.urlopen(url) as r:
        return r.read()


OUT.mkdir(parents=True, exist_ok=True)
LIC.mkdir(parents=True, exist_ok=True)

for fam, d in STATIC.items():
    for v in ('Regular', 'Bold', 'Italic', 'BoldItalic'):
        (OUT / f'{fam}-{v}.ttf').write_bytes(get(f'{BASE}{d}/{fam}-{v}.ttf'))
    (LIC / f'{fam}-OFL.txt').write_bytes(get(f'{BASE}{LICENSE_FROM.get(fam, d)}/OFL.txt'))
    print('ok', fam)

tmp = OUT / '_tmp.ttf'
for fam, (d, upright, italic) in VARIABLE.items():
    for src, names in ((upright, ('Regular', 'Bold')), (italic, ('Italic', 'BoldItalic'))):
        tmp.write_bytes(get(f'{BASE}{d}/{src}'))
        for v, w in zip(names, (400, 700)):
            font = instantiateVariableFont(TTFont(tmp), {'wght': w}, updateFontNames=False)
            font.save(OUT / f'{fam}-{v}.ttf')
    (LIC / f'{fam}-OFL.txt').write_bytes(get(f'{BASE}{d}/OFL.txt'))
    print('ok', fam, '(statico da variabile)')
tmp.unlink(missing_ok=True)
