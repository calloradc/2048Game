"""Export individually generated artwork and update the physical face UVs.

Original PNGs remain in generated_images. The manifest records one source per
background/sprite; backgrounds are never sliced from a shared atlas.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def character_bounds(image):
    # Measure the connected character, not scraps or isolated antialias pixels.
    alpha = image.getchannel('A')
    alpha.thumbnail((256, 256), Image.Resampling.LANCZOS)
    width, height = alpha.size
    values = list(alpha.get_flattened_data() if hasattr(alpha, 'get_flattened_data') else alpha.getdata())
    seen = bytearray(width * height)
    largest = []
    for start, value in enumerate(values):
        if value < 30 or seen[start]:
            continue
        queue, component = [start], []
        seen[start] = 1
        while queue:
            i = queue.pop()
            component.append(i)
            x, y = i % width, i // width
            neighbours = []
            if x: neighbours.append(i-1)
            if x+1 < width: neighbours.append(i+1)
            if y: neighbours.append(i-width)
            if y+1 < height: neighbours.append(i+width)
            for n in neighbours:
                if not seen[n] and values[n] >= 30:
                    seen[n] = 1
                    queue.append(n)
        if len(component) > len(largest):
            largest = component
    if not largest:
        raise ValueError('Character has no visible pixels')
    sx, sy = image.width/width, image.height/height
    return (max(0, int((min(i % width for i in largest)-1)*sx)),
            max(0, int((min(i // width for i in largest)-1)*sy)),
            min(image.width, int((max(i % width for i in largest)+2)*sx)),
            min(image.height, int((max(i // width for i in largest)+2)*sy)))

def face_bounds(tile):
    alpha = tile.getchannel('A')
    bbox = alpha.point(lambda a: 255 if a > 150 else 0).getbbox()
    rows = []
    for y in range(round(bbox[1]+(bbox[3]-bbox[1])*.48), round(bbox[1]+(bbox[3]-bbox[1])*.78)):
        xs = [x for x in range(256) if alpha.getpixel((x, y)) > 150]
        if xs: rows.append((xs[0], xs[-1]+1))
    left = sorted(row[0] for row in rows)[len(rows)//2]
    right = sorted(row[1] for row in rows)[len(rows)//2]
    broad = [y for y in range(bbox[1], bbox[3]) if sum(alpha.getpixel((x, y)) > 150 for x in range(left, right)) > (right-left)*.45]
    bottom = min(bbox[3], broad[-1]+3)
    return [left, bottom-(right-left), right, bottom]

def refresh():
    sources = json.loads((ROOT/'scripts/visual-assets.json').read_text())
    metadata_file = ROOT/'src/game/generatedBodies.json'
    bodies = json.loads(metadata_file.read_text())
    bodies.setdefault('fruitRepaired', {})
    for name, source in sources.items():
        destination = ROOT/'public/assets'/name
        destination.parent.mkdir(parents=True, exist_ok=True)
        image = Image.open(source)
        if name.startswith('backgrounds/'):
            image.convert('RGB').resize((900,1350),Image.Resampling.LANCZOS).save(destination,quality=85,method=6)
            continue
        image = image.convert('RGBA')
        image = image.crop(character_bounds(image))
        image.thumbnail((244,244),Image.Resampling.LANCZOS)
        tile = Image.new('RGBA',(256,256))
        tile.alpha_composite(image,((256-image.width)//2,(256-image.height)//2))
        tile.save(destination,quality=85,method=6)
        if name.startswith('skins/'):
            _, skin, level = name.split('/')
            bodies[skin][int(Path(level).stem)] = face_bounds(tile)
        else:
            level = name.removeprefix('fruit-').removesuffix('.webp')
            bodies['fruitRepaired'][level] = face_bounds(tile)
    metadata_file.write_text(json.dumps(bodies,indent=2)+'\n')
    print(f'Exported {len(sources)} individual visual assets and their face bounds.')

if __name__ == '__main__':
    refresh()
