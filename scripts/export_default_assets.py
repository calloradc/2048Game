"""Export the exact default game art as PNG, plus a transparent fruit atlas."""
import argparse
import json
import re
import zipfile
from pathlib import Path

from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=Path('exports/default-assets'))
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
assets = root / 'public/assets'

# Use the assets loaded by wideBackgroundAsset('meadow') and boxAsset('glass').
for source, target in [
    ('backgrounds/meadow-wide.webp', 'default-background-wide.png'),
    ('boxes/tall-glass.webp', 'default-box.png'),
]:
    with Image.open(assets / source) as image:
        image.save(out / target)

cell = 256
atlas = Image.new('RGBA', (cell * 4, cell * 3), (0, 0, 0, 0))
fruits = re.findall(r"name: '([^']+)', value: (\d+)", (root / 'src/game/fruits.ts').read_text())
assert len(fruits) == 11
frames = []
for level, (name, value) in enumerate(fruits):
    x, y = level % 4 * cell, level // 4 * cell
    with Image.open(assets / f'fruit-{level}.webp') as sprite:
        assert sprite.size == (cell, cell)
        # Copy pixels without scaling, recoloring, or an extra alpha mask.
        atlas.paste(sprite.convert('RGBA'), (x, y))
    frames.append({'level': level, 'name': name, 'value': int(value),
                   'x': x, 'y': y, 'width': cell, 'height': cell})
atlas.save(out / 'default-fruits-spritesheet.png')
(out / 'default-fruits-spritesheet.json').write_text(
    json.dumps({'image': 'default-fruits-spritesheet.png', 'width': atlas.width,
                'height': atlas.height, 'columns': 4, 'rows': 3,
                'cellSize': cell, 'frames': frames}, ensure_ascii=False, indent=2) + '\n'
)
with zipfile.ZipFile(out / 'default-game-assets.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['default-background-wide.png', 'default-box.png',
                 'default-fruits-spritesheet.png', 'default-fruits-spritesheet.json']:
        archive.write(out / name, name)
for path in sorted(out.iterdir()):
    print(f'{path.name}: {path.stat().st_size:,} bytes')
