<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-xl font-semibold text-gray-900 mb-4">帧拆分</h2>
    <p class="text-gray-600 mb-6">
      将动图拆分为单独的图片帧
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
        accept=".gif,.apng"
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
          支持 GIF, APNG 格式
        </p>
      </div>

      <div v-else class="space-y-4">
        <div class="flex items-center justify-center">
          <img :src="previewUrl" class="max-h-32 rounded" alt="预览">
        </div>
        <p class="text-sm text-gray-600">{{ selectedFile.name }}</p>
        <button @click="clearFile" class="text-red-600 hover:text-red-500 text-sm">
          移除文件
        </button>
      </div>
    </div>

    <!-- Split Options -->
    <div v-if="selectedFile" class="mt-6 space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          输出格式
        </label>
        <select 
          v-model="outputFormat"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="webp">WebP</option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            帧范围
          </label>
          <select 
            v-model="frameRange"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有帧</option>
            <option value="range">指定范围</option>
            <option value="interval">按间隔</option>
          </select>
        </div>

        <div v-if="frameRange === 'interval'">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            间隔 (每N帧取1帧)
          </label>
          <input
            v-model.number="frameInterval"
            type="number"
            min="1"
            max="10"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div v-if="frameRange === 'range'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            起始帧
          </label>
          <input
            v-model.number="startFrame"
            type="number"
            min="1"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            结束帧
          </label>
          <input
            v-model.number="endFrame"
            type="number"
            min="1"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <!-- Split Button -->
      <button
        @click="splitFrames"
        :disabled="isSplitting"
        class="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span v-if="isSplitting">拆分中...</span>
        <span v-else>开始拆分</span>
      </button>
    </div>

    <!-- Splitting Progress -->
    <div v-if="isSplitting" class="mt-4">
      <div class="bg-gray-200 rounded-full h-2">
        <div 
          class="bg-green-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <p class="text-sm text-gray-600 mt-2 text-center">{{ progress }}%</p>
    </div>

    <!-- Frame Results -->
    <div v-if="frames.length > 0" class="mt-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">拆分结果 ({{ frames.length }} 帧)</h3>
        <button
          @click="downloadAllFrames"
          class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
        >
          下载所有帧
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div 
          v-for="(frame, index) in frames" 
          :key="index"
          class="border border-gray-200 rounded-lg p-2 hover:shadow-md transition-shadow"
        >
          <img :src="frame.url" :alt="`帧 ${index + 1}`" class="w-full h-20 object-cover rounded">
          <div class="mt-2 text-center">
            <p class="text-xs text-gray-600">帧 {{ index + 1 }}</p>
            <button
              @click="downloadFrame(frame, index)"
              class="text-xs text-blue-600 hover:text-blue-500 mt-1"
            >
              下载
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Frame {
  url: string;
  blob: Blob;
}

const fileInput = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string>('');
const isDragOver = ref(false);
const outputFormat = ref('png');
const frameRange = ref('all');
const frameInterval = ref(1);
const startFrame = ref(1);
const endFrame = ref(10);
const isSplitting = ref(false);
const progress = ref(0);
const frames = ref<Frame[]>([]);

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
  frames.value = [];
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const splitFrames = async () => {
  if (!selectedFile.value) return;
  
  isSplitting.value = true;
  progress.value = 0;
  frames.value = [];
  
  try {
    // 模拟拆分进度
    const interval = setInterval(() => {
      progress.value += Math.random() * 15;
      if (progress.value >= 95) {
        clearInterval(interval);
      }
    }, 200);
    
    // 模拟拆分过程 (实际实现需要使用gif.js或类似库)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    clearInterval(interval);
    progress.value = 100;
    
    // 模拟拆分结果 (实际实现需要真正的拆分逻辑)
    const mockFrames: Frame[] = [];
    for (let i = 0; i < 8; i++) {
      mockFrames.push({
        url: previewUrl.value, // 实际应该是真正的帧数据
        blob: selectedFile.value, // 实际应该是帧的Blob
      });
    }
    frames.value = mockFrames;
    
  } catch (error) {
    console.error('拆分失败:', error);
  } finally {
    isSplitting.value = false;
  }
};

const downloadFrame = (frame: Frame, index: number) => {
  const url = frame.url;
  const a = document.createElement('a');
  a.href = url;
  a.download = `frame_${index + 1}.${outputFormat.value}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const downloadAllFrames = () => {
  frames.value.forEach((frame, index) => {
    setTimeout(() => {
      downloadFrame(frame, index);
    }, index * 100); // 延迟下载避免浏览器阻止多个下载
  });
};
</script>