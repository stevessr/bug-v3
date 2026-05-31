export const TOUHOU_KEYWORDS = [
  'toushou',
  '东方',
  '古明地恋',
  '大妖精',
  '比那名居天子',
  '魂魄妖梦',
  '西行寺幽幽子',
  '八云紫',
  '博丽灵梦',
  '雾雨魔理沙',
  '十六夜咲夜',
  '爱丽丝·玛格特罗依德',
  '帕秋莉·诺蕾姬',
  '蕾米莉亚',
  '芙兰朵露',
  '珠手知由',
  '琪露诺',
  '斯卡蕾特',
  '铃仙'
]

export const MAGIC_GIRL_KEYWORDS = [
  'magic girl',
  '魔法少女',
  'まほうしょうじょ',
  '마법소녀',
  'mahou shoujo',
  '魔女',
  '魔裁',
  '魔法少女的魔女审判'
]

export function keyword_match(group:string[], str:string): boolean {
  return group.some(keyword => str.includes(keyword))
}