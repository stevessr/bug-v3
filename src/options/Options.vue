<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">表情管理</h1>
            <p class="text-sm text-gray-600">管理表情包分组、自定义表情和扩展设置</p>
          </div>
          <div class="flex gap-3">
            <button
              @click="showImportModal = true"
              class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              导入配置
            </button>
            <button
              @click="showImportEmojiModal = true"
              class="px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
            >
              导入表情
            </button>
            <button
              @click="resetSettings"
              class="px-4 py-2 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
            >
              重置设置
            </button>
            <button
              @click="syncToChrome"
              class="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              上传到Chrome同步
            </button>
            <button
              @click="exportConfiguration"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              导出配置
            </button>
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
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="space-y-8">
        <div class="bg-white rounded-lg shadow-sm border">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">全局设置</h2>
          </div>
          <div class="p-6 space-y-6">
            <!-- Image Scale -->
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-900">默认图片缩放</label>
                <p class="text-sm text-gray-500">控制插入表情的默认尺寸</p>
              </div>
              <div class="flex items-center gap-3">
                <input
                  :value="emojiStore.settings.imageScale"
                  @input="updateImageScale"
                  type="range"
                  min="5"
                  max="150"
                  step="5"
                  class="w-32"
                />
                <span class="text-sm text-gray-600 w-12">{{ emojiStore.settings.imageScale }}%</span>
              </div>
            </div>

            <!-- Grid Columns -->
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-900">网格列数</label>
                <p class="text-sm text-gray-500">表情选择器中的列数</p>
              </div>
              <select
                :value="emojiStore.settings.gridColumns"
                @change="updateGridColumns"
                class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="2">2 列</option>
                <option value="3">3 列</option>
                <option value="4">4 列</option>
                <option value="5">5 列</option>
                <option value="6">6 列</option>
                <option value="8">8 列</option>
              </select>
            </div>

            <!-- Show Search Bar -->
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-900">显示搜索框</label>
                <p class="text-sm text-gray-500">在表情选择器中显示搜索功能</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="emojiStore.settings.showSearchBar"
                  @change="updateShowSearchBar"
                  class="sr-only peer"
                />
                <div
                  class="relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]"
                ></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Emoji Groups Tab -->
      <div v-if="activeTab === 'groups'" class="space-y-8">
        <div class="bg-white rounded-lg shadow-sm border">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold text-gray-900">表情分组管理</h2>
              <button
                @click="showCreateGroupModal = true"
                class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                新建分组
              </button>
            </div>
          </div>
          
          <div class="p-6">
            <div class="space-y-4">
              <div
                v-for="group in emojiStore.sortedGroups"
                :key="group.id"
                class="group-item border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                :draggable="true"
                @dragstart="handleDragStart(group, $event)"
                @dragover.prevent
                @drop="handleDrop(group, $event)"
              >
                <div class="flex items-center justify-between p-4">
                  <div class="flex items-center gap-3">
                    <div class="cursor-move text-gray-400">⋮⋮</div>
                    <div class="text-lg">{{ group.icon }}</div>
                    <div>
                      <h3 class="font-medium text-gray-900">{{ group.name }}</h3>
                      <p class="text-sm text-gray-500">{{ group.emojis?.length || 0 }} 个表情</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="toggleGroupExpansion(group.id)"
                      class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
                    >
                      {{ expandedGroups.has(group.id) ? '收起' : '展开' }}
                    </button>
                    <button
                      @click="openEditGroup(group)"
                      class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      v-if="group.id !== 'favorites' && group.id !== 'nachoneko'"
                      @click="confirmDeleteGroup(group)"
                      class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
                
                <!-- Expanded emoji display -->
                <div v-if="expandedGroups.has(group.id)" class="px-4 pb-4 border-t border-gray-100">
                  <div class="mt-4">
                    <div class="grid grid-cols-12 gap-3">
                      <div
                        v-for="(emoji, index) in group.emojis"
                        :key="`${group.id}-${index}`"
                        class="emoji-item relative group cursor-move"
                        :draggable="true"
                        @dragstart="handleEmojiDragStart(emoji, group.id, index, $event)"
                        @dragover.prevent
                        @drop="handleEmojiDrop(group.id, index, $event)"
                      >
                        <div class="aspect-square bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors">
                          <img
                            :src="emoji.url"
                            :alt="emoji.name"
                            class="w-full h-full object-contain rounded"
                            :style="{ width: '48px', height: '48px' }"
                          />
                        </div>
                        <div class="text-xs text-center text-gray-600 mt-1 truncate">{{ emoji.name }}</div>
                        <button
                          @click="removeEmojiFromGroup(group.id, index)"
                          class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    
                    <!-- Add emoji button -->
                    <div class="mt-4">
                      <button
                        @click="showAddEmojiModal = true; selectedGroupForAdd = group.id"
                        class="px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors w-full"
                      >
                        + 添加表情
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics Tab -->
      <div v-if="activeTab === 'stats'" class="space-y-8">
        <div class="bg-white rounded-lg shadow-sm border">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">使用统计</h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="bg-blue-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-blue-600">{{ emojiStore.groups.length }}</div>
                <div class="text-sm text-blue-800">表情分组</div>
              </div>
              <div class="bg-green-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-green-600">{{ totalEmojis }}</div>
                <div class="text-sm text-green-800">总表情数</div>
              </div>
              <div class="bg-purple-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-purple-600">{{ emojiStore.favorites.size }}</div>
                <div class="text-sm text-purple-800">收藏表情</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- About Tab -->
      <div v-if="activeTab === 'about'" class="space-y-8">
        <div class="bg-white rounded-lg shadow-sm border">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">关于扩展</h2>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <h3 class="font-medium text-gray-900">表情包扩展</h3>
              <p class="text-sm text-gray-600">版本 1.0.0</p>
            </div>
            <div>
              <h3 class="font-medium text-gray-900">功能特色</h3>
              <ul class="text-sm text-gray-600 space-y-1 mt-2">
                <li>• 支持多分组表情管理</li>
                <li>• 拖拽排序和重新组织</li>
                <li>• Chrome 同步支持</li>
                <li>• 响应式设计，触屏优化</li>
                <li>• 实时搜索和过滤</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Legacy content (remove this section) -->
      <div v-if="false" class="bg-white rounded-lg shadow-sm border mb-8">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-900">表情分组管理</h2>
            <button
              @click="showCreateGroupModal = true"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              新建分组
            </button>
          </div>
        </div>
        
        <div class="p-6">
          <div class="space-y-4">
            <div
              v-for="group in emojiStore.groups"
              :key="group.id"
              class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="text-lg">{{ group.icon }}</div>
                <div>
                  <h3 class="font-medium text-gray-900">{{ group.name }}</h3>
                  <p class="text-sm text-gray-500">{{ group.emojis.length }} 个表情</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="openEditGroup(group)"
                  class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  编辑
                </button>
                <button
                  v-if="group.id !== 'favorites' && group.id !== 'nachoneko'"
                  @click="deleteGroup(group.id)"
                  class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legacy emoji management (remove this section) -->
      <div v-if="false" class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-900">表情管理</h2>
            <div class="flex gap-2">
              <select
                v-model="selectedGroupId"
                class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">所有分组</option>
                <option v-for="group in emojiStore.groups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </option>
              </select>
              <button
                @click="showAddEmojiModal = true"
                class="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                添加表情
              </button>
            </div>
          </div>
        </div>
        
        <div class="p-6">
          <div class="grid grid-cols-6 gap-4">
            <div
              v-for="emoji in filteredEmojis"
              :key="emoji.id"
              class="relative group border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
            >
              <img
                :src="emoji.url"
                :alt="emoji.name"
                class="w-full h-16 object-contain mb-2"
                @error="handleImageError"
              />
              <p class="text-xs text-gray-600 truncate">{{ emoji.name }}</p>
              <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click="deleteEmoji(emoji.id)"
                  class="w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="filteredEmojis.length === 0" class="text-center py-12">
            <p class="text-gray-500">暂无表情</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Create Group Modal -->
    <div
      v-if="showCreateGroupModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showCreateGroupModal = false"
    >
      <div
        class="bg-white rounded-lg p-6 w-full max-w-md"
        @click.stop
      >
        <h3 class="text-lg font-semibold mb-4">新建分组</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分组名称</label>
            <input
              v-model="newGroupName"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入分组名称"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分组颜色</label>
            <div class="flex gap-2">
              <div
                v-for="color in colorOptions"
                :key="color"
                class="w-8 h-8 rounded cursor-pointer border-2"
                :class="newGroupColor === color ? 'border-gray-900' : 'border-gray-300'"
                :style="{ backgroundColor: color }"
                @click="newGroupColor = color"
              ></div>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showCreateGroupModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="createGroup"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- Add Emoji Modal -->
    <div
      v-if="showAddEmojiModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showAddEmojiModal = false"
    >
      <div
        class="bg-white rounded-lg p-6 w-full max-w-md"
        @click.stop
      >
        <h3 class="text-lg font-semibold mb-4">添加表情</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">表情名称</label>
            <input
              v-model="newEmojiName"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入表情名称"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">图片URL</label>
            <input
              v-model="newEmojiUrl"
              type="url"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入图片链接"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">所属分组</label>
            <select
              v-model="newEmojiGroupId"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option v-for="group in emojiStore.groups" :key="group.id" :value="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>
          <div v-if="newEmojiUrl" class="text-center">
            <img
              :src="newEmojiUrl"
              alt="预览"
              class="w-16 h-16 object-contain mx-auto border border-gray-200 rounded"
              @error="handleImageError"
            />
          </div>
        </div>

          <!-- Edit Group Modal -->
          <div
            v-if="showEditGroupModal"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            @click="showEditGroupModal = false"
          >
            <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.stop>
              <h3 class="text-lg font-semibold mb-4">编辑分组</h3>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">分组名称</label>
                  <input v-model="editGroupName" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">分组图标/表情</label>
                  <input v-model="editGroupIcon" type="text" placeholder="例如：😀 或 📁" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                <button @click="showEditGroupModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors">取消</button>
                <button @click="saveEditGroup" class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">保存</button>
              </div>
            </div>
          </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showAddEmojiModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="addEmoji"
            class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            添加
          </button>
        </div>
      </div>
    </div>

    <!-- Import Configuration Modal -->
    <div
      v-if="showImportModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showImportModal = false"
    >
      <div
        class="bg-white rounded-lg p-6 w-full max-w-lg"
        @click.stop
      >
        <h3 class="text-lg font-semibold mb-4">导入配置</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">配置文件</label>
            <input
              ref="importFileInput"
              type="file"
              accept=".json"
              @change="handleImportFile"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">或粘贴JSON配置</label>
            <textarea
              v-model="importConfigText"
              rows="6"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="粘贴JSON配置内容..."
            ></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showImportModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="importConfiguration"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            导入
          </button>
        </div>
      </div>
    </div>

    <!-- Import Emoji Modal -->
    <div
      v-if="showImportEmojiModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showImportEmojiModal = false"
    >
      <div
        class="bg-white rounded-lg p-6 w-full max-w-lg"
        @click.stop
      >
        <h3 class="text-lg font-semibold mb-4">批量导入表情</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">表情文件</label>
            <input
              ref="importEmojiFileInput"
              type="file"
              accept=".json"
              @change="handleImportEmojiFile"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">或粘贴表情JSON</label>
            <textarea
              v-model="importEmojiText"
              rows="6"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="粘贴表情JSON内容..."
            ></textarea>
            <div class="mt-2 text-xs text-gray-500">
              示例：
              <button class="ml-2 text-blue-600 hover:underline" @click="fillEmojiJsonExample">填充示例</button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">目标分组（可选）</label>
            <select
              v-model="importTargetGroupId"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">自动按分组创建</option>
              <option v-for="group in emojiStore.groups" :key="group.id" :value="group.id">
                {{ group.name }}
              </option>
            </select>
            <p class="mt-1 text-xs text-gray-500">留空将根据JSON中的 groupId 自动创建/归类到分组</p>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="showImportEmojiModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="importEmojis"
            class="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            导入
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm Delete Group Modal -->
    <div
      v-if="showConfirmDeleteModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showConfirmDeleteModal = false"
    >
      <div
        class="bg-white rounded-lg p-6 w-full max-w-md"
        @click.stop
      >
        <h3 class="text-lg font-semibold mb-4">确认删除</h3>
        <p class="text-gray-600 mb-6">确定要删除分组 "{{ groupToDelete?.name }}" 吗？分组中的表情也会被删除。</p>
        <div class="flex justify-end gap-3">
          <button
            @click="showConfirmDeleteModal = false"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="deleteGroup"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- Success Toast -->
    <div
      v-if="showSuccessToast"
      class="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50"
    >
      {{ successMessage }}
    </div>

    <!-- Error Toast -->
    <div
      v-if="showErrorToast"
      class="fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50"
    >
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEmojiStore } from '../stores/emojiStore'
import type { EmojiGroup } from '../types/emoji'

