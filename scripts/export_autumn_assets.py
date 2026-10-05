"""Export generated artwork without changing proportions; measure square body UVs.

Keep source PNGs in generated_images. autumn-assets.json records every separate
box/background source and each 11-character atlas. Run after generation.
"""
import json
import sys
from pathlib import Path
from PIL import Image
from refresh_visual_assets import character_bounds, face_bounds

ROOT = Path(__file__).resolve().parents[1]

def sprite(image):
    image=image.convert('RGBA')
    image=image.crop(character_bounds(image))
    image.thumbnail((244,244),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(256,256))
    tile.alpha_composite(image,((256-image.width)//2,(256-image.height)//2))
    return tile

def export():
    sources=json.loads((ROOT/'scripts/autumn-assets.json').read_text())
    metadata=ROOT/'src/game/generatedBodies.json'
    bodies=json.loads(metadata.read_text())
    for key,source in sources.items():
        if len(sys.argv)>1 and key not in sys.argv[1:]:continue
        image=Image.open(source)
        if key.startswith('atlas/'):
            skin=key.split('/')[1];bodies[skin]=[]
            for level in range(11):
                x,y=level%4,level//4
                cell=image.crop((round(x*image.width/4),round(y*image.height/3),round((x+1)*image.width/4),round((y+1)*image.height/3)))
                tile=sprite(cell)
                destination=ROOT/f'public/assets/skins/{skin}/{level}.webp'
                destination.parent.mkdir(parents=True,exist_ok=True)
                tile.save(destination,quality=85,method=6)
                bodies[skin].append(face_bounds(tile))
            continue
        destination=ROOT/'public/assets'/('glass.webp' if key=='boxes/glass.webp' else key)
        destination.parent.mkdir(parents=True,exist_ok=True)
        if key.startswith('backgrounds/') or key.startswith('cover'):
            image=image.convert('RGB')
            image.thumbnail((1680,945) if '-wide.' in key else (1000,1500),Image.Resampling.LANCZOS)
            image.save(destination,quality=85,method=6)
        elif key.startswith('boxes/'):
            image=image.convert('RGBA');image=image.crop(character_bounds(image))
            image.thumbnail((712,712),Image.Resampling.LANCZOS)
            tile=Image.new('RGBA',(720,720));tile.alpha_composite(image,((720-image.width)//2,(720-image.height)//2))
            tile.save(destination,quality=85,method=6)
        else:
            tile=sprite(image);tile.save(destination,quality=85,method=6)
            _,skin,level=key.split('/')
            bodies[skin][int(Path(level).stem)]=face_bounds(tile)
    metadata.write_text(json.dumps(bodies,indent=2)+'\n')
    print(f'Exported {len(sources)} generated sources with measured sprite UVs.')

if __name__=='__main__':export()
