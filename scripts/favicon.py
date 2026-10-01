# Gera o favicon do Y2Player: bichinho de fone no visor de um Y2Player tangerina.
import sys
from PIL import Image, ImageDraw, ImageFilter

# uso: python3 scripts/favicon.py public
OUT = sys.argv[1]

BODY = ['.....######.....','...##xxxxxx##...','..#xxxxxxxxxx#..','.#xxxxxxxxxxxx#.','.#xxxxxxxxxxxx#.',
 '#xxxxxxxxxxxxxx#','#xxxxxxxxxxxxxx#','#xxxxxxxxxxxxxx#','#xxxxxxxxxxxxxx#','#xxxxxxxxxxxxxx#',
 '.#xxxxxxxxxxxx#.','.#xxxxxxxxxxxx#.','..##xxxxxxxx##..','....########....']
PHONES = ['......########......','....##xxxxxxxx##....','...#xxx......xxx#...','..#xx..........xx#..',
 '..#x............x#..','..#..............#..','.##..............##.','###..............###',
 '###..............###','###..............###','.##..............##.']
HAPPY = ['.##.', '#..#']
SING = ['.##.', '#..#', '.##.']

def compose():
    W, H = 20, 17
    g = [[0]*W for _ in range(H)]
    def stamp(m, x0, y0):
        for y, row in enumerate(m):
            for i, c in enumerate(row):
                if c == '.': continue
                x, yy = x0+i, y0+y
                if 0 <= x < W and 0 <= yy < H:
                    g[yy][x] = {'#':1, '+':2, 'x':0}[c]
    cy = -1
    stamp(BODY, 2, cy+3); stamp(PHONES, 0, cy+1)
    stamp(['....##....##....'], 2, cy+17)
    stamp(HAPPY, 5, cy+9); stamp(HAPPY, 11, cy+9)
    stamp(['++'], 4, cy+11); stamp(['++'], 14, cy+11)
    stamp(['#..#', '.##.'], 8, cy+12)
    return g

PET = compose()
# geometria em unidades de 32
LCD = (3, 3, 29, 22)
PET_X, PET_Y = 6, 4
WHEEL = (16, 27.1, 3.5)

def hexrgb(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), a)

def render(size):
    ss = 8
    S = size*ss; u = S/32
    im = Image.new('RGBA', (S, S), (0,0,0,0))
    # corpo: gradiente vertical tangerina
    grad = Image.new('RGBA', (1, S))
    stops = [(0, '#FFB15C'), (0.45, '#FF8A24'), (1, '#E5650E')]
    for y in range(S):
        t = y/(S-1)
        for (t0,c0),(t1,c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                k = (t-t0)/(t1-t0); a, b = hexrgb(c0), hexrgb(c1)
                grad.putpixel((0,y), tuple(round(a[i]+(b[i]-a[i])*k) for i in range(4)))
    grad = grad.resize((S, S))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S-1, S-1), radius=7.5*u, fill=255)
    im.paste(grad, (0,0), mask)
    d = ImageDraw.Draw(im)
    # aro fino: borda escura + parede interna clara
    d.rounded_rectangle((0, 0, S-1, S-1), radius=7.5*u, outline=hexrgb('#B54A05', 200), width=round(0.6*u))
    d.rounded_rectangle((0.9*u, 0.9*u, S-1-0.9*u, S-1-0.9*u), radius=6.6*u, outline=hexrgb('#FFE2BF', 90), width=round(0.35*u))
    # visor
    x0,y0,x1,y1 = [v*u for v in LCD]
    d.rounded_rectangle((x0-0.9*u, y0-0.9*u, x1+0.9*u, y1+0.9*u), radius=3.4*u, fill=hexrgb('#4A2106'))
    d.rounded_rectangle((x0, y0, x1, y1), radius=2.4*u, fill=hexrgb('#E8FACB'))
    ink = hexrgb('#1E2A10'); half = hexrgb('#1E2A10', 95)
    for yy, row in enumerate(PET):
        for xx, v in enumerate(row):
            if v:
                px, py = (PET_X+xx)*u, (PET_Y+yy)*u
                d.rectangle((px, py, px+u-1, py+u-1), fill=ink if v == 1 else half)
    # click-wheel
    cx, cy, r = [v*u for v in WHEEL]
    d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=hexrgb('#FFF2E3'), outline=hexrgb('#EFCFAF'), width=round(0.4*u))
    r2 = 1.3*u
    d.ellipse((cx-r2, cy-r2, cx+r2, cy+r2), fill=hexrgb('#FFD2A6'))
    # brilho molhado no plástico (sobre tudo, recortado pelo corpo)
    gloss = Image.new('RGBA', (S, S), (0,0,0,0))
    gd = ImageDraw.Draw(gloss)
    gd.ellipse((-6*u, -14*u, 24*u, 8.5*u), fill=(255,255,255,55))
    gloss = gloss.filter(ImageFilter.GaussianBlur(1.6*u))
    gm = Image.new('L', (S, S), 0); gm.paste(gloss.getchannel('A'), (0,0), mask)
    gloss.putalpha(gm)
    im = Image.alpha_composite(im, gloss)
    return im.resize((size, size), Image.LANCZOS)

big = render(512); big.save(f'{OUT}/preview-512.png')
render(32).save(f'{OUT}/favicon-32.png')
render(180).save(f'{OUT}/apple-touch-icon.png')
for s in (16, 48): render(s).save(f'{OUT}/favicon-{s}.png')
ico = render(48)
ico.save(f'{OUT}/favicon.ico', sizes=[(16,16),(32,32),(48,48)], append_images=[render(16), render(32)])

# SVG com os mesmos elementos
def esc(c): return c
rects = []
for yy, row in enumerate(PET):
    x = 0
    while x < len(row):
        v = row[x]
        if v:
            x2 = x
            while x2+1 < len(row) and row[x2+1] == v: x2 += 1
            rects.append(f'<rect x="{PET_X+x}" y="{PET_Y+yy}" width="{x2-x+1}" height="1"{"" if v==1 else " fill-opacity=\".37\""}/>')
            x = x2+1
        else: x += 1
x0,y0,x1,y1 = LCD; cx,cy,r = WHEEL
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB15C"/><stop offset=".45" stop-color="#FF8A24"/><stop offset="1" stop-color="#E5650E"/></linearGradient>
<clipPath id="c"><rect width="32" height="32" rx="7.5"/></clipPath></defs>
<rect x=".3" y=".3" width="31.4" height="31.4" rx="7.3" fill="url(#b)" stroke="#B54A05" stroke-opacity=".8" stroke-width=".6"/>
<rect x="1.1" y="1.1" width="29.8" height="29.8" rx="6.5" fill="none" stroke="#FFE2BF" stroke-opacity=".47" stroke-width=".45"/>
<rect x="{x0-.9}" y="{y0-.9}" width="{x1-x0+1.8}" height="{y1-y0+1.8}" rx="3.4" fill="#4A2106"/>
<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="2.4" fill="#E8FACB"/>
<g fill="#1E2A10" shape-rendering="crispEdges">{"".join(rects)}</g>
<circle cx="{cx}" cy="{cy}" r="{r-.2}" fill="#FFF2E3" stroke="#EFCFAF" stroke-width=".4"/>
<circle cx="{cx}" cy="{cy}" r="1.3" fill="#FFD2A6"/>
<ellipse cx="9" cy="-2.75" rx="15" ry="11.25" fill="#fff" fill-opacity=".2" clip-path="url(#c)"/>
</svg>'''
open(f'{OUT}/favicon.svg','w').write(svg)
