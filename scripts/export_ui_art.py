"""Export independently generated UI art without changing its aspect ratio."""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'scripts/ui-art-manifest.json').read_text())
output = ROOT / 'public/assets/ui/generated'
output.mkdir(parents=True, exist_ok=True)
for entry in manifest:
    size = (entry['w'], entry['h'])
    destination = output / f"{entry['name']}.webp"
    if destination.exists() and destination.stat().st_mtime >= Path(entry['path']).stat().st_mtime and Image.open(destination).size == size:
        continue
    source = Image.open(entry['path']).convert('RGBA')
    if entry['kind'] != 'wallpaper':
        bounds = source.getchannel('A').point(lambda value: 255 if value > 8 else 0).getbbox()
        if bounds:
            source = source.crop(bounds)
    # Fit, never stretch or crop artwork. Transparent padding preserves the exact export dimensions.
    fitted = ImageOps.contain(source, size, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', size)
    canvas.alpha_composite(fitted, ((size[0]-fitted.width)//2, (size[1]-fitted.height)//2))
    canvas.save(destination, quality=94, method=6, exact=True)
print(f'Exported {len(manifest)} separate UI textures.')
