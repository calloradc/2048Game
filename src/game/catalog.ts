import { asset, FRUITS, fruitAsset } from './fruits';

export type Category = 'skins'|'backgrounds'|'boxes';
export interface ShopItem {id:string;key:string;category:Category;name:string;description:string;price:number;videos:number}
const items=(category:Category,rows:[string,string,string,number,number][]):ShopItem[]=>rows.map(([id,name,description,price,videos])=>({id,key:`${category}:${id}`,category,name,description,price,videos}));
export const CATALOG:Record<Category,ShopItem[]>={
  skins:items('skins',[
    ['fruit','Фруктовая семья','11 сочных фруктовых кубиков',0,0],
    ['fuzzies','Шушистики','11 пушистых малышей',180,3],
    ['sushi','Суши-пати','Роллы, рис и немного кавая',240,3],
    ['vegetables','Весёлый огород','11 кубиков прямо с грядки',280,3],
    ['fastfood','Вкусный переполох','Бургеры, вафли и лимонад',360,4],
    ['crystals','Кристаллики','11 сияющих драгоценностей',480,4],
  ]),
  backgrounds:items('backgrounds',[
    ['meadow','Тёплый луг','Природа и деревянный стол',0,0],
    ['sunset','Сакура на закате','Тёплое небо и розовые лепестки',120,2],
    ['moonlight','Лунный сад','Звёзды и тихая бирюзовая ночь',180,3],
    ['candy','Сладкие холмы','Маленькая страна сладостей',220,3],
  ]),
  boxes:items('boxes',[
    ['glass','Чистое стекло','Классика со звонким блеском',0,0],
    ['rose','Розовый кварц','Нежное розовое стекло',150,2],
    ['amber','Медовый янтарь','Золотистая тёплая оправа',200,3],
    ['ice','Ледяной блеск','Кристально-синий контейнер',260,3],
  ]),
};
export const ALL_ITEMS=Object.values(CATALOG).flat();
export const STARTERS:Record<Category,string>={skins:'fruit',backgrounds:'meadow',boxes:'glass'};
export const itemByKey=(key:string)=>ALL_ITEMS.find(item=>item.key===key);
export const backgroundAsset=(id:string)=>asset(id==='meadow'?'countryside.webp':`backgrounds/${id}.webp`);
export const boxAsset=(id:string)=>asset(id==='glass'?'glass.webp':`boxes/${id}.webp`);
export const SKIN_NAMES:Record<string,string[]>={
  fruit:FRUITS.map(f=>f.name),
  fuzzies:['Пушик','Мятушка','Солнышко','Лилу','Облачко','Лисёнок','Зайчик','Совушка','Мишутка','Радужик','Лёвушка'],
  sushi:['Каппа','Лосось','Тунец','Авокадо','Тамаго','Нигири','Креветка','Онигири','Овощной','Икура','Делюкс'],
  vegetables:['Томат','Морковка','Огурчик','Свёкла','Перчик','Брокколи','Баклажан','Лучок','Кукуруза','Тыква','Капуста'],
  fastfood:['Картошка','Тостик','Бургер','Пицца','Наггетс','Лимонад','Тако','Вафля','Брауни','Мороженка','Дабл-бургер'],
  crystals:['Кварц','Бирюза','Янтарь','Аметист','Изумруд','Сапфир','Цитрин','Рубин','Опал','Обсидиан','Алмаз'],
};
export const itemPreview=(item:ShopItem)=>item.category==='skins'?fruitAsset(5,item.id):item.category==='boxes'?boxAsset(item.id):backgroundAsset(item.id);
