"""Pack the generated close artwork into the game's raster icon format."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/workspace/generated_images/exec-65e3bc91-045d-46f9-9a1b-dc14078c0192.png')
image = Image.open(SOURCE).convert('RGBA')
image = image.crop(image.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox())
image.thumbnail((118, 118), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (128, 128))
canvas.alpha_composite(image, ((128-image.width)//2, (128-image.height)//2))
canvas.save(ROOT/'public/assets/ui/generated/icon-close-coral.webp', quality=85, method=6)
