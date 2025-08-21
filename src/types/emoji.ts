export interface EmojiGroup {
  id: string;
  name: string;
  icon: string;
  order: number;
  emojis: Emoji[];
}

export interface Emoji {
  id: string;
  packet: number;
  name: string;
  url: string;
  width?: number;
  height?: number;
  groupId: string;
}

export interface AppSettings {
  imageScale: number; // 5 to 150
  defaultGroup: string;
  showSearchBar: boolean;
  gridColumns: number; // 2 to 8
}

export const defaultEmojiGroups: EmojiGroup[] = [
  {
    id: 'favorites',
    name: '常用',
    icon: '⭐',
    order: 0,
    emojis: []
  },
  {
    id: 'nachoneko',
    name: 'Nachoneko表情包',
    icon: '🐈‍⬛',
    order: 1,
    emojis: [
      { id: 'neko-1', packet: 1, name: '瞌睡', url: 'https://linux.do/uploads/default/optimized/4X/5/9/f/59ffbc2c53dd2a07dc30d4368bd5c9e01ca57d80_2_490x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-2', packet: 2, name: '哭泣', url: 'https://linux.do/uploads/default/optimized/4X/5/d/9/5d932c05a642396335f632a370bd8d45463cf2e2_2_503x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-3', packet: 3, name: '疑问', url: 'https://linux.do/uploads/default/optimized/4X/f/a/a/faa5afe1749312bc4a326feff0eca6fb39355300_2_518x499.jpeg', groupId: 'nachoneko' },
      { id: 'neko-4', packet: 4, name: '干嘛', url: 'https://linux.do/uploads/default/optimized/4X/5/5/2/552f13479e7bff2ce047d11ad821da4963c467f2_2_500x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-5', packet: 5, name: '吃东西', url: 'https://linux.do/uploads/default/optimized/4X/0/d/1/0d125de02c201128bf6a3f78ff9450e48a3e27de_2_532x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-6', packet: 6, name: '是我', url: 'https://linux.do/uploads/default/optimized/4X/2/3/f/23fac94d8858a23cbd49879f2b037a2be020c87e_2_500x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-7', packet: 7, name: '玩吗', url: 'https://linux.do/uploads/default/optimized/4X/3/1/a/31a38450e22d42f9d4b683b190a40b9a94727681_2_493x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-8', packet: 8, name: '嘻嘻', url: 'https://linux.do/uploads/default/optimized/4X/6/a/3/6a3619da1dbb63cc0420fbf1f6f2316b5503ab09_2_413x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-9', packet: 9, name: '洗澡', url: 'https://linux.do/uploads/default/optimized/4X/e/1/4/e1429fd845288aa4c75e30829efe4696a1f4b1f9_2_636x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-11', packet: 11, name: '困了', url: 'https://linux.do/uploads/default/optimized/4X/7/f/4/7f4d50105aefec0efa80c498179a7d0901b54a7a_2_564x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-12', packet: 12, name: '我汗', url: 'https://linux.do/uploads/default/optimized/4X/8/a/b/8ab3b1fb6c7d990c9070e010f915fb237093f67f_2_490x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-13', packet: 13, name: '哇哦', url: 'https://linux.do/uploads/default/optimized/4X/2/9/c/29ce5a00273ba10ae9c1a8abf7a3b42abcccdd66_2_533x499.jpeg', groupId: 'nachoneko' },
      { id: 'neko-14', packet: 14, name: '无聊', url: 'https://linux.do/uploads/default/optimized/4X/1/0/6/1063e1803fa965cd1604bda0e6d7705376f9963f_2_500x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-15', packet: 15, name: '盯着', url: 'https://linux.do/uploads/default/optimized/4X/6/e/6/6e68786e64c4260746d02d2e308168b200185d7d_2_613x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-16', packet: 16, name: 'ok', url: 'https://linux.do/uploads/default/optimized/4X/1/a/b/1ab685b8f2948689a917aa1c0d7ce9bfa2ec48bd_2_594x500.jpeg', groupId: 'nachoneko' },
      { id: 'neko-17', packet: 17, name: '沉默', url: 'https://linux.do/uploads/default/optimized/4X/1/c/3/1c39b615e9ef831568ede182ecdec0e749bbd202_2_503x499.jpeg', groupId: 'nachoneko' },
      { id: 'neko-18', packet: 18, name: '开心', url: 'https://linux.do/uploads/default/optimized/4X/6/5/0/650110fc5845e915cf4aefec11e4a058f4aff731_2_500x500.png', groupId: 'nachoneko' },
      { id: 'neko-19', packet: 19, name: '睡觉', url: 'https://linux.do/uploads/default/optimized/4X/9/0/9/90957308d24a9c79257425ff0f8a14411b6aaad6_2_500x500.png', groupId: 'nachoneko' },
      { id: 'neko-20', packet: 20, name: '生气', url: 'https://linux.do/uploads/default/optimized/4X/8/1/9/81909951f915b3e969c93d433b9fd6935a431d9a_2_500x500.png', groupId: 'nachoneko' },
      { id: 'neko-21', packet: 21, name: '抱抱', url: 'https://linux.do/uploads/default/optimized/4X/2/5/6/256411726c9680d821da26ad699e7d2d574ab24c_2_500x500.png', groupId: 'nachoneko' }
    ]
  }
];

export const defaultSettings: AppSettings = {
  imageScale: 100,
  defaultGroup: 'nachoneko',
  showSearchBar: true,
  gridColumns: 4
};