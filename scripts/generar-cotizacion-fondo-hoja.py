#!/usr/bin/env python3
"""Genera public/cotizacion-fondo-hoja.jpg (sin panel ni rótulos de totales)."""
from PIL import Image, ImageDraw

SRC = 'public/cotizacion-fondo.jpg'
DEST = 'public/cotizacion-fondo-hoja.jpg'
# mm en A4: panel gris + SUBTOTAL/DESCUENTO/IVA/TOTAL (deja domicilio a la izquierda)
RECT_MM = (128, 249, 210, 287)

img = Image.open(SRC).convert('RGB')
w, h = img.size
x0 = int(RECT_MM[0] / 210 * w)
y0 = int(RECT_MM[1] / 297 * h)
x1 = int(RECT_MM[2] / 210 * w)
y1 = int(RECT_MM[3] / 297 * h)
out = img.copy()
ImageDraw.Draw(out).rectangle([x0, y0, x1, y1], fill=(255, 255, 255))
out.save(DEST, quality=92, optimize=True)
print('OK', DEST, 'rect_mm', RECT_MM)
