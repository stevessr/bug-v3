import { ref } from "vue";
import { confirmDialog } from "./dialog";

// 避免 TS 报错：chrome，message 可能来自全局环境
declare const chrome: any;
const win: any = typeof window !== "undefined" ? window : {};
const globalMessage = (win.message as any) || { success: () => {}, warning: () => {} };

export const STORAGE_KEY = "insertScale";
export const CONFIG_KEY = "emojiData";

export const storage =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync
    ? chrome.storage.sync
    : (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) || {
        // fallback stub to avoid runtime crashes in non-extension env
        async get(k: any) {
          return {};
        },
        async set(_v: any) {},
      };

export const scale = ref<number>(30);
export const status = ref<string>("");
export const fileInput = ref<HTMLInputElement | null>(null);
export const collapsed = ref<boolean>(true);

export function showMessage(text: string, type: "success" | "error" = "success") {
  status.value = text;
  setTimeout(() => (status.value = ""), type === "success" ? 1200 : 1500);
}

export async function loadScale() {
  try {
    const data = await storage.get(STORAGE_KEY);
    const val = data && data[STORAGE_KEY] ? data[STORAGE_KEY] : 30;
    scale.value = val;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[Nachoneko] popup: failed to load insertScale", e);
    scale.value = 30;
  }
}

export async function saveScale(e: any) {
  const v = e && e.target ? e.target.value : e;
  try {
    await storage.set({ [STORAGE_KEY]: Number(v) });
    showMessage("已保存");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[Nachoneko] popup: failed to save insertScale", e);
    showMessage("保存失败", "error");
  }
}

export async function exportConfig() {
  try {
    const data = await (chrome.storage.local.get(CONFIG_KEY));
    const payload = data && data[CONFIG_KEY] ? data[CONFIG_KEY] : [];
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nachoneko-config.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage("已导出");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[Nachoneko] export failed", e);
    showMessage("导出失败", "error");
  }
}

export function triggerFile() {
  if (fileInput.value) fileInput.value.click();
}

export function readFileInput(file: File) {
  return new Promise<any>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function overwriteConfig(data: any) {
  try {
    await chrome.storage.local.set({ [CONFIG_KEY]: data });
    showMessage("配置已覆盖");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[Nachoneko] overwrite failed", e);
    showMessage("覆盖失败", "error");
  }
}

export async function mergeConfig(newData: any[]) {
  try {
    const existing = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] || [];
    const merged = [...existing];
    for (const g of newData) {
      const foundGroup = merged.find((m: any) => m.group === g.group);
      if (!foundGroup) {
        merged.push(g);
        continue;
      }
      for (const emo of g.emojis) {
        if (!foundGroup.emojis.find((e: any) => e.url === emo.url)) foundGroup.emojis.push(emo);
      }
    }
    await chrome.storage.local.set({ [CONFIG_KEY]: merged });
    showMessage("配置已合并");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[Nachoneko] merge failed", e);
    showMessage("合并失败", "error");
  }
}

export async function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement | null;
  const file = target?.files && target.files[0];
  if (!file) return;
  try {
    const data = await readFileInput(file);
  const doOverwrite = await confirmDialog("是否覆盖现有配置？点击“确定”覆盖，取消将合并。");
  if (doOverwrite) await overwriteConfig(data);
  else await mergeConfig(data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Nachoneko] import failed", err);
    status.value = "导入失败";
    setTimeout(() => (status.value = ""), 1500);
  } finally {
    if (target) target.value = "";
  }
}

export async function pushToCloud() {
  if (!chrome.storage.sync) {
    status.value = "浏览器不支持 sync";
    setTimeout(() => (status.value = ""), 1500);
    return;
  }
  try {
    const local = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] || [];
    await chrome.storage.sync.set({ [CONFIG_KEY]: local });
    status.value = "已上传到云端";
    setTimeout(() => (status.value = ""), 1500);
    globalMessage.success("已上传到云端");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[pushToCloud] ", e);
    status.value = "上传失败（可能超出配额），已保留本地";
    globalMessage.warning("上传到云端失败，数据已保留在本地。");
    setTimeout(() => (status.value = ""), 2200);
  }
}

export async function pullFromCloud() {
  if (!chrome.storage.sync) {
    status.value = "浏览器不支持 sync";
    setTimeout(() => (status.value = ""), 1500);
    return;
  }
  try {
    const data = await chrome.storage.sync.get(CONFIG_KEY);
    const payload = data && data[CONFIG_KEY] ? data[CONFIG_KEY] : null;
    if (!payload) {
      status.value = "云端无配置";
      setTimeout(() => (status.value = ""), 1400);
      return;
    }
    await chrome.storage.local.set({ [CONFIG_KEY]: payload });
    status.value = "已从云端拉取并覆盖本地";
    setTimeout(() => (status.value = ""), 1700);
    globalMessage.success("已从云端拉取配置");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[pullFromCloud] ", e);
    status.value = "拉取失败";
    setTimeout(() => (status.value = ""), 1700);
  }
}

export function openOptions() {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage(() => {
        window.close();
      });
    } else {
      window.open(
        chrome?.runtime?.getURL ? chrome.runtime.getURL("options.html") : "options.html",
        "_blank"
      );
      window.close();
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
  }
}
