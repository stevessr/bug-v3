<template>
  <n-config-provider class="app-rooter" style="width: 100%; height: 100%">
    <n-layout class="popup-layout" style="width: 100%; height: 100%">
      <n-layout-sider :class="['popup-sider', { collapsed }]">
        <n-space vertical style="height: 100%; align-items: stretch">
          <n-button class="sidebar-btn" size="small" @click="exportConfig"
            >下载配置</n-button
          >
          <n-button class="sidebar-btn" size="small" @click="pushToCloud"
            >上传到云端</n-button
          >
          <n-button class="sidebar-btn" size="small" @click="pullFromCloud"
            >从云端拉取</n-button
          >
          <n-button class="sidebar-btn" size="small" @click="triggerFile"
            >上传（本地文件）</n-button
          >
        </n-space>
      </n-layout-sider>

      <n-layout-content style="padding: 12px; box-sizing: border-box">
        <n-card style="height: 100%">
          <div style="display: flex; flex-direction: column; gap: 12px">
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
              "
            >
              <div style="font-weight: 600">Nachoneko 表情包</div>
              <!-- show open-menu button only when menu is hidden -->
              <n-button
                size="small"
                tertiary
                @click="collapsed = false"
                v-if="collapsed"
                >菜单</n-button
              >
            </div>

            <n-space align="center">
              <div>插入大小</div>
              <n-slider
                v-model:value="scale"
                :min="5"
                :max="200"
                :step="1"
                style="width: 180px"
                @update:value="saveScale"
              />
              <div style="width: 44px; text-align: right">{{ scale }}%</div>
            </n-space>

            <div style="height: 8px"></div>

            <n-button class="open-options-btn" @click="openOptions">打开表情包设置</n-button>

            <div class="status">{{ status }}</div>

            <input
              ref="fileInput"
              type="file"
              accept="application/json"
              style="display: none"
              @change="onFileChange"
            />
          </div>
        </n-card>
        <!-- overlay when menu is open -->
        <div
          v-if="!collapsed"
          class="menu-overlay"
          @click="collapsed = true"
        ></div>
      </n-layout-content>
    </n-layout>
  </n-config-provider>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { createDiscreteApi } from "naive-ui";
import {
  NButton,
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NSpace,
  NSlider,
  NConfigProvider,
} from "naive-ui";

const { message } = createDiscreteApi(["message"]);

const STORAGE_KEY = "insertScale";
const CONFIG_KEY = "emojiData";
// storage helper: prefer chrome.storage.sync when available, fallback to local
const storage =
  chrome && chrome.storage && chrome.storage.sync
    ? chrome.storage.sync
    : chrome.storage.local;

const scale = ref(30);
const status = ref("");
const fileInput = ref(null);
// menu collapsed state: start collapsed (hidden) and slide in on startup
const collapsed = ref(true);

async function loadScale() {
  try {
    const data = await storage.get(STORAGE_KEY);
    const val = data && data[STORAGE_KEY] ? data[STORAGE_KEY] : 30;
    scale.value = val;
  } catch (e) {
    console.warn("[Nachoneko] popup: failed to load insertScale", e);
    scale.value = 30;
  }
}

async function saveScale(v) {
  try {
    await storage.set({ [STORAGE_KEY]: Number(v) });
    status.value = "已保存";
    setTimeout(() => (status.value = ""), 1200);
  } catch (e) {
    console.warn("[Nachoneko] popup: failed to save insertScale", e);
    status.value = "保存失败";
    setTimeout(() => (status.value = ""), 1500);
  }
}

async function exportConfig() {
  try {
    const data = await chrome.storage.local.get(CONFIG_KEY);
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
    status.value = "已导出";
    setTimeout(() => (status.value = ""), 1200);
  } catch (e) {
    console.error("[Nachoneko] export failed", e);
    status.value = "导出失败";
    setTimeout(() => (status.value = ""), 1500);
  }
}

function triggerFile() {
  if (fileInput.value) fileInput.value.click();
}

function readFileInput(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function overwriteConfig(data) {
  try {
    await chrome.storage.local.set({ [CONFIG_KEY]: data });
    status.value = "已覆盖";
    setTimeout(() => (status.value = ""), 1200);
    message.success("配置已覆盖");
  } catch (e) {
    console.error("[Nachoneko] overwrite failed", e);
    status.value = "覆盖失败";
    setTimeout(() => (status.value = ""), 1500);
    message.error("覆盖失败");
  }
}

async function mergeConfig(newData) {
  try {
    const existing =
      (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] || [];
    const merged = [...existing];
    for (const g of newData) {
      const foundGroup = merged.find((m) => m.group === g.group);
      if (!foundGroup) {
        merged.push(g);
        continue;
      }
      for (const emo of g.emojis) {
        if (!foundGroup.emojis.find((e) => e.url === emo.url))
          foundGroup.emojis.push(emo);
      }
    }
    await chrome.storage.local.set({ [CONFIG_KEY]: merged });
    status.value = "已合并";
    setTimeout(() => (status.value = ""), 1200);
    message.success("配置已合并");
  } catch (e) {
    console.error("[Nachoneko] merge failed", e);
    status.value = "合并失败";
    setTimeout(() => (status.value = ""), 1500);
    message.error("合并失败");
  }
}

async function onFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const data = await readFileInput(file);
    const doOverwrite = confirm(
      "是否覆盖现有配置？点击“确定”覆盖，取消将合并。"
    );
    if (doOverwrite) await overwriteConfig(data);
    else await mergeConfig(data);
  } catch (err) {
    console.error("[Nachoneko] import failed", err);
    status.value = "导入失败";
    setTimeout(() => (status.value = ""), 1500);
  } finally {
    e.target.value = "";
  }
}

// Push current local config to sync storage (cloud)
async function pushToCloud() {
  if (!chrome.storage.sync) {
    status.value = "浏览器不支持 sync";
    setTimeout(() => (status.value = ""), 1500);
    return;
  }
  try {
    const local =
      (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] || [];
    await chrome.storage.sync.set({ [CONFIG_KEY]: local });
    status.value = "已上传到云端";
    setTimeout(() => (status.value = ""), 1500);
    message.success("已上传到云端");
  } catch (e) {
    console.error("[pushToCloud] ", e);
    // fallback: inform user and keep local copy
    status.value = "上传失败（可能超出配额），已保留本地";
    message.warning("上传到云端失败，数据已保留在本地。");
    setTimeout(() => (status.value = ""), 2200);
  }
}

// Pull from cloud and overwrite local
async function pullFromCloud() {
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
    message.success("已从云端拉取配置");
  } catch (e) {
    console.error("[pullFromCloud] ", e);
    status.value = "拉取失败";
    setTimeout(() => (status.value = ""), 1700);
  }
}

function openOptions() {
  try {
    if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage(() => {
        window.close();
      });
    } else {
      window.open(
        chrome?.runtime?.getURL
          ? chrome.runtime.getURL("options.html")
          : "options.html",
        "_blank"
      );
      window.close();
    }
  } catch (e) {
    console.error(e);
  }
}

onMounted(() => {
  loadScale();
});
</script>

<style scoped>
.popup-layout {
  height: 100%;
  position: relative; /* base for overlay */
  display: flex; /* arrange content horizontally */
  align-items: stretch;
}

/* ensure inner naive layout fills the container */
.popup-layout ::v-deep(.n-layout) {
  height: 100%;
  display: flex;
  align-items: stretch;
}

.app-root {
  height: 100%;
}
.app-root ::v-deep(*) {
  height: 100%;
}

.popup-layout ::v-deep(.n-layout-content) {
  height: 100%;
  flex: 1 1 auto;
  display: flex;
}

.popup-layout ::v-deep(.n-layout-scroll-container) {
  height: 100% !important;
  display: flex;
  flex-direction: column;
}

.popup-layout ::v-deep(.n-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* floating sidebar: absolute so it doesn't affect content flow */
.popup-sider {
  position: absolute !important;
  left: 0;
  top: 0;
  bottom: 0;
  width: 260px; /* match Naive's inline sizing seen in DOM */
  padding: 12px;
  box-sizing: border-box;
  border-right: 1px solid rgba(0,0,0,0.06);
  background: var(--n-color, #fff);
  z-index: 40; /* above overlay */
  transform: translateX(-100%);
  transition: transform 260ms ease, opacity 200ms ease;
  opacity: 0;
}
.popup-sider:not(.collapsed) {
  transform: translateX(0);
  opacity: 1;
}

/* ensure inner scroll container stretches */
.popup-sider ::v-deep(.n-layout-sider-scroll-container),
.popup-sider ::v-deep(.n-space) {
  height: 100% !important;
  display: flex;
  flex-direction: column;
}

.sidebar-btn {
  width: 100%;
  justify-content: center;
}
.sidebar-btn + .sidebar-btn {
  margin-top: 8px;
}

.menu-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 30; /* below sidebar (40) */
}

.status {
  color: #4caf50;
  height: 18px;
}

/* make the open-options button smaller */
.open-options-btn {
  --n-height: 30px;
  --n-font-size: 13px;
  --n-padding: 0 10px;
}
.open-options-btn ::v-deep(.n-button) {
  height: 30px !important;
  min-height: 30px !important;
}
.open-options-btn ::v-deep(.n-button__content) {
  font-size: 13px !important;
}
</style>
