import { l as useEmojiStore } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
async function importConfigurationToStore(config) {
  const store = useEmojiStore();
  if (!config) throw new Error("empty config");
  store.importConfiguration(config);
}
async function importEmojisToStore(payload, targetGroupId) {
  var _a;
  if (typeof payload === "string") {
    const md = payload;
    const mdItems = [];
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match = null;
    while ((match = re.exec(md)) !== null) {
      const alt = (match[1] || "").trim();
      const urlPart = (match[2] || "").trim();
      const urlTokens = urlPart.split(/\s+/);
      const url = urlTokens[0].replace(/^['"]|['"]$/g, "").trim();
      let displayUrl;
      if (urlTokens.length > 1) {
        const titlePart = urlTokens.slice(1).join(" ").replace(/^['"]|['"]$/g, "").trim();
        if (titlePart.startsWith("http://") || titlePart.startsWith("https://")) {
          displayUrl = titlePart;
        }
      }
      const name = alt.split("|")[0].trim() || decodeURIComponent((url.split("/").pop() || "").split("?")[0]);
      const emojiData = { name, url };
      if (displayUrl) {
        emojiData.displayUrl = displayUrl;
      }
      mdItems.push(emojiData);
    }
    if (mdItems.length > 0) {
      payload = mdItems;
    }
  }
  const store = useEmojiStore();
  let items = [];
  let inferredGroupName;
  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && Array.isArray(payload.emojis)) {
    items = payload.emojis;
    inferredGroupName = (_a = payload.group && (payload.group.name || payload.group.id)) == null ? void 0 : _a.toString();
  } else {
    throw new Error("items must be array or object with emojis[]");
  }
  store.beginBatch();
  try {
    if (targetGroupId) {
      items.forEach((emoji) => {
        const emojiData = {
          packet: Number.isInteger(emoji.packet) ? emoji.packet : Date.now() + Math.floor(Math.random() * 1e3),
          name: emoji.name || emoji.alt || "未命名",
          url: emoji.url || emoji.src,
          ...emoji.displayUrl && { displayUrl: emoji.displayUrl }
        };
        store.addEmojiWithoutSave(targetGroupId, emojiData);
      });
    } else {
      const groupMap = /* @__PURE__ */ new Map();
      store.groups.forEach((g) => {
        if (g && g.name && g.id) groupMap.set(g.name, g.id);
      });
      items.forEach((emoji) => {
        var _a2;
        const rawGroup = emoji.groupId || emoji.group || inferredGroupName || "未分组";
        const groupName = rawGroup.toString();
        let targetId = groupMap.get(groupName);
        if (!targetId) {
          const created = store.createGroupWithoutSave(groupName, "📁");
          if (created && created.id) {
            targetId = created.id;
            groupMap.set(groupName, targetId);
          } else {
            targetId = ((_a2 = store.groups[0]) == null ? void 0 : _a2.id) || "nachoneko";
            if (targetId) groupMap.set(groupName, targetId);
          }
        }
        const emojiData = {
          packet: Number.isInteger(emoji.packet) ? emoji.packet : Date.now() + Math.floor(Math.random() * 1e3),
          name: emoji.name || emoji.alt || "未命名",
          url: emoji.url || emoji.src,
          ...emoji.displayUrl && { displayUrl: emoji.displayUrl }
        };
        if (targetId) store.addEmojiWithoutSave(targetId, emojiData);
      });
    }
    await store.saveData();
  } finally {
    await store.endBatch();
  }
}
async function addItemsToStore(store, items, targetGroupId, inferredGroupName) {
  store.beginBatch();
  try {
    if (targetGroupId) ;
    else {
      const groupMap = /* @__PURE__ */ new Map();
      store.groups.forEach((g) => {
        if (g && g.name && g.id) groupMap.set(g.name, g.id);
      });
      items.forEach((emoji) => {
        var _a;
        const rawGroup = emoji.groupId || emoji.group || inferredGroupName || "未分组";
        const groupName = rawGroup.toString();
        let targetId = groupMap.get(groupName);
        if (!targetId) {
          const created = store.createGroupWithoutSave(groupName, "📁");
          if (created && created.id) {
            targetId = created.id;
            groupMap.set(groupName, targetId);
          } else {
            targetId = ((_a = store.groups[0]) == null ? void 0 : _a.id) || "nachoneko";
            if (targetId) groupMap.set(groupName, targetId);
          }
        }
        const emojiData = {
          packet: Number.isInteger(emoji.packet) ? emoji.packet : Date.now() + Math.floor(Math.random() * 1e3),
          name: emoji.name || emoji.alt || "未命名",
          url: emoji.url || emoji.src,
          ...emoji.displayUrl && { displayUrl: emoji.displayUrl }
        };
        if (targetId) store.addEmojiWithoutSave(targetId, emojiData);
      });
    }
    await store.saveData();
  } finally {
    await store.endBatch();
  }
}
async function importBilibiliToStore(payload, targetGroupId) {
  var _a, _b;
  const store = useEmojiStore();
  if (!payload || !payload.data || !Array.isArray(payload.data.packages)) {
    throw new Error("invalid bilibili payload");
  }
  const packages = payload.data.packages;
  const converted = [];
  for (const pkg of packages) {
    const groupName = ((_a = pkg && (pkg.text || pkg.label || pkg.id)) == null ? void 0 : _a.toString()) || void 0;
    const emotes = Array.isArray(pkg.emote) ? pkg.emote : [];
    for (const e of emotes) {
      const name = ((_b = e == null ? void 0 : e.meta) == null ? void 0 : _b.alias) || (e == null ? void 0 : e.text) || ((e == null ? void 0 : e.id) ? String(e.id) : void 0) || "未命名";
      const url = (e == null ? void 0 : e.url) || (e == null ? void 0 : e.file) || (e == null ? void 0 : e.src);
      if (!url) continue;
      converted.push({
        name,
        url,
        packet: (e == null ? void 0 : e.package_id) ?? (pkg == null ? void 0 : pkg.id),
        group: groupName
      });
    }
  }
  await addItemsToStore(store, converted, targetGroupId);
}
export {
  importConfigurationToStore as a,
  importEmojisToStore as b,
  importBilibiliToStore as i
};
