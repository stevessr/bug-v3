<template>
  <div class="tools-tab">
    <a-row :gutter="[16, 16]">
      <a-col :span="24">
        <a-card title="🛠️ 小工具集合" size="small">
          <template #extra>
            <a-tag color="blue">工具箱</a-tag>
          </template>
          <p>这里集合了各种实用的小工具，帮助提升工作效率。</p>
        </a-card>
      </a-col>
      
      <a-col :span="24">
        <OpenRouterChat />
      </a-col>
      
      <!-- Future tools can be added here -->
      <a-col :span="24">
        <a-card title="🚀 更多工具" size="small" style="opacity: 0.7">
          <template #extra>
            <a-tag color="orange">即将推出</a-tag>
          </template>
          <a-row :gutter="16">
            <a-col :span="8">
              <a-card size="small" hoverable style="text-align: center">
                <div style="padding: 20px; color: #ccc">
                  📊<br>数据分析工具
                </div>
              </a-card>
            </a-col>
            <a-col :span="8">
              <a-card size="small" hoverable style="text-align: center">
                <div style="padding: 20px; color: #ccc">
                  🎨<br>图像处理工具
                </div>
              </a-card>
            </a-col>
            <a-col :span="8">
              <a-card size="small" hoverable style="text-align: center">
                <div style="padding: 20px; color: #ccc">
                  📝<br>文本处理工具
                </div>
              </a-card>
            </a-col>
          </a-row>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import OpenRouterChat from '../components/OpenRouterChat.vue'

export default defineComponent({
  name: 'ToolsTab',
  components: {
    OpenRouterChat
  },
  setup() {
    return {}
  }
})
</script>

<style scoped>
.tools-tab {
  padding: 0;
}
</style>