"""Export generated art as compact game assets; originals stay untouched."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = Path('/workspace/generated_images')
dest = root / 'public/assets'
image = Image.open(source / 'exec-93d3f5af-b38d-4191-b2cb-1b14d8f21d0b.png').convert('RGBA')
# Slightly uneven atlas rows are cut around the actual generated silhouettes.
rects = [(0,0,362,365),(362,0,724,365),(724,0,1087,365),(1087,0,1449,365),
         (0,368,362,704),(362,368,724,700),(724,368,1087,704),(1087,365,1449,704),
         (0,710,362,1086),(375,700,724,1086),(724,710,1087,1086)]
for i, rect in enumerate(rects):
    sprite = image.crop(rect)
    bounds = sprite.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    if bounds: sprite = sprite.crop(bounds)
    sprite.thumbnail((236,236), Image.Resampling.LANCZOS)
    tile = Image.new('RGBA',(256,256))
    tile.alpha_composite(sprite,((256-sprite.width)//2,(256-sprite.height)//2))
    tile.save(dest / f'fruit-{i}.webp',quality=90,method=6)
    if i == 0: tile.resize((192,192),Image.Resampling.LANCZOS).save(dest/'icon.png')
background = Image.open(source / 'exec-abf4aaa6-0a6a-4b51-b8b5-2f3f32cdf339.png').convert('RGB')
background.resize((900,1350),Image.Resampling.LANCZOS).save(dest/'countryside.webp',quality=86,method=6)
container = Image.open(source / 'exec-726e231c-69f0-4971-bcb7-e9b13e99fc4b.png').convert('RGBA')
container.resize((720,720),Image.Resampling.LANCZOS).save(dest/'glass.webp',quality=88,method=6)
print('Exported 11 fruit sprites, background, glass and icon.')
