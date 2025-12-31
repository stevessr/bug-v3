// --- 配置 ---
export const CONFIG = {
  MAX_USERS: 5,
  SIDEBAR_WIDTH: '300px',
  REFRESH_INTERVAL_MS: 60 * 1000,
  LOG_LIMIT_PER_USER: 10,
  HOST: 'https://linux.do'
}

// 颜色定义
export const nameColors = [
  'var(--gold)', // 用户自己
  'var(--tertiary)', // 关注用户 1
  'var(--love)', // 关注用户 2
  '#4d5ef7',
  '#c77dff',
  '#00ff88',
  '#f87ecaff'
]

// 类别定义
export const categoryColors: Record<string, string> = {
  开发调优: '#32c3c3',
  国产替代: '#D12C25',
  资源荟萃: '#12A89D',
  网盘资源: '#16b176',
  文档共建: '#9cb6c4',
  跳蚤市场: '#ED207B',
  非我莫属: '#a8c6fe',
  读书成诗: '#e0d900',
  扬帆起航: '#ff9838',
  前沿快讯: '#BB8FCE',
  网络记忆: '#F7941D',
  福利羊毛: '#E45735',
  搞七捻三: '#3AB54A',
  社区孵化: '#ffbb00',
  运营反馈: '#808281',
  深海幽域: '#45B7D1',
  未分区: '#9e9e9e',
  积分乐园: '#fcca44',
  人工智能: '#00d4ff',
  软件分享: '#4dabf7'
}

export const categoryMap = new Map<number, string>()
const category_dict: Record<string, number[]> = {
  开发调优: [4, 20, 31, 88],
  国产替代: [98, 99, 100, 101],
  深海幽域: [45, 57, 58, 59],
  资源荟萃: [14, 83, 84, 85],
  网盘资源: [94, 95, 96, 97],
  文档共建: [42, 75, 76, 77],
  非我莫属: [27, 72, 73, 74],
  读书成诗: [32, 69, 70, 71],
  前沿快讯: [34, 78, 79, 80],
  网络记忆: [92],
  福利羊毛: [36, 60, 61, 62],
  搞七捻三: [11, 35, 89, 21],
  社区孵化: [102, 103, 104, 105],
  跳蚤市场: [10, 13, 81, 82],
  运营反馈: [2, 15, 16, 27],
  扬帆起航: [46, 66, 67, 68],
  积分乐园: [106, 107, 108, 109]
}

for (const name in category_dict) {
  category_dict[name].forEach(id => categoryMap.set(id, name))
}
