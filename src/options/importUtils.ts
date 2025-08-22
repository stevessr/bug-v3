import { useEmojiStore } from '../stores/emojiStore';

export async function importConfigurationToStore(config: any) {
  const store = useEmojiStore();
  // simple validation
  if (!config) throw new Error('empty config');
  store.importConfiguration(config);
}

export async function importEmojisToStore(payload: any, targetGroupId?: string) {
  // payload can be either:
  // - an array of emoji items
  // - an object: { exportedAt, group: { id, name, ... }, emojis: [...] }
  const store = useEmojiStore();

  let items: any[] = [];
  let inferredGroupName: string | undefined;

  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && Array.isArray(payload.emojis)) {
    items = payload.emojis;
    // prefer group.name, fallback to group.id
    inferredGroupName = (payload.group && (payload.group.name || payload.group.id))?.toString();
  } else {
    throw new Error('items must be array or object with emojis[]');
  }

  store.beginBatch();
  try {
    if (targetGroupId) {
      items.forEach((emoji) => {
        const emojiData = {
          packet: Number.isInteger(emoji.packet) ? emoji.packet : Date.now() + Math.floor(Math.random() * 1000),
          name: emoji.name || emoji.alt || '未命名',
          url: emoji.url || emoji.src,
        };
        store.addEmojiWithoutSave(targetGroupId, emojiData);
      });
    } else {
      const groupMap = new Map<string, string>();
      store.groups.forEach((g) => groupMap.set(g.name, g.id));

      items.forEach((emoji) => {
        // item.groupId might be either a group id or a group name depending on source
        const rawGroup = emoji.groupId || emoji.group || inferredGroupName || '未分组';
        const groupName = rawGroup.toString();
        let targetId = groupMap.get(groupName);
        if (!targetId) {
          const created = store.createGroupWithoutSave(groupName, '📁');
          if (created) {
            targetId = created.id;
            groupMap.set(groupName, targetId);
          } else {
            targetId = store.groups[0]?.id || 'nachoneko';
          }
        }
        const emojiData = {
          packet: Number.isInteger(emoji.packet) ? emoji.packet : Date.now() + Math.floor(Math.random() * 1000),
          name: emoji.name || emoji.alt || '未命名',
          url: emoji.url || emoji.src,
        };
        if (targetId) store.addEmojiWithoutSave(targetId, emojiData);
      });
    }

    await store.saveData();
  } finally {
    await store.endBatch();
  }
}