const emojiStore = useEmojiStore()

// Tab navigation
const activeTab = ref('settings')
const tabs = [
  { id: 'settings', label: '设置' },
  { id: 'groups', label: '分组管理' },
  { id: 'stats', label: '统计' },
  { id: 'about', label: '关于' }
]

// Drag and drop state
const draggedGroup = ref<EmojiGroup | null>(null)
const draggedEmoji = ref<any>(null)
const draggedEmojiGroupId = ref<string>('')
const draggedEmojiIndex = ref<number>(-1)

// Group expansion state
const expandedGroups = ref<Set<string>>(new Set())

// Reactive data
const selectedGroupId = ref('')
const selectedGroupForAdd = ref('')
const showCreateGroupModal = ref(false)
const showAddEmojiModal = ref(false)
const showEditGroupModal = ref(false)
const showImportModal = ref(false)
const showImportEmojiModal = ref(false)
const showSuccessToast = ref(false)
const showErrorToast = ref(false)
const showConfirmDeleteModal = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const groupToDelete = ref<EmojiGroup | null>(null)

// New group data
const newGroupName = ref('')
const newGroupIcon = ref('📁')
const newGroupColor = ref('#3B82F6')
const colorOptions = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']

// Edit group state
const editingGroupId = ref<string>('')
const editGroupName = ref<string>('')
const editGroupIcon = ref<string>('')

