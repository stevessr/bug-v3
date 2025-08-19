<template>
  <div class="popup-root">
    <div class="popup-layout">
      <!-- 侧边栏 -->
      <div :class="['popup-sider', { collapsed }]">
        <div class="sidebar-content">
          <button class="sidebar-btn" @click="exportConfig">下载配置</button>
          <button class="sidebar-btn" @click="pushToCloud">上传到云端</button>
          <button class="sidebar-btn" @click="pullFromCloud">从云端拉取</button>
          <button class="sidebar-btn" @click="triggerFile">
            上传（本地文件）
          </button>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="popup-content">
        <div class="content-card">
          <div class="header">
            <div class="title">Nachoneko 表情包</div>
            <button
              v-if="collapsed"
              class="menu-btn"
              @click="collapsed = false"
            >
              菜单
            </button>
          </div>

          <div class="scale-control">
            <span>插入大小</span>
            <input
              type="range"
              v-model="scale"
              min="5"
              max="200"
              step="1"
              class="slider"
              @input="saveScale"
            />
            <span class="scale-value">{{ scale }}%</span>
          </div>

          <button class="primary-btn" @click="openOptions">
            打开表情包设置
          </button>

          <div class="status">{{ status }}</div>

          <input
            ref="fileInput"
            type="file"
            accept="application/json"
            style="display: none"
            @change="onFileChange"
          />
        </div>

        <!-- 遮罩层 -->
        <div
          v-if="!collapsed"
          class="menu-overlay"
          @click="collapsed = true"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import {
  scale,
  status,
  fileInput,
  collapsed,
  loadScale,
  saveScale,
  exportConfig,
  triggerFile,
  onFileChange,
  pushToCloud,
  pullFromCloud,
  openOptions,
} from "./popup.ts";

onMounted(() => {
  loadScale();
});
</script>
<style src="./popup.css" scoped></style>
