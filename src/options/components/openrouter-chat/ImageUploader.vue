<template>
  <div>
    <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center">
      <a-upload
        v-model:file-list="fileList"
        list-type="picture-card"
        :before-upload="uploadBefore"
        @change="handleUploadChange"
        @preview="handleUploadPreview"
        @remove="handleRemove"
      >
        <div v-if="fileList.length < 8">
          <PlusOutlined />
          <div style="margin-top: 8px">添加图片</div>
        </div>
      </a-upload>
    </div>

    <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center">
      <a-input
        v-model:value="imageUrlInput"
        placeholder="粘贴图片 URL 并点击添加"
        @keyup.enter="addImageUrl"
      />
      <a-button @click="addImageUrl">添加</a-button>
    </div>

    <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center">
      <a-checkbox v-model:checked="useImgBed">使用 CloudFlare-ImgBed 上传</a-checkbox>
      <a-button size="small" @click="showImgBedModal = true">配置 ImgBed</a-button>
    </div>

    <!-- Image Preview Modal -->
    <a-modal
      v-model:open="showImagePreview"
      title="图像预览"
      footer=""
      width="80%"
      style="max-width: 1000px"
    >
      <img
        :src="previewImageUrl"
        style="width: 100%; height: auto; max-height: 70vh; object-fit: contain"
        alt="Image preview"
      />
      <div style="text-align: center; margin-top: 16px">
        <a-button @click="downloadImage">下载图像</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { useFileUpload } from '../../composables/useFileUpload';
import { useImgBed } from '../../composables/useImgBed';
import { PlusOutlined } from '@ant-design/icons-vue';

const {
  fileList,
  imageUrlInput,
  showImagePreview,
  previewImageUrl,
  uploadBefore,
  handleUploadChange,
  handleUploadPreview,
  handleRemove,
  addImageUrl,
  downloadImage,
} = useFileUpload();

const { useImgBed, showImgBedModal } = useImgBed();
</script>