// New emoji data
const newEmojiName = ref('')
const newEmojiUrl = ref('')
const newEmojiGroupId = ref('')

// Import data
const importConfigText = ref('')
const importEmojiText = ref('')
const importTargetGroupId = ref('')
const importFileInput = ref<HTMLInputElement>()
const importEmojiFileInput = ref<HTMLInputElement>()

// Computed properties
const filteredEmojis = computed(() => {
  if (!selectedGroupId.value) {
    // Return all emojis from all groups
    return emojiStore.groups.flatMap(group => group.emojis)
  }
  const group = emojiStore.groups.find(g => g.id === selectedGroupId.value)
  return group ? group.emojis : []
})

const totalEmojis = computed(() => {
  return emojiStore.groups.reduce((total, group) => total + (group.emojis?.length || 0), 0)
})

// Group management methods
const toggleGroupExpansion = (groupId: string) => {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
}

const confirmDeleteGroup = (group: EmojiGroup) => {
  groupToDelete.value = group
  showConfirmDeleteModal.value = true
}

const deleteGroup = async () => {
  if (groupToDelete.value) {
    await emojiStore.deleteGroup(groupToDelete.value.id)
    showSuccess(`分组 "${groupToDelete.value.name}" 已删除`)
    showConfirmDeleteModal.value = false
    groupToDelete.value = null
  }
}

// Drag and drop handlers
const handleDragStart = (group: EmojiGroup, event: DragEvent) => {
  draggedGroup.value = group
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDrop = async (targetGroup: EmojiGroup, event: DragEvent) => {
  event.preventDefault()
  if (draggedGroup.value && draggedGroup.value.id !== targetGroup.id) {
    // Reorder groups logic here
    await emojiStore.reorderGroups(draggedGroup.value.id, targetGroup.id)
    showSuccess('分组顺序已更新')
  }
  draggedGroup.value = null
}

const handleEmojiDragStart = (emoji: any, groupId: string, index: number, event: DragEvent) => {
  draggedEmoji.value = emoji
  draggedEmojiGroupId.value = groupId
  draggedEmojiIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleEmojiDrop = (targetGroupId: string, targetIndex: number, event: DragEvent) => {
  event.preventDefault()
  if (draggedEmoji.value && draggedEmojiGroupId.value) {
    emojiStore.moveEmoji(
      draggedEmojiGroupId.value,
      draggedEmojiIndex.value,
      targetGroupId,
      targetIndex
    )
    showSuccess('表情已移动')
  }
  resetEmojiDrag()
}

const removeEmojiFromGroup = (groupId: string, index: number) => {
  emojiStore.removeEmojiFromGroup(groupId, index)
  showSuccess('表情已删除')
}

const resetEmojiDrag = () => {
  draggedEmoji.value = null
  draggedEmojiGroupId.value = ''
  draggedEmojiIndex.value = -1
}

// Settings methods
const updateImageScale = (event: Event) => {
  const target = event.target as HTMLInputElement
  emojiStore.updateSettings({ imageScale: parseInt(target.value) })
}

const updateGridColumns = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emojiStore.updateSettings({ gridColumns: parseInt(target.value) })
}

const updateShowSearchBar = (event: Event) => {
  const target = event.target as HTMLInputElement
  emojiStore.updateSettings({ showSearchBar: target.checked })
}

const createGroup = () => {
  if (!newGroupName.value.trim()) {
    showError('请输入分组名称')
    return
  }

  emojiStore.createGroup(newGroupName.value.trim(), '📁')
  
  // Reset form
  newGroupName.value = ''
  newGroupColor.value = '#3B82F6'
  showCreateGroupModal.value = false
  
  showSuccess('分组创建成功')
}

const openEditGroup = (group: EmojiGroup) => {
  editingGroupId.value = group.id
  editGroupName.value = group.name
  editGroupIcon.value = group.icon
  showEditGroupModal.value = true
}

const saveEditGroup = () => {
  if (!editingGroupId.value) return
  if (!editGroupName.value.trim()) {
    showError('请输入分组名称')
    return
  }
  emojiStore.updateGroup(editingGroupId.value, {
    name: editGroupName.value.trim(),
    icon: editGroupIcon.value || '📁'
  })
  showEditGroupModal.value = false
  showSuccess('分组已更新')
}

const addEmoji = () => {
  if (!newEmojiName.value.trim() || !newEmojiUrl.value.trim() || !newEmojiGroupId.value) {
    showError('请填写完整的表情信息')
    return
  }

  const emojiData = {
    packet: Date.now(),
    name: newEmojiName.value.trim(),
    url: newEmojiUrl.value.trim()
  }

  emojiStore.addEmoji(newEmojiGroupId.value, emojiData)
  
  // Reset form
  newEmojiName.value = ''
  newEmojiUrl.value = ''
  newEmojiGroupId.value = ''
  showAddEmojiModal.value = false
  
  showSuccess('表情添加成功')
}

const deleteEmoji = (emojiId: string) => {
  if (confirm('确定要删除这个表情吗？')) {
    emojiStore.deleteEmoji(emojiId)
    showSuccess('表情删除成功')
  }
}

const exportConfiguration = () => {
  const config = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    settings: emojiStore.settings,
    groups: emojiStore.groups
  }

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `emoji-config-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  showSuccess('配置导出成功')
}

const handleImportFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      importConfigText.value = e.target?.result as string
    }
    reader.readAsText(file)
  }
}

const handleImportEmojiFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      importEmojiText.value = e.target?.result as string
    }
    reader.readAsText(file)
  }
}

const importConfiguration = () => {
  try {
    const config = JSON.parse(importConfigText.value)
    
    emojiStore.importConfiguration(config)
    
    importConfigText.value = ''
    showImportModal.value = false
    showSuccess('配置导入成功')
  } catch (error) {
    showError('配置文件格式错误')
  }
}

const importEmojis = async () => {
  try {
    const emojis = JSON.parse(importEmojiText.value);

    if (!Array.isArray(emojis)) {
      showError('表情数据格式错误，应该是数组格式');
      return;
    }

    // Batch import to avoid multiple saveData calls
    // Start a batch
    emojiStore.beginBatch();
    
    try {
      if (importTargetGroupId.value) {
        // Import all into target group
        emojis.forEach((emoji: any) => {
          const emojiData = {
            packet: Date.now() + Math.random() * 1000,
            name: emoji.name || emoji.alt || '未命名',
            url: emoji.url || emoji.src
          };
          emojiStore.addEmojiWithoutSave(importTargetGroupId.value, emojiData);
        });
      } else {
        // Auto create or use group by emoji.groupId
        const groupMap = new Map<string, string>(); // group name -> id
        emojiStore.groups.forEach(g => groupMap.set(g.name, g.id));
        emojis.forEach((emoji: any) => {
          const groupName = (emoji.groupId || emoji.group || '未分组').toString();
          let targetId = groupMap.get(groupName);
          if (!targetId) {
            const created = emojiStore.createGroupWithoutSave(groupName, '📁');
            if (created) {
              targetId = created.id;
              groupMap.set(groupName, targetId);
            } else {
              // Fallback to first available group if creation fails
              targetId = emojiStore.groups[0]?.id || 'nachoneko';
            }
          }
          if (targetId) {
            const emojiData = {
              packet: Number.isInteger(emoji.packet) ? emoji.packet : (Date.now() + Math.floor(Math.random() * 1000)),
              name: emoji.name || emoji.alt || '未命名',
              url: emoji.url || emoji.src
            };
            emojiStore.addEmojiWithoutSave(targetId, emojiData);
          }
        });
      }

      // Save all changes at once
      await emojiStore.saveData();
    } finally {
      // End batch
      await emojiStore.endBatch();
    }

    importEmojiText.value = '';
    importTargetGroupId.value = '';
    showImportEmojiModal.value = false;
    showSuccess(`成功导入 ${emojis.length} 个表情`);
  } catch (error) {
    showError('表情数据格式错误');
  }
};

const resetSettings = () => {
  if (confirm('确定要重置所有设置吗？这将清除所有自定义数据。')) {
    emojiStore.resetToDefaults()
    showSuccess('设置重置成功')
  }
}

const syncToChrome = async () => {
  try {
    // Force sync to chrome storage
    const success = await emojiStore.forceSync()
    if (success) {
      showSuccess('数据已上传到Chrome同步存储')
    } else {
      showError('同步失败，请检查网络连接')
    }
  } catch (error) {
    console.error('Sync error:', error)
    showError('同步失败，请重试')
  }
}

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzNkMzMC42Mjc0IDM2IDM2IDMwLjYyNzQgMzYgMjRDMzYgMTcuMzcyNiAzMC42Mjc0IDEyIDI0IDEyQzE3LjM3MjYgMTIgMTIgMTcuMzcyNiAxMiAyNEMxMiAzMC42Mjc0IDE3LjM3MjYgMzYgMjQgMzZaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIvPgo8cGF0aCBkPSJNMjEgMjFIMjdNMjEgMjdIMjciIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+'
}

const showSuccess = (message: string) => {
  successMessage.value = message
  showSuccessToast.value = true
  setTimeout(() => {
    showSuccessToast.value = false
  }, 3000)
}

const showError = (message: string) => {
  errorMessage.value = message
  showErrorToast.value = true
  setTimeout(() => {
    showErrorToast.value = false
  }, 3000)
}

// Initialize
onMounted(() => {
  emojiStore.loadData()
  
  // Set default values
  if (emojiStore.groups.length > 0) {
    newEmojiGroupId.value = emojiStore.groups[0].id
    importTargetGroupId.value = emojiStore.groups[0].id
  }
})

// Fill example JSON for emoji import
const fillEmojiJsonExample = () => {
  importEmojiText.value = JSON.stringify([
    { name: '微笑', url: 'https://example.com/smile.png', groupId: '常用' },
    { name: '点赞', url: 'https://example.com/thumbs-up.png', groupId: '常用' },
    { name: '爱心', url: 'https://example.com/heart.png', groupId: '红色' }
  ], null, 2)
}
</script>
