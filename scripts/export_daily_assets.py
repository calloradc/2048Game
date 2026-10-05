"""Export the generated daily collection and icon, preserving their aspect ratios."""
from collections import deque
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('/workspace/generated_images')
FILES={
 'basket':'exec-734330e6-37f4-4718-a481-76997fba18e2.png',
 'mochi':'exec-f68e2ceb-dbe7-4221-8daa-eadee8aa72e2.png',
 'aurora':'exec-74c116a5-ca02-4fff-8058-a6660abc79a1.png',
 'lunar':'exec-6d6c20d9-fbab-4f51-89c1-33daa7ae2010.png',
}

def clean_cell(image):
    # Drop isolated alpha speckles from atlas gutters, preserving nearby ornaments.
    alpha=image.getchannel('A');w,h=image.size;values=alpha.tobytes();seen=bytearray(w*h);groups=[]
    for start,value in enumerate(values):
        if value<32 or seen[start]:continue
        queue=deque([start]);seen[start]=1;group=[]
        while queue:
            pos=queue.popleft();group.append(pos);x=pos%w;y=pos//w
            for neighbour in ([pos-1] if x else [])+([pos+1] if x<w-1 else [])+([pos-w] if y else [])+([pos+w] if y<h-1 else []):
                if not seen[neighbour] and values[neighbour]>=32:seen[neighbour]=1;queue.append(neighbour)
        groups.append(group)
    largest=max(groups,key=len);xs=[p%w for p in largest];ys=[p//w for p in largest]
    bounds=(min(xs)-12,min(ys)-12,max(xs)+12,max(ys)+12);kept=bytearray(w*h)
    for group in groups:
        if len(group)<max(20,len(largest)*.003):continue
        if not any(bounds[0]<=p%w<=bounds[2] and bounds[1]<=p//w<=bounds[3] for p in group):continue
        for pos in group:kept[pos]=values[pos]
    image.putalpha(Image.frombytes('L',(w,h),bytes(kept)))
    return image

def fit(image,size,padding):
    bounds=image.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
    image=image.crop(bounds);image.thumbnail((size-padding*2,size-padding*2),Image.Resampling.LANCZOS)
    result=Image.new('RGBA',(size,size));result.alpha_composite(image,((size-image.width)//2,(size-image.height)//2));return result

def body(image):
    alpha=image.getchannel('A');bbox=alpha.point(lambda v:255 if v>150 else 0).getbbox();rows=[]
    for y in range(round(bbox[1]+(bbox[3]-bbox[1])*.63),round(bbox[1]+(bbox[3]-bbox[1])*.85)):
        xs=[x for x in range(256) if alpha.getpixel((x,y))>150]
        if xs:rows.append((xs[0],xs[-1]+1))
    left=sorted(r[0] for r in rows)[len(rows)//2];right=sorted(r[1] for r in rows)[len(rows)//2]
    broad=[y for y in range(bbox[1],bbox[3]) if sum(alpha.getpixel((x,y))>150 for x in range(left,right))>(right-left)*.45]
    bottom=min(bbox[3],broad[-1]+2);return [left,bottom-(right-left),right,bottom]

assets=ROOT/'public/assets'
fit(Image.open(SOURCE/FILES['basket']).convert('RGBA'),128,5).save(assets/'ui/generated/icon-shop.webp',quality=94,method=6)
atlas=Image.open(SOURCE/FILES['mochi']).convert('RGBA');w,h=atlas.size
folder=assets/'skins/mochi';folder.mkdir(parents=True,exist_ok=True);rects=[]
preview=Image.new('RGB',(11*128,152),'#ebe8fa');draw=ImageDraw.Draw(preview)
for i in range(11):
    x,y=i%4,i//4
    tile=atlas.crop((round(x*w/4),round(y*h/3),round((x+1)*w/4),round((y+1)*h/3)))
    tile=fit(clean_cell(tile),256,6);tile.save(folder/f'{i}.webp',quality=93,method=6)
    rect=body(tile);rects.append(rect);thumb=tile.resize((128,128));preview.paste(thumb,(i*128,20),thumb)
    draw.rectangle([i*128+rect[0]/2,20+rect[1]/2,i*128+rect[2]/2,20+rect[3]/2],outline='#ed607a')
metadata_path=ROOT/'src/game/generatedBodies.json';metadata=json.loads(metadata_path.read_text());metadata['mochi']=rects;metadata_path.write_text(json.dumps(metadata,indent=2)+'\n')
preview.save('/workspace/scratch/mochi-bodies.jpg')
background=Image.open(SOURCE/FILES['aurora']).convert('RGB');background.thumbnail((1200,1800),Image.Resampling.LANCZOS)
background.save(assets/'backgrounds/aurora.webp',quality=91,method=6)
fit(Image.open(SOURCE/FILES['lunar']).convert('RGBA'),720,12).save(assets/'boxes/lunar.webp',quality=93,method=6)
print('Exported basket, 11 moon mochi sprites with body bounds, aurora scene and lunar box.')
