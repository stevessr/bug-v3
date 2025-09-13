async function loadDefaultGroups() {
  const url = "/assets/defaultEmojiGroups.json";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`无法获取默认表情组 JSON: HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.groups)) throw new Error("默认表情组格式无效");
    console.log(`✅ 成功加载默认表情组：${data.groups.length} 个组`);
    return data.groups;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("加载默认表情组时发生未知错误");
  }
}
export {
  loadDefaultGroups
};
