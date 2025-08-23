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
  displayUrl?: string; // Optional display URL, different from output URL
  width?: number;
  height?: number;
  groupId: string;
  // Favorites usage tracking fields
  usageCount?: number;
  lastUsed?: number; // timestamp
  addedAt?: number; // timestamp when first added to favorites
}

export interface AppSettings {
  imageScale: number; // 5 to 150
  defaultGroup: string;
  showSearchBar: boolean;
  gridColumns: number; // 2 to 8
  outputFormat: 'markdown' | 'html'; // 输出格式选择
  forceMobileMode?: boolean; // 强制移动模式
  lastModified?: number; // timestamp for sync comparison
}

export interface DefaultEmojiData {
  groups: EmojiGroup[];
  settings: AppSettings;
}

// Emoji validation function
export function validateEmojiArray(data: any[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    return { valid: false, errors: ["数据必须是数组格式"] };
  }

  if (data.length === 0) {
    return { valid: false, errors: ["数组不能为空"] };
  }

  data.forEach((emoji, index) => {
    const prefix = `第${index + 1}个表情`;

    // 检查必需字段
    if (!emoji.id || typeof emoji.id !== "string") {
      errors.push(`${prefix}: id字段必须是非空字符串`);
    }

    if (!emoji.name || typeof emoji.name !== "string") {
      errors.push(`${prefix}: name字段必须是非空字符串`);
    }

    if (!emoji.url || typeof emoji.url !== "string") {
      errors.push(`${prefix}: url字段必须是非空字符串`);
    } else if (!isValidUrl(emoji.url)) {
      errors.push(`${prefix}: url格式无效`);
    }

    if (!emoji.groupId || typeof emoji.groupId !== "string") {
      errors.push(`${prefix}: groupId字段必须是非空字符串`);
    }

    // 检查packet字段
    if (
      emoji.packet !== undefined &&
      (!Number.isInteger(emoji.packet) || emoji.packet < 0)
    ) {
      errors.push(`${prefix}: packet字段必须是非负整数`);
    }

    // 检查可选的width和height字段
    if (
      emoji.width !== undefined &&
      (!Number.isInteger(emoji.width) || emoji.width <= 0)
    ) {
      errors.push(`${prefix}: width字段必须是正整数`);
    }

    if (
      emoji.height !== undefined &&
      (!Number.isInteger(emoji.height) || emoji.height <= 0)
    ) {
      errors.push(`${prefix}: height字段必须是正整数`);
    }
  });

  return { valid: errors.length === 0, errors };
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Default emoji data loaded from JSON
import { defaultEmojiGroups } from "./defaultEmojiGroups";

const defaultSettings: AppSettings = {
  imageScale: 100,
  defaultGroup: "nachoneko",
  showSearchBar: true,
  gridColumns: 4,
  outputFormat: "markdown", // 默认使用markdown格式
  forceMobileMode: false, // 默认不强制移动模式
};

export { defaultEmojiGroups, defaultSettings };

// Legacy support - export flat emoji list for backward compatibility
export const defaultEmojiSet = defaultEmojiGroups
  .flatMap((group) => group.emojis)
  .map((emoji) => ({
    packet: emoji.packet,
    name: emoji.name,
    url: emoji.url,
    width: emoji.width,
    height: emoji.height,
  }));
