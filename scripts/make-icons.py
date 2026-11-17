# Draws the HeroPick icon (yellow star on dark) at the sizes the PWA needs. Run: python scripts/make-icons.py
import math
from PIL import Image, ImageDraw

def icon(size, path, pad=0.18):
    s = size * 4
    im = Image.new('RGB', (s, s), '#111111')
    d = ImageDraw.Draw(im)
    cx = cy = s / 2
    R = s * (0.5 - pad)
    r = R * 0.45
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a) + s * 0.02))
    d.polygon(pts, fill='#ffd60a')
    im.resize((size, size), Image.LANCZOS).save(path)

icon(192, 'public/icons/icon-192.png')
icon(512, 'public/icons/icon-512.png')
icon(180, 'public/icons/apple-touch-icon.png')
print('icons written')
