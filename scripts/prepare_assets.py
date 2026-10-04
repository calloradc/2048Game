"""Cut generated atlases into deployable WebP sprites; leave originals untouched."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = Path('/workspace/generated_images')
dest = root / 'public/assets'
(dest/'ui').mkdir(parents=True,exist_ok=True)

def cut(image, rect):
    sprite = image.crop(rect).convert('RGBA')
    bounds = sprite.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    return sprite.crop(bounds) if bounds else sprite

fruits=Image.open(source/'exec-23220493-5444-44b9-83fa-6c32d4e9259f.png')
rects=[(0,0,362,350),(362,0,724,350),(724,0,1086,350),(1086,0,1448,350),
       (0,351,362,704),(362,351,724,704),(724,350,1086,704),(1086,350,1448,704),
       (0,710,362,1086),(362,697,724,1086),(724,710,1086,1086)]
for i,rect in enumerate(rects):
    sprite=cut(fruits,rect);sprite.thumbnail((244,244),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(256,256));tile.alpha_composite(sprite,((256-sprite.width)//2,(256-sprite.height)//2))
    tile.save(dest/f'fruit-{i}.webp',quality=91,method=6)
    if i==0:tile.resize((192,192),Image.Resampling.LANCZOS).save(dest/'icon.png')

icons=Image.open(source/'exec-375baf1d-67dc-4c86-8d5b-f63bf6330735.png')
names=['sound','mute','pause','restart','help','shake','hand','leaf','trophy','play','close','fullscreen','right','left','sparkle']
for i,name in enumerate(names):
    col,row=i%4,i//4;w,h=icons.size
    sprite=cut(icons,(round(col*w/4),round(row*h/4),round((col+1)*w/4),round((row+1)*h/4)))
    sprite.thumbnail((88,88),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(96,96));tile.alpha_composite(sprite,((96-sprite.width)//2,(96-sprite.height)//2))
    tile.save(dest/'ui'/f'icon-{name}.webp',quality=90,method=6)
print('Exported 11 frontal fruit sprites and 15 icons. UI surfaces use HTML/CSS.')
