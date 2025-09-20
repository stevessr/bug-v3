<script setup lang="ts">
import {
  GithubOutlined,
  CloudUploadOutlined,
  SwapOutlined,
  ExportOutlined,
  FileAddOutlined,
  FileImageOutlined,
  ClearOutlined
} from '@ant-design/icons-vue'

const emit = defineEmits([
  'openImport',
  'openImportEmojis',
  'resetSettings',
  'syncToChrome',
  'forceLocalToExtension',
  'exportConfiguration'
])

const handleClick = () => {
  try {
    window.open('https://github.com/stevessr/bug-v3/', '_blank')
  } catch (e) {
    window.location.href = 'https://github.com/stevessr/bug-v3/'
  }
}

</script>

<template>
  <div class="opensource-root">
    <a-float-button-group trigger="hover" type="primary">
      <a-float-button type="default" tooltip="开源地址" @click="handleClick">
        <template #icon>
          <GithubOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="导入配置" type="default" @click="$emit('openImport')">
        <template #icon>
          <FileAddOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="导入表情" type="default" @click="$emit('openImportEmojis')">
        <template #icon>
          <FileImageOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="重置设置" type="default" @click="$emit('resetSettings')">
        <template #icon>
          <ClearOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="上传到Chrome同步" type="default" @click="$emit('syncToChrome')">
        <template #icon>
          <CloudUploadOutlined />
        </template>
      </a-float-button>
      <a-float-button
        tooltip="强制本地同步到扩展存储"
        type="default"
        @click="$emit('forceLocalToExtension')"
      >
        <template #icon>
          <SwapOutlined />
        </template>
      </a-float-button>
      <a-float-button tooltip="导出配置" type="default" @click="$emit('exportConfiguration')">
        <template #icon>
          <ExportOutlined />
        </template>
      </a-float-button>
    </a-float-button-group>
  </div>
</template>
