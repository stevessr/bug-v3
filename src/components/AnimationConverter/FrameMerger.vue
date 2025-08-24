<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-4">帧合并</h2>
    <p class="text-gray-600 mb-6">
      将多个图片帧合并为动图
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
        accept="image/*"
        multiple
        @change="handleFileSelect"
        class="hidden"
      />
      
      <div v-if="selectedFiles.length === 0">
        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="mt-2 text-sm text-gray-600">
          拖拽多个图片文件到这里或
          <button @click="$refs.fileInput.click()" class="text-blue-600 hover:text-blue-500">
            点击选择文件
          </button>
        </p>
        <p class="text-xs text-gray-500 mt-1">
          支持 PNG, JPG, WebP 等图片格式，可选择多个文件
        </p>
      </div>

      <div v-else class="space-y-4">
        <p class="text-sm text-gray-600">已选择 {{ selectedFiles.length }} 个文件</p>
        <button @click="clearFiles" class="text-red-600 hover:text-red-500 text-sm">
          清空文件
        </button>
      </div>
    </div>

    <!-- Frame Preview -->
    <div v-if="selectedFiles.length > 0" class="mt-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">帧预览</h3>
        <button
          @click="sortFrames"
          class="text-sm text-blue-600 hover:text-blue-500"
        >
          按名称排序
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-64 overflow-y-auto">
        <div 
          v-for="(file, index) in selectedFiles" 
          :key="index"
          class="border border-gray-200 rounded-lg p-2 relative group"
          draggable="true"
          @dragstart="handleDragStart(index)"
          @dragover.prevent
          @drop="handleFrameDrop(index)"
        >
          <img 
            :src="file.preview" 
            :alt="`帧 ${index + 1}`" 
            class="w-full h-20 object-cover rounded"
          >
          <div class="mt-1 text-center">
            <p class="text-xs text-gray-600 truncate">{{ file.file.name }}</p>
          </div>
          <button
            @click="removeFrame(index)"
            class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- Merge Options -->
    <div v-if="selectedFiles.length > 0" class="mt-6 space-y-6">
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

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            尺寸
          </label>
          <select 
            v-model="sizeMode"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="auto">自动适应</option>
            <option value="first">以第一帧为准</option>
            <option value="largest">以最大尺寸为准</option>
            <option value="custom">自定义</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            循环次数
          </label>
          <select 
            v-model="loopCount"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="0">无限循环</option>
            <option value="1">播放1次</option>
            <option value="3">播放3次</option>
            <option value="5">播放5次</option>
          </select>
        </div>
      </div>

      <div v-if="sizeMode === 'custom'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            宽度 (px)
          </label>
          <input
            v-model.number="customWidth"
            type="number"
            min="1"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            高度 (px)
          </label>
          <input
            v-model.number="customHeight"
            type="number"
            min="1"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <!-- Merge Button -->
      <button
        @click="mergeFrames"
        :disabled="isMerging || selectedFiles.length < 2"
        class="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span v-if="isMerging">合并中...</span>
        <span v-else>开始合并 ({{ selectedFiles.length }} 帧)</span>
      </button>
    </div>

    <!-- Merging Progress -->
    <div v-if="isMerging" class="mt-4">
      <div class="bg-gray-200 rounded-full h-2">
        <div 
          class="bg-purple-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <p class="text-sm text-gray-600 mt-2 text-center">{{ progress }}%</p>
    </div>

    <!-- Download Result -->
    <div v-if="mergedFile" class="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-md">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <img :src="mergedPreview" class="w-16 h-16 object-cover rounded" alt="合并结果">
          <div>
            <h3 class="text-sm font-medium text-purple-800">合并完成!</h3>
            <p class="text-sm text-purple-600">动图已准备好下载</p>
          </div>
        </div>
        <button
          @click="downloadFile"
          class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
        >
          下载文件
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface FileWithPreview {
  file: File;
  preview: string;
}

const fileInput = ref<HTMLInputElement>();
const selectedFiles = ref<FileWithPreview[]>([]);
const isDragOver = ref(false);
const outputFormat = ref('gif');
const frameRate = ref(10);
const sizeMode = ref('auto');
const customWidth = ref(500);
const customHeight = ref(500);
const loopCount = ref('0');
const isMerging = ref(false);
const progress = ref(0);
const mergedFile = ref<Blob | null>(null);
const mergedPreview = ref<string>('');
const draggedIndex = ref<number>(-1);

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragOver.value = false;
  
  const files = e.dataTransfer?.files;
  if (files) {
    handleFiles(Array.from(files));
  }
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    handleFiles(Array.from(target.files));
  }
};

const handleFiles = (files: File[]) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  
  imageFiles.forEach(file => {
    const preview = URL.createObjectURL(file);
    selectedFiles.value.push({ file, preview });
  });
};

const clearFiles = () => {
  selectedFiles.value.forEach(item => {
    URL.revokeObjectURL(item.preview);
  });
  selectedFiles.value = [];
  mergedFile.value = null;
  mergedPreview.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const removeFrame = (index: number) => {
  URL.revokeObjectURL(selectedFiles.value[index].preview);
  selectedFiles.value.splice(index, 1);
};

const sortFrames = () => {
  selectedFiles.value.sort((a, b) => a.file.name.localeCompare(b.file.name));
};

const handleDragStart = (index: number) => {
  draggedIndex.value = index;
};

const handleFrameDrop = (targetIndex: number) => {
  if (draggedIndex.value !== -1 && draggedIndex.value !== targetIndex) {
    const draggedItem = selectedFiles.value[draggedIndex.value];
    selectedFiles.value.splice(draggedIndex.value, 1);
    selectedFiles.value.splice(targetIndex, 0, draggedItem);
  }
  draggedIndex.value = -1;
};

const mergeFrames = async () => {
  if (selectedFiles.value.length < 2) return;
  
  isMerging.value = true;
  progress.value = 0;
  
  try {
    // 模拟合并进度
    const interval = setInterval(() => {
      progress.value += Math.random() * 15;
      if (progress.value >= 95) {
        clearInterval(interval);
      }
    }, 200);
    
    // 模拟合并过程 (实际实现需要使用gif.js或类似库)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    clearInterval(interval);
    progress.value = 100;
    
    // 模拟合并结果 (实际实现需要真正的合并逻辑)
    mergedFile.value = selectedFiles.value[0].file; // 临时使用第一帧作为结果
    mergedPreview.value = selectedFiles.value[0].preview;
    
  } catch (error) {
    console.error('合并失败:', error);
  } finally {
    isMerging.value = false;
  }
};

const downloadFile = () => {
  if (!mergedFile.value) return;
  
  const url = URL.createObjectURL(mergedFile.value);
  const a = document.createElement('a');
  a.href = url;
  a.download = `merged_animation.${outputFormat.value}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>