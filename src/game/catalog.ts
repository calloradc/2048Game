import { t, localizedProperty } from '../i18n';
import { asset, FRUIT_NAMES, fruitAsset } from './fruits';
import { PRICE_MULTIPLIER } from './economy';

export type Category = 'skins'|'backgrounds'|'boxes';
export interface ShopItem {id:string;key:string;category:Category;name:string;description:string;price:number;videos:number;exclusive?:boolean;bundle?:string}
const items=(category:Category,rows:[string,string,string,number,number][]):ShopItem[]=>rows.map(([id,name,description,price,videos])=>({id,key:`${category}:${id}`,category,name,description,price:price*PRICE_MULTIPLIER,videos}));
export const CATALOG:Record<Category,ShopItem[]>={
  skins:items('skins',[
    ['fruit','Фруктовая семья','11 сочных фруктовых кубиков',0,0],
    ['fuzzies','Шушистики','11 пушистых малышей',180,3],
    ['sushi','Суши-пати','Роллы, рис и немного кавая',240,3],
    ['vegetables','Весёлый огород','11 кубиков прямо с грядки',280,3],
    ['fastfood','Вкусный переполох','Бургеры, вафли и лимонад',360,4],
    ['crystals','Кристаллики','11 сияющих драгоценностей',480,4],
    ['candies','Конфетти','11 конфетных кубиков',320,3],
    ['bakery','Тёплая пекарня','Булочки, пирожные и хрустящие вафли',380,4],
    ['balls','Прыг-скок','11 мягких спортивных мячиков',340,3],
  ]),
  backgrounds:items('backgrounds',[
    ['meadow','Тёплый луг','Природа и деревянный стол',0,0],
    ['sunset','Сакура на закате','Тёплое небо и розовые лепестки',120,2],
    ['moonlight','Лунный сад','Звёзды и тихая бирюзовая ночь',180,3],
    ['candy','Сладкие холмы','Маленькая страна сладостей',220,3],
    ['alpine','Снежные вершины','Горное озеро и зимнее солнце',260,3],
    ['lagoon','Лазурная лагуна','Пальмы, острова и тихое море',280,3],
  ]),
  boxes:items('boxes',[
    ['glass','Чистое стекло','Классика со звонким блеском',0,0],
    ['rose','Розовый кварц','Фарфор и цветущие веточки сакуры',150,2],
    ['amber','Медовый янтарь','Деревянные соты и капельки мёда',200,3],
    ['ice','Ледяной блеск','Грани ледника и морозные узоры',260,3],
    ['bamboo','Бамбуковый дзен','Бамбук, зелёные листья и чистое стекло',240,3],
    ['arcade','Неоновая аркада','Яркие пиксели и игровой автомат',320,4],
  ]),
};
CATALOG.skins.push({id:'mochi',key:'skins:mochi',category:'skins',name:'Лунные моти',description:'11 маленьких хранителей сладких снов',price:0,videos:0,exclusive:true});
CATALOG.backgrounds.push({id:'aurora',key:'backgrounds:aurora',category:'backgrounds',name:'Сияющий сад',description:'Северное сияние и лунные цветы',price:0,videos:0,exclusive:true});
CATALOG.boxes.push({id:'lunar',key:'boxes:lunar',category:'boxes',name:'Лунное стекло',description:'Перламутровый бокс со звёздным блеском',price:0,videos:0,exclusive:true});
CATALOG.skins.push({id:'pillows',key:'skins:pillows',category:'skins',name:'Сонные подушки',description:'11 мягких хранителей уютных снов',price:0,videos:0,exclusive:true});
CATALOG.boxes.push({id:'cloud',key:'boxes:cloud',category:'boxes',name:'Облачный сон',description:'Жемчужная оправа с маленькими облаками',price:0,videos:0,exclusive:true});
for(const [category,name,description,price] of [
  ['skins','Космические сладости','11 звёздных конфет только в наборе',2600],
  ['backgrounds','Звёздная кондитерская','Сладкая галактика с парящими островами',1800],
  ['boxes','Орбитальный бокс','Звёздные самоцветы и золотые орбиты',2100],
] as [Category,string,string,number][]){CATALOG[category].push({id:'cosmos',key:`${category}:cosmos`,category,name,description,price,videos:0,exclusive:true,bundle:'cosmic'});}
export const ALL_ITEMS=Object.values(CATALOG).flat();
ALL_ITEMS.forEach(item=>{localizedProperty(item,'name');localizedProperty(item,'description');});
export const STARTERS:Record<Category,string>={skins:'fruit',backgrounds:'meadow',boxes:'glass'};
export const itemByKey=(key:string)=>ALL_ITEMS.find(item=>item.key===key);
export const backgroundAsset=(id:string)=>asset(id==='meadow'?'countryside.webp':`backgrounds/${id}.webp`);
export const wideBackgroundAsset=(id:string)=>asset(`backgrounds/${id}-wide.webp`);
export const boxAsset=(id:string)=>asset(`boxes/tall-${id}.webp`);
const skinNames:Record<string,string[]>={
  fruit:FRUIT_NAMES,
  fuzzies:['Пушик','Мятушка','Солнышко','Лилу','Облачко','Лисёнок','Зайчик','Совушка','Мишутка','Радужик','Лёвушка'],
  sushi:['Каппа','Лосось','Тунец','Авокадо','Тамаго','Нигири','Креветка','Онигири','Овощной','Икура','Делюкс'],
  vegetables:['Томат','Морковка','Огурчик','Свёкла','Перчик','Брокколи','Баклажан','Лучок','Кукуруза','Тыква','Капуста'],
  fastfood:['Картошка','Тостик','Бургер','Пицца','Наггетс','Лимонад','Тако','Вафля','Брауни','Мороженка','Дабл-бургер'],
  crystals:['Кварц','Бирюза','Янтарь','Аметист','Изумруд','Сапфир','Цитрин','Рубин','Опал','Обсидиан','Алмаз'],
  mochi:['Мятный сон','Соня','Звёздочка','Лунушка','Облачко','Лиловый сон','Розовый сон','Льдинка','Сияш','Аврора','Лунный король'],
  candies:['Малинка','Мятный леденец','Лимонка','Бонбон','Желейка','Карамелька','Зефирка','Ириска','Пралинка','Нуга','Радужная конфета'],
  bakery:['Печенька','Булочка','Коричный тост','Пирожное','Матча','Маффин','Бисквит','Мильфей','Брауни','Вафелька','Праздничный торт'],
  balls:['Попрыгун','Дворовый','Теннисик','Воздушик','Футболик','Волейболик','Пляжик','Пружинка','Баскетик','Поролончик','Радужный мяч'],
  pillows:['Мятный сон','Дрёма','Солнечная','Лунная','Лоскутная','Бархатная','Сердечная','Бантик','Снежная','Радужная','Звёздная'],
  cosmos:['Кометка','Туманность','Звёздочка','Лунная конфета','Галактика','Планетка','Метеорчик','Звёздная пыль','Жемчужинка','Аврора','Король галактики'],
};
export const SKIN_NAMES=new Proxy(skinNames,{get:(target,key:string)=>target[key]?.map(name=>t(name))});
export const itemPreview=(item:ShopItem)=>item.category==='skins'?fruitAsset(5,item.id):item.category==='boxes'?boxAsset(item.id):backgroundAsset(item.id);
