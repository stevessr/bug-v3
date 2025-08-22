// Shared mutable state for content scripts
export interface AppSettings {
  imageScale: number;
  gridColumns: number;
  outputFormat: 'markdown' | 'html'; // 输出格式选择
}

export const cachedState: {
  emojiGroups: any[];
  settings: AppSettings;
} = {
  emojiGroups: [],
  settings: { imageScale: 30, gridColumns: 4, outputFormat: "markdown" },
};
