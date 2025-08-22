// Shared mutable state for content scripts
export interface AppSettings {
  imageScale: number;
  gridColumns: number;
}

export const cachedState: {
  emojiGroups: any[];
  settings: AppSettings;
} = {
  emojiGroups: [],
  settings: { imageScale: 30, gridColumns: 4 },
};
