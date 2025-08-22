import { useEmojiStore } from '../../stores/emojiStore';
import type { EmojiGroup } from '../../types/emoji';

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
  // - a markdown string containing image links like: ![alt](upload://abc.webp) ...
  //    in that case we'll parse the markdown and convert to an items array
  if (typeof payload === 'string') {
    const md = payload as string;
    const mdItems: any[] = [];
    // match markdown image syntax: ![alt](url "title")
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null = null;
    while ((match = re.exec(md)) !== null) {
      const alt = (match[1] || '').trim();
      let url = (match[2] || '').trim();
      // strip optional title after space inside parentheses: (url "title")
      // take only the first token which should be the url
      url = url.split(/\s+/)[0].replace(/^['"]|['"]$/g, '').trim();
      const name = alt.split('|')[0].trim() || decodeURIComponent((url.split('/').pop() || '').split('?')[0]);
      mdItems.push({ name, url });
    }
    if (mdItems.length > 0) {
      payload = mdItems;
    }
  }
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
          name: emoji.name || emoji.alt || '\u672a\u547d\u540d',
          url: emoji.url || emoji.src,
        };
        store.addEmojiWithoutSave(targetGroupId, emojiData);
      });
    } else {
          const groupMap = new Map<string, string>();
          store.groups.forEach((g: EmojiGroup) => {
            if (g && g.name && g.id) groupMap.set(g.name, g.id);
          });

      items.forEach((emoji) => {
        // item.groupId might be either a group id or a group name depending on source
        const rawGroup = emoji.groupId || emoji.group || inferredGroupName || '\u672a\u5206\u7ec4';
        const groupName = rawGroup.toString();
        let targetId = groupMap.get(groupName);
        if (!targetId) {
          const created = store.createGroupWithoutSave(groupName, '\ud83d\udcc1');
          if (created && created.id) {
            targetId = created.id;
            groupMap.set(groupName, targetId);
          } else {
            targetId = store.groups[0]?.id || 'nachoneko';
            if (targetId) groupMap.set(groupName, targetId);
          }
        }
        const emojiData = {
          packet: Number.isInteger(emoji.packet) ? emoji.packet : Date.now() + Math.floor(Math.random() * 1000),
          name: emoji.name || emoji.alt || '\u672a\u547d\u540d',
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
