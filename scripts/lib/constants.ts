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
  'Blue Lemon',
  '灵梦',
  '魔理沙',
  '咲夜',
  '蕾米莉亚',
  '芙兰朵露',
  '琪露诺',
  '铃仙',
  '幽幽子',
  '古明地觉'
]

export const MAGIC_GIRL_KEYWORDS = [
  'magic girl',
  '魔法少女',
  'まほうしょうじょ',
  '마법소녀',
  'mahou shoujo',
  '魔女',
  '魔裁',
  '魔法少女的魔女审判',
  '樱宇艾玛',
  '橘雪莉',
  '二阶堂希罗',
  '夏目安安'
]

export function keyword_match(group: string[], str: string): boolean {
  return group.some(keyword => str.toLowerCase().includes(keyword.toLowerCase()))
}

export const 术力口_KEYWORDS = [
  '术力口',
  'VOCALOID',
  'ボーカロイド',
  '初音',
  '重音',
  'fufu',
  'fu 师傅',
  '师傅'
]

export const galgame_keywords = [
  'galgame',
  'gal',
  'ATRI',
  '亚托莉',
  '米塔',
  '糖糖',
  'アマカノ',
  'あきゅー',
  '从雨'
]

export const mixed_keywords = [
  'Ciallo',
  'ciallo',
  '杂鱼喵喵喵',
  '神人',
  'L5Mon',
  'Twitch',
  'mis',
  '令时焥夏',
  '我也要死吗',
  '扒手手',
  '服务器',
  'husband',
  '软件工程师',
  '企鹅',
  '天哪'
]

export const test_keywords = ['test', 'demo', '大召唤术', '存档喵', '未分组']

export const OC_KEYWORDS = [
  'steve',
  'OC',
  'oc',
  'original character',
  '原创角色',
  'オリジナルキャラクター',
  '系敷敷',
  'kurmoe',
  'kipfel',
  '偷吃',
  '大猫一加一',
  '始皇酱',
  '小火切',
  '明前奶绿',
  '明风风风',
  '猪包',
  '真白花音',
  '铃牙茶茶',
  '風間白花',
  'hy2',
  '科研喵',
  '群友',
  'cadot'
]

export const game_keywords = [
  'game',
  '游戏',
  'ゲーム',
  '遊戲',
  '遊戯',
  'mon3tr',
  'by her side',
  'maimai',
  '明日方舟',
  '舞萌',
  '芙宁娜',
  '菲比'
]

export const anime_keywords = [
  'anime',
  '动画',
  'アニメ',
  '動畫',
  'アニメーション',
  '丸山彩',
  '纪念收藏集',
  'yauyau',
  '伊蕾娜',
  '佐藤益木',
  '千早爱音',
  '凑友希那',
  '凉宫春日的忧郁',
  '和奏瑞依',
  '安和昴',
  '平泽唯',
  '春也',
  '朝日六花',
  '永雏塔菲',
  '爱丽丝',
  '疯传箱子',
  '素世',
  '遥奈',
  '鳰原令王那',
  '黄',
  '墨提斯',
  '藤田言音',
  '素晴',
  '赏花爱音',
  '超天酱',
]

export const 超时空辉夜姬_KEYWORDS = [
  '超时空辉夜姬',
  '超时空',
  '辉夜姬'
]


