// Shared mutable state for content scripts
export interface AppSettings {
  imageScale: number;
  gridColumns: number;
  outputFormat: 'markdown' | 'html'; // 输出格式选择
  forceMobileMode?: boolean; // 强制移动模式
}

export const cachedState: {
  emojiGroups: any[];
  settings: AppSettings;
} = {
  emojiGroups: [],
  settings: { imageScale: 30, gridColumns: 4, outputFormat: "markdown", forceMobileMode: false },
};
