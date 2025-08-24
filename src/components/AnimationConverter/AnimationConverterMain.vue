<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">🎞️ 动图转换器</h1>
            <p class="text-sm text-gray-600">
              转换GIF、MP4、WebM为APNG或GIF，支持帧拆分和合并
            </p>
          </div>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Format Converter Tab -->
      <div v-if="activeTab === 'convert'" class="space-y-8">
        <FormatConverter />
      </div>

      <!-- Frame Splitter Tab -->
      <div v-if="activeTab === 'split'" class="space-y-8">
        <FrameSplitter />
      </div>

      <!-- Frame Merger Tab -->
      <div v-if="activeTab === 'merge'" class="space-y-8">
        <FrameMerger />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FormatConverter from './FormatConverter.vue';
import FrameSplitter from './FrameSplitter.vue';
import FrameMerger from './FrameMerger.vue';

const activeTab = ref('convert');
const tabs = [
  { id: 'convert', label: '格式转换' },
  { id: 'split', label: '帧拆分' },
  { id: 'merge', label: '帧合并' },
];
</script>