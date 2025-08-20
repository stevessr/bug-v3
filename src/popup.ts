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
        async get(_k: any) { return {}; },
        async set(_v: any) {},
      };

let scale = 30;
let status = "";
let fileInputEl: HTMLInputElement | null = null;
let collapsed = true;

function showMessage(text: string, type: "success" | "error" = "success") {
  status = text;
  renderStatus();
  setTimeout(() => { status = ""; renderStatus(); }, type === "success" ? 1200 : 1500);
}

export async function loadScale() {
  try {
    const data = await storage.get(STORAGE_KEY);
    const val = data && data[STORAGE_KEY] ? data[STORAGE_KEY] : 30;
    scale = val;
    const input = document.getElementById('insert-scale') as HTMLInputElement | null;
    const display = document.getElementById('insert-scale-value');
    if (input) input.value = String(scale);
    if (display) display.textContent = `${scale}%`;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[Nachoneko] popup: failed to load insertScale", e);
    scale = 30;
  }
}

export async function saveScale(e: Event | number) {
  const v = typeof e === 'number' ? e : (e && (e.target as any) ? (e.target as HTMLInputElement).value : null);
  try {
    await storage.set({ [STORAGE_KEY]: Number(v) });
    showMessage("已保存");
    const display = document.getElementById('insert-scale-value');
    if (display) display.textContent = `${Number(v)}%`;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Nachoneko] popup: failed to save insertScale", err);
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
  if (fileInputEl) fileInputEl.click();
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
  const file = target?.files && target.files;
  if (!file) return;
  try {
    const data = await readFileInput(file);
    const doOverwrite = await confirmDialog(
      "是否覆盖现有配置？点击“确定”覆盖，取消将合并。"
    );
    if (doOverwrite) {
      status = "导入中...";
      renderStatus();
      await overwriteConfig(data);
    } else {
      await mergeConfig(data);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Nachoneko] import failed", err);
    status = "导入失败";
    renderStatus();
    setTimeout(() => (status = ""), 1500);
  } finally {
    if (target) target.value = "";
  }
}

export async function pushToCloud() {
  if (!chrome.storage.sync) {
  status = "浏览器不支持 sync";
    renderStatus();
  setTimeout(() => { status = ""; renderStatus(); }, 1500);
    return;
  }
  try {
    const local = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] || [];
    await chrome.storage.sync.set({ [CONFIG_KEY]: local });
  status = "已上传到云端";
  setTimeout(() => (status = ""), 1500);
    globalMessage.success("已上传到云端");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[pushToCloud] ", e);
  status = "上传失败（可能超出配额），已保留本地";
    globalMessage.warning("上传到云端失败，数据已保留在本地。");
  renderStatus();
  setTimeout(() => (status = ""), 2200);
  }
}

export async function pullFromCloud() {
  if (!chrome.storage.sync) {
  status = "浏览器不支持 sync";
  renderStatus();
  setTimeout(() => { status = ""; renderStatus(); }, 1500);
    return;
  }
  try {
    const data = await chrome.storage.sync.get(CONFIG_KEY);
    const payload = data && data[CONFIG_KEY] ? data[CONFIG_KEY] : null;
    if (!payload) {
      status = "云端无配置";
    setTimeout(() => (status = ""), 1400);
      return;
    }
    await chrome.storage.local.set({ [CONFIG_KEY]: payload });
    status = "已从云端拉取并覆盖本地";
    setTimeout(() => (status = ""), 1700);
    globalMessage.success("已从云端拉取配置");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[pullFromCloud] ", e);
    status = "拉取失败";
    setTimeout(() => (status = ""), 1700);
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

function renderStatus() {
  const el = document.getElementById('popup-status');
  if (el) el.textContent = status || '';
}

export async function initPopup() {
  // wire DOM elements
  fileInputEl = document.getElementById('config-file-input') as HTMLInputElement | null;
  const downloadBtn = document.getElementById('download-config');
  const uploadCloudBtn = document.getElementById('upload-cloud');
  const pullCloudBtn = document.getElementById('pull-cloud');
  const uploadOverwriteBtn = document.getElementById('upload-overwrite');
  const uploadMergeBtn = document.getElementById('upload-merge');
  const openOptionsBtn = document.getElementById('open-options');
  const scaleInput = document.getElementById('insert-scale') as HTMLInputElement | null;

  if (fileInputEl) fileInputEl.addEventListener('change', onFileChange as any);
  if (downloadBtn) downloadBtn.addEventListener('click', exportConfig);
  if (uploadCloudBtn) uploadCloudBtn.addEventListener('click', pushToCloud);
  if (pullCloudBtn) pullCloudBtn.addEventListener('click', pullFromCloud);
  if (uploadOverwriteBtn) uploadOverwriteBtn.addEventListener('click', () => triggerFile());
  if (uploadMergeBtn) uploadMergeBtn.addEventListener('click', () => triggerFile());
  if (openOptionsBtn) openOptionsBtn.addEventListener('click', openOptions);
  if (scaleInput) {
    scaleInput.addEventListener('input', (e) => saveScale(e));
  }

  await loadScale();
  renderStatus();
}

// Auto-init when loaded as a module in popup.html
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initPopup().catch(console.error); });
  } else {
    // already loaded
    initPopup().catch(console.error);
  }
}

// ensure htmx is available
import('htmx.org');