// 颜色自动补全数据：[co 触发的 [color=...][/color] 补全菜单所用
// 经典颜色集合（CSS 命名色精选），全部以规范化小写 #rrggbb 存储

export interface ClassicColor {
  name: string // 英文关键字（可用于输入过滤，如 [cred -> red）
  hex: string // 规范化小写 #rrggbb
  zh: string // 中文名称（菜单展示用）
}

export const CLASSIC_COLORS: ClassicColor[] = [
  { name: 'black', hex: '#000000', zh: '黑色' },
  { name: 'white', hex: '#ffffff', zh: '白色' },
  { name: 'red', hex: '#ff0000', zh: '红色' },
  { name: 'crimson', hex: '#dc143c', zh: '深红' },
  { name: 'orangered', hex: '#ff4500', zh: '橙红' },
  { name: 'coral', hex: '#ff7f50', zh: '珊瑚红' },
  { name: 'salmon', hex: '#fa8072', zh: '橙红' },
  { name: 'orange', hex: '#ffa500', zh: '橙色' },
  { name: 'gold', hex: '#ffd700', zh: '金色' },
  { name: 'yellow', hex: '#ffff00', zh: '黄色' },
  { name: 'khaki', hex: '#f0e68c', zh: '黄褐色' },
  { name: 'green', hex: '#008000', zh: '绿色' },
  { name: 'lime', hex: '#00ff00', zh: '青柠色' },
  { name: 'olive', hex: '#808000', zh: '橄榄色' },
  { name: 'teal', hex: '#008080', zh: '鸭绿色' },
  { name: 'cyan', hex: '#00ffff', zh: '青色' },
  { name: 'skyblue', hex: '#87ceeb', zh: '天蓝色' },
  { name: 'lightblue', hex: '#add8e6', zh: '浅蓝色' },
  { name: 'blue', hex: '#0000ff', zh: '蓝色' },
  { name: 'navy', hex: '#000080', zh: '藏青色' },
  { name: 'indigo', hex: '#4b0082', zh: '靛蓝色' },
  { name: 'purple', hex: '#800080', zh: '紫色' },
  { name: 'violet', hex: '#ee82ee', zh: '紫罗兰' },
  { name: 'magenta', hex: '#ff00ff', zh: '品红' },
  { name: 'pink', hex: '#ffc0cb', zh: '粉色' },
  { name: 'hotpink', hex: '#ff69b4', zh: '亮粉色' },
  { name: 'brown', hex: '#a52a2a', zh: '棕色' },
  { name: 'chocolate', hex: '#d2691e', zh: '巧克力色' },
  { name: 'silver', hex: '#c0c0c0', zh: '银色' },
  { name: 'dimgray', hex: '#696969', zh: '暗灰色' }
]

// 菜单顶部「快捷插入」默认给出的经典颜色（按使用频率挑选）
export const QUICK_INSERT_HEXES: string[] = [
  '#ff0000', // 红
  '#ff7f50', // 珊瑚红
  '#ffa500', // 橙
  '#ffd700', // 金
  '#ffff00', // 黄
  '#00ff00', // 青柠
  '#00ffff', // 青
  '#0000ff', // 蓝
  '#800080', // 紫
  '#ff69b4', // 亮粉
  '#000000', // 黑
  '#ffffff' // 白
]

// 记录最近使用的颜色数量上限
export const MAX_RECENT_COLORS = 100
