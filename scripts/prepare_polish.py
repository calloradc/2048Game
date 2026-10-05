"""Export the hanging sign and compact texture particles, preserving originals."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=Path('/workspace/generated_images');dest=root/'public/assets'
(dest/'particles').mkdir(exist_ok=True)
def trim(im):
 bbox=im.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
 return im.crop(bbox) if bbox else im
sign=trim(Image.open(source/'exec-40223f9a-6808-4f50-976e-60e7f59786ba.png').convert('RGBA'))
sign.thumbnail((1100,400),Image.Resampling.LANCZOS);sign.save(dest/'wood-sign.webp',quality=85,method=6)
atlas=Image.open(source/'exec-f0433a3c-446b-4179-8c7f-80c8d174dde5.png').convert('RGBA');w,h=atlas.size
for i in range(12):
 col,row=i%4,i//4
 tile=trim(atlas.crop((round(col*w/4),round(row*h/3),round((col+1)*w/4),round((row+1)*h/3))))
 tile.thumbnail((90,90),Image.Resampling.LANCZOS)
 sprite=Image.new('RGBA',(96,96));sprite.alpha_composite(tile,((96-tile.width)//2,(96-tile.height)//2))
 sprite.save(dest/'particles'/f'{i}.webp',quality=85,method=6)
print('Exported hanging sign and 12 particle textures.')
