export const FRUITS = [
  { name: 'Вишня', value: 2, size: 31, color: '#e93d50' },
  { name: 'Клубника', value: 4, size: 38, color: '#f25866' },
  { name: 'Мандарин', value: 8, size: 46, color: '#ff972f' },
  { name: 'Лимон', value: 16, size: 55, color: '#f5d841' },
  { name: 'Киви', value: 32, size: 65, color: '#9bd445' },
  { name: 'Черника', value: 64, size: 76, color: '#8473df' },
  { name: 'Персик', value: 128, size: 88, color: '#f99b8b' },
  { name: 'Питайя', value: 256, size: 101, color: '#f27fbb' },
  { name: 'Кокос', value: 512, size: 115, color: '#c09a75' },
  { name: 'Ананас', value: 1024, size: 131, color: '#e9c44b' },
  { name: 'Арбуз', value: 2048, size: 149, color: '#77be58' },
] as const;

export const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;
export const fruitAsset = (level: number,skin='fruit') => asset(skin==='fruit'?`fruit-${level}.webp`:`skins/${skin}/${level}.webp`);

export function randomDrop(random = Math.random): number {
  const n = random();
  return n < 0.4 ? 0 : n < 0.73 ? 1 : n < 0.93 ? 2 : 3;
}
