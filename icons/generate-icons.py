"""Generate simple vision-themed icons for the Chrome extension."""
from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size, outpath):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Background circle
    padding = max(1, size // 10)
    draw.ellipse([padding, padding, size - padding - 1, size - padding - 1],
                 fill=(79, 70, 229, 255))  # Indigo-600
    # Simple eye pupil (vision motif)
    cx, cy = size // 2, size // 2
    r = size // 5
    draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                 fill=(255, 255, 255, 255))
    draw.ellipse([cx - r//3, cy - r//3, cx + r//3, cy + r//3],
                 fill=(79, 70, 229, 255))
    img.save(outpath, 'PNG')

os.makedirs(os.path.dirname(__file__) or '.', exist_ok=True)
for s in [16, 48, 128]:
    make_icon(s, f'icon{s}.png')
    print(f'Created icon{s}.png')
