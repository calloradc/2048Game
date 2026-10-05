"""Crop and format separately generated taller boxes without stretching them.

All bodies have the same exported height and baseline. The first glass source
was the height reference for every themed redraw; original PNGs are preserved.
"""
import json
from pathlib import Path
from PIL import Image
from refresh_visual_assets import character_bounds

ROOT = Path(__file__).resolve().parents[1]

def export():
    sources = json.loads((ROOT / 'scripts/tall-box-assets.json').read_text())
    for key, source in sources.items():
        image = Image.open(source).convert('RGBA')
        image = image.crop(character_bounds(image))
        destination = ROOT / 'public/assets' / key
        destination.parent.mkdir(parents=True, exist_ok=True)
        if key.startswith('boxes/'):
            height = 768
            width = round(image.width * height / image.height)
            if width > 712:
                raise ValueError(f'{key}: redraw is wider than the height reference ({width}px)')
            image = image.resize((width, height), Image.Resampling.LANCZOS)
            tile = Image.new('RGBA', (720, 820))
            tile.alpha_composite(image, ((720 - width) // 2, 820 - height - 8))
        else:
            image.thumbnail((120, 120), Image.Resampling.LANCZOS)
            tile = Image.new('RGBA', (128, 128))
            tile.alpha_composite(image, ((128 - image.width) // 2, (128 - image.height) // 2))
        tile.save(destination, quality=92, method=6)
        print(f'Exported {key}: {tile.width}x{tile.height}')

if __name__ == '__main__':
    export()
