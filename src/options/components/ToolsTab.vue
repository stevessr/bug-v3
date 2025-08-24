<script setup lang="ts">
const openTool = (url: string) => {
  // 在新标签页中打开工具
  window.open(url, '_blank')
}
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">🛠️ 实用小工具</h2>
      <p class="text-gray-600 mb-6">探索各种实用的小工具，提高您的工作效率</p>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- AI图片生成器 -->
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div class="flex items-center mb-3">
            <div
              class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center"
            >
              <span class="text-white text-lg">🎨</span>
            </div>
            <h3 class="ml-3 text-lg font-medium text-gray-900">AI 图片生成器</h3>
          </div>
          <p class="text-gray-600 text-sm mb-4">使用AI技术生成创意图片，支持多种风格和提示词</p>
          <button
            @click="openTool('/html/image-generator.html')"
            class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            打开工具
          </button>
        </div>

        <!-- 动图转换器 -->
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div class="flex items-center mb-3">
            <div
              class="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center"
            >
              <span class="text-white text-lg">🎞️</span>
            </div>
            <h3 class="ml-3 text-lg font-medium text-gray-900">动图转换器</h3>
          </div>
          <p class="text-gray-600 text-sm mb-4">转换GIF、MP4、WebM为APNG或GIF，支持帧拆分和合并</p>
          <button
            @click="openTool('/html/animation-converter.html')"
            class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            打开工具
          </button>
        </div>

        <!-- 图片编辑器 -->
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div class="flex items-center mb-3">
            <div
              class="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center"
            >
              <span class="text-white text-lg">✂️</span>
            </div>
            <h3 class="ml-3 text-lg font-medium text-gray-900">图片编辑器</h3>
          </div>
          <p class="text-gray-600 text-sm mb-4">
            专业的在线图片编辑工具，支持裁剪、滤镜、调色等功能
          </p>
          <button
            @click="openTool('/html/image-editor.html')"
            class="w-full bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors"
          >
            打开工具
          </button>
        </div>

        <!-- 更多工具占位符 -->
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500"
        >
          <span class="text-2xl mb-2">➕</span>
          <p class="text-sm text-center">更多工具即将推出</p>
        </div>
      </div>
    </div>

    <!-- 工具使用说明 -->
    <div class="bg-blue-50 rounded-lg p-6">
      <h3 class="text-lg font-medium text-blue-900 mb-2">💡 使用提示</h3>
      <ul class="list-disc list-inside text-blue-800 space-y-1">
        <li>点击"打开工具"按钮会在新标签页中打开对应的工具</li>
        <li>所有工具都支持本地处理，保护您的隐私安全</li>
        <li>建议收藏常用工具的页面以便快速访问</li>
      </ul>
    </div>
  </div>
</template>
