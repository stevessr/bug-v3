<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-4">格式转换</h2>
    <p class="text-gray-600 mb-6">
      将GIF、MP4、WebM等动图格式转换为APNG或GIF
    </p>

    <!-- File Upload Area -->
    <div
      @drop="handleDrop"
      @dragover.prevent
      @dragenter.prevent
      :class="[
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      ]"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".gif,.mp4,.webm,.mov,.avi"
        @change="handleFileSelect"
        class="hidden"
      />
      
      <div v-if="!selectedFile">
        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="mt-2 text-sm text-gray-600">
          拖拽文件到这里或
          <button @click="$refs.fileInput.click()" class="text-blue-600 hover:text-blue-500">
            点击选择文件
          </button>
        </p>
        <p class="text-xs text-gray-500 mt-1">
          支持 GIF, MP4, WebM, MOV, AVI 格式
        </p>
      </div>

      <div v-else class="space-y-4">
        <div class="flex items-center justify-center">
          <video v-if="isVideo" :src="previewUrl" class="max-h-32 rounded" autoplay loop muted></video>
          <img v-else :src="previewUrl" class="max-h-32 rounded" alt="预览">
        </div>
        <p class="text-sm text-gray-600">{{ selectedFile.name }}</p>
        <button @click="clearFile" class="text-red-600 hover:text-red-500 text-sm">
          移除文件
        </button>
      </div>
    </div>

    <!-- Conversion Options -->
    <div v-if="selectedFile" class="mt-6 space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          输出格式
        </label>
        <select 
          v-model="outputFormat"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="gif">GIF</option>
          <option value="apng">APNG</option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            帧率 (FPS)
          </label>
          <input
            v-model.number="frameRate"
            type="number"
            min="1"
            max="60"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            质量
          </label>
          <select 
            v-model="quality"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="low">低质量 (文件更小)</option>
            <option value="medium">中等质量</option>
            <option value="high">高质量 (文件更大)</option>
          </select>
        </div>
      </div>

      <!-- Convert Button -->
      <button
        @click="convertFile"
        :disabled="isConverting"
        class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span v-if="isConverting">转换中...</span>
        <span v-else>开始转换</span>
      </button>
    </div>

    <!-- Conversion Progress -->
    <div v-if="isConverting" class="mt-4">
      <div class="bg-gray-200 rounded-full h-2">
        <div 
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <p class="text-sm text-gray-600 mt-2 text-center">{{ progress }}%</p>
    </div>

    <!-- Download Result -->
    <div v-if="convertedFile" class="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-green-800">转换完成!</h3>
          <p class="text-sm text-green-600">文件已准备好下载</p>
        </div>
        <button
          @click="downloadFile"
          class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
        >
          下载文件
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const fileInput = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string>('');
const isDragOver = ref(false);
const outputFormat = ref('gif');
const frameRate = ref(15);
const quality = ref('medium');
const isConverting = ref(false);
const progress = ref(0);
const convertedFile = ref<Blob | null>(null);

const isVideo = computed(() => {
  if (!selectedFile.value) return false;
  return selectedFile.value.type.startsWith('video/');
});

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
  
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    handleFile(target.files[0]);
  }
};

const handleFile = (file: File) => {
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
};

const clearFile = () => {
  selectedFile.value = null;
  previewUrl.value = '';
  convertedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const convertFile = async () => {
  if (!selectedFile.value) return;
  
  isConverting.value = true;
  progress.value = 0;
  
  try {
    // 模拟转换进度
    const interval = setInterval(() => {
      progress.value += Math.random() * 15;
      if (progress.value >= 95) {
        clearInterval(interval);
      }
    }, 200);
    
    // 模拟转换过程 (实际实现需要使用FFmpeg.js或类似库)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    clearInterval(interval);
    progress.value = 100;
    
    // 模拟转换结果 (实际实现需要真正的转换逻辑)
    convertedFile.value = selectedFile.value;
    
  } catch (error) {
    console.error('转换失败:', error);
  } finally {
    isConverting.value = false;
  }
};

const downloadFile = () => {
  if (!convertedFile.value || !selectedFile.value) return;
  
  const url = URL.createObjectURL(convertedFile.value);
  const a = document.createElement('a');
  a.href = url;
  a.download = `converted_${selectedFile.value.name.split('.')[0]}.${outputFormat.value}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>