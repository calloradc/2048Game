"""Export generated collections, keeping opaque faces square and decorations free."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

root = Path(__file__).resolve().parents[1]
source = Path('/workspace/generated_images')
dest = root / 'public/assets'
sources = {
    'fuzzies': 'exec-4c00c551-53d8-48c1-9584-30fb58e1dff6.png',
    'sushi': 'exec-69e2ea0b-3c60-4f17-aace-abe6a9217012.png',
    'vegetables': 'exec-f020b948-2517-44a7-a29b-36c85662b7cd.png',
    'fastfood': 'exec-e8c3b938-1126-4662-b753-91a43e8dac6e.png',
    'crystals': 'exec-c5fa0b5d-04a3-45d2-b342-7127316e373e.png',
}
def trim(im):
    return im.crop(im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox())

def cell(atlas, index, cols, rows):
    w, h = atlas.size
    x, y = index % cols, index // cols
    return atlas.crop((round(x*w/cols), round(y*h/rows), round((x+1)*w/cols), round((y+1)*h/rows)))

def sprite(im, size=256, padding=6):
    im = trim(im)
    im.thumbnail((size-padding*2, size-padding*2), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (size, size))
    result.alpha_composite(im, ((size-im.width)//2, (size-im.height)//2))
    return result

def body(im):
    # Sample the middle/lower face, away from ears, leaves and crowns.
    a = im.getchannel('A')
    bbox = a.point(lambda v: 255 if v > 150 else 0).getbbox()
    rows = []
    for y in range(round(bbox[1]+(bbox[3]-bbox[1])*.48), round(bbox[1]+(bbox[3]-bbox[1])*.78)):
        xs = [x for x in range(256) if a.getpixel((x,y)) > 150]
        if xs: rows.append((xs[0], xs[-1]+1))
    left = sorted(r[0] for r in rows)[len(rows)//2]
    right = sorted(r[1] for r in rows)[len(rows)//2]
    broad_rows = [y for y in range(bbox[1], bbox[3]) if sum(a.getpixel((x,y)) > 150 for x in range(left,right)) > (right-left)*.45]
    bottom = min(bbox[3], broad_rows[-1]+3)
    return [left, bottom-(right-left), right, bottom]

metadata = {}
sheet = Image.new('RGB', (11*128, 6*150), '#e8eddb')
d = ImageDraw.Draw(sheet)
for row, (theme, file) in enumerate(sources.items()):
    directory = dest / 'skins' / theme
    directory.mkdir(parents=True, exist_ok=True)
    atlas = Image.open(source / file).convert('RGBA')
    metadata[theme] = []
    for i in range(11):
        tile = sprite(cell(atlas, i, 4, 3))
        tile.save(directory / f'{i}.webp', quality=85, method=6)
        rect = body(tile)
        metadata[theme].append(rect)
        preview = tile.resize((128,128))
        sheet.paste(preview, (i*128,row*150+20), preview)
        d.rectangle([i*128+rect[0]/2,row*150+20+rect[1]/2,i*128+rect[2]/2,row*150+20+rect[3]/2], outline='#ff3060')
    d.text((3,row*150+3), theme, fill='#243b28')

atlas = Image.open(source / 'exec-7461084d-ed55-45ff-8bfd-e3c75b087aa5.png').convert('RGBA')
metadata['fruitLarge'] = []
for i in range(4):
    tile = sprite(cell(atlas,i,2,2))
    tile.save(dest / f'fruit-{i+7}.webp', quality=85, method=6)
    rect = body(tile)
    metadata['fruitLarge'].append(rect)
    preview=tile.resize((128,128));sheet.paste(preview,(i*128,770),preview)
    d.rectangle([i*128+rect[0]/2,770+rect[1]/2,i*128+rect[2]/2,770+rect[3]/2],outline='#ff3060')

(root/'src/game/generatedBodies.json').write_text(json.dumps(metadata,indent=2)+'\n')
sheet.save('/workspace/scratch/shop-body-check.jpg')

(dest/'backgrounds').mkdir(exist_ok=True)
# Backgrounds now come from four individual edits of countryside.webp.

(dest/'boxes').mkdir(exist_ok=True)
atlas=Image.open(source/'exec-dd411683-606e-4d39-b485-37e708e59f18.png').convert('RGBA')
for i,name in enumerate(['rose','amber','ice']):
    sprite(cell(atlas,i,3,1),720,12).save(dest/'boxes'/f'{name}.webp',quality=85,method=6)

atlas=Image.open(source/'exec-5208a442-df88-4fa0-8b36-85dc0848f73a.png').convert('RGBA')
for i,name in enumerate(['settings','shop','video','gift','skin','background','box','check','lock','double','rescue','vibrate']):
    sprite(cell(atlas,i,4,3),96,6).save(dest/'ui'/f'icon-{name}.webp',quality=85,method=6)
print('Exported 55 characters, 4 large fruits, 3 boxes and legacy icon sources.')
from refresh_visual_assets import refresh
refresh()
