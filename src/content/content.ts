// Entry point: 初始化模块并启动功能
import { initializeEmojiFeature } from './init';

console.log('[Emoji Extension] Content script loaded (entry)');

// 启动表情功能
initializeEmojiFeature();

export {};
