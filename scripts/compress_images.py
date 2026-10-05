"""Re-encode shipped game images as WebP quality 85 without resizing or losing alpha."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'public'
images = sorted(p for p in root.rglob('*') if p.suffix.lower() in {'.webp', '.png', '.jpg', '.jpeg'})
before = sum(p.stat().st_size for p in images)
after = 0
for path in images:
    target = path.with_suffix('.webp')
    temporary = target.with_suffix('.webp.tmp')
    with Image.open(path) as image:
        image.save(temporary, format='WEBP', quality=85, method=6, exact=True)
    temporary.replace(target)
    if path != target:
        path.unlink()
    after += target.stat().st_size
print(f'{len(images)} images: {before:,} → {after:,} bytes ({(1-after/before)*100:.1f}% smaller)')
