<script setup lang="ts">
const tools = [
  {
    id: 'image-generator',
    name: 'AI 图片生成',
    description: '使用AI模型生成图片，支持多种风格和设置',
    icon: '🎨',
    url: 'image-generator.html',
    features: ['支持多种AI模型', '图片编辑功能', '自定义参数']
  },
  {
    id: 'animation-converter',
    name: '动图转换器',
    description: '转换动图格式、拆分合并帧',
    icon: '🎞️',
    url: 'animation-converter.html',
    features: ['GIF/MP4/WebM转换', '帧拆分/合并', '质量设置']
  },
  {
    id: 'image-editor',
    name: '图片编辑器',
    description: '专业的图片编辑工具',
    icon: '✂️',
    url: 'image-editor.html',
    features: ['Canvas编辑', '滤镜效果', '撤销/重做']
  },
  {
    id: 'emoji-manager',
    name: '表情管理器',
    description: '管理和组织表情包',
    icon: '😊',
    url: 'emoji-manager.html',
    features: ['表情分组', '批量导入', '标签管理']
  }
]

const openTool = (url: string) => {
  window.open(url, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
}
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">小工具</h2>
          <p class="text-sm text-gray-600">实用工具集合，点击卡片在新窗口中打开</p>
        </div>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div
            v-for="tool in tools"
            :key="tool.id"
            @click="openTool(tool.url)"
            class="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer group"
          >
            <!-- Tool Icon -->
            <div class="flex items-center justify-center w-12 h-12 bg-gray-50 rounded-lg mb-4 group-hover:bg-blue-50 transition-colors">
              <span class="text-2xl">{{ tool.icon }}</span>
            </div>

            <!-- Tool Info -->
            <div class="space-y-3">
              <h3 class="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {{ tool.name }}
              </h3>
              
              <p class="text-sm text-gray-600 leading-relaxed">
                {{ tool.description }}
              </p>

              <!-- Features -->
              <div class="space-y-1">
                <div
                  v-for="feature in tool.features"
                  :key="feature"
                  class="flex items-center text-xs text-gray-500"
                >
                  <span class="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                  {{ feature }}
                </div>
              </div>
            </div>

            <!-- Hover indicator -->
            <div class="mt-4 flex items-center text-sm text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>点击打开</span>
              <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- Privacy Notice -->
        <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-blue-800">隐私保护</h3>
              <p class="mt-1 text-sm text-blue-700">
                所有工具均在本地处理文件，不会上传到任何服务器。您的数据安全和隐私得到充分保护。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-card {
  transition: all 0.2s ease-in-out;
}

.tool-card:hover {
  transform: translateY(-2px);
}
</style>