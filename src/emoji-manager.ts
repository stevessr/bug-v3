import { createApp } from 'vue'
import {
  Layout,
  LayoutHeader,
  LayoutSider,
  LayoutContent,
  Menu,
  MenuItem,
  Button,
  List,
  ListItem,
  ListItemMeta,
  Tag,
  Form,
  FormItem,
  Input,
  InputPassword,
  Slider,
  RadioGroup,
  Radio,
  Checkbox,
  Space,
  Divider,
  Modal,
  Textarea,
  Row,
  Col,
  Select,
  SelectOption,
  Upload,
  Progress,
  Typography,
  message
} from 'ant-design-vue'

const app = createApp({
  components: {
    ALayout: Layout,
    ALayoutHeader: LayoutHeader,
    ALayoutSider: LayoutSider,
    ALayoutContent: LayoutContent,
    AMenu: Menu,
    AMenuItem: MenuItem,
    AButton: Button,
    AList: List,
    AListItem: ListItem,
    AListItemMeta: ListItemMeta,
    ATag: Tag,
    AForm: Form,
    AFormItem: FormItem,
    AInput: Input,
    AInputPassword: InputPassword,
    ASlider: Slider,
    ARadioGroup: RadioGroup,
    ARadio: Radio,
    ACheckbox: Checkbox,
    ASpace: Space,
    ADivider: Divider,
    AModal: Modal,
    ATextarea: Textarea,
    ARow: Row,
    ACol: Col,
    ASelect: Select,
    ASelectOption: SelectOption,
    AUpload: Upload,
    AProgress: Progress,
    AText: Typography.Text
  },
  data() {
    return {
      activeTab: 'groups',
      selectedKeys: ['groups'],
      emojiGroups: [],
      settings: {
        imageScale: 30,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        defaultGroup: 'nachoneko',
        showSearchBar: true
      },
      favorites: [],
      showCreateGroupModal: false,
      showEditGroupModal: false,
      showAddEmojiModal: false,
      showImportModal: false,
      newGroup: { name: '', icon: '📁' },
      editingGroup: { id: '', name: '', icon: '' },
      newEmoji: { name: '', url: '', groupId: '' },
      importData: '',
      importFormat: 'json',
      
      // External Import
      tenorSearchQuery: '',
      tenorResults: [],
      tenorLoading: false,
      walineUrl: '',
      walineLoading: false,
      
      // AI Rename
      aiProvider: 'gemini',
      aiApiKey: '',
      aiBaseUrl: '',
      aiModel: 'gpt-4-vision-preview',
      selectedGroupForRename: '',
      selectedEmojisForRename: [],
      aiRenameLoading: false,
      aiRenameProgress: { completed: 0, total: 0 },
      renameResults: [],
      chromeAiAvailable: false,
      edgeAiAvailable: false
    }
  },
  mounted() {
    this.loadData()
    this.checkBrowserAiAvailability()
  },
  methods: {
    loadData() {
      // Load emoji groups from storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['emojiGroups', 'emojiSettings', 'favorites'], (result) => {
          this.emojiGroups = result.emojiGroups || []
          this.settings = { ...this.settings, ...(result.emojiSettings || {}) }
          this.favorites = result.favorites || []
        })
      }
    },
    
    saveData() {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({
          emojiGroups: this.emojiGroups,
          emojiSettings: this.settings,
          favorites: this.favorites
        })
      }
    },

    onMenuClick({ key }: { key: string }) {
      this.activeTab = key
      this.selectedKeys = [key]
    },

    // Group management
    createGroup() {
      if (!this.newGroup.name) {
        message.error('请输入分组名称')
        return
      }

      const newGroup = {
        id: Date.now().toString(),
        name: this.newGroup.name,
        icon: this.newGroup.icon,
        emojis: []
      }

      this.emojiGroups.push(newGroup)
      this.saveData()
      this.showCreateGroupModal = false
      this.newGroup = { name: '', icon: '📁' }
      message.success('分组创建成功')
    },

    editGroup(group: any) {
      this.editingGroup = { ...group }
      this.showEditGroupModal = true
    },

    updateGroup() {
      const index = this.emojiGroups.findIndex(g => g.id === this.editingGroup.id)
      if (index !== -1) {
        this.emojiGroups[index] = { ...this.editingGroup }
        this.saveData()
        this.showEditGroupModal = false
        message.success('分组更新成功')
      }
    },

    deleteGroup(groupId: string) {
      this.emojiGroups = this.emojiGroups.filter(g => g.id !== groupId)
      this.saveData()
      message.success('分组删除成功')
    },

    // Emoji management
    addEmoji() {
      if (!this.newEmoji.name || !this.newEmoji.url || !this.newEmoji.groupId) {
        message.error('请填写完整信息')
        return
      }

      const group = this.emojiGroups.find(g => g.id === this.newEmoji.groupId)
      if (group) {
        group.emojis.push({
          id: Date.now().toString(),
          name: this.newEmoji.name,
          url: this.newEmoji.url
        })
        this.saveData()
        this.showAddEmojiModal = false
        this.newEmoji = { name: '', url: '', groupId: '' }
        message.success('表情添加成功')
      }
    },

    deleteEmoji(groupId: string, emojiId: string) {
      const group = this.emojiGroups.find(g => g.id === groupId)
      if (group) {
        group.emojis = group.emojis.filter((e: any) => e.id !== emojiId)
        this.saveData()
        message.success('表情删除成功')
      }
    },

    // Favorites
    toggleFavorite(emoji: any) {
      const index = this.favorites.findIndex(f => f.id === emoji.id)
      if (index !== -1) {
        this.favorites.splice(index, 1)
      } else {
        this.favorites.push(emoji)
      }
      this.saveData()
    },

    isFavorite(emoji: any) {
      return this.favorites.some(f => f.id === emoji.id)
    },

    // Settings
    saveSettings() {
      this.saveData()
      message.success('设置保存成功')
    },

    resetSettings() {
      this.settings = {
        imageScale: 30,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        defaultGroup: 'nachoneko',
        showSearchBar: true
      }
      this.saveData()
      message.success('设置重置成功')
    },

    // Import/Export
    exportData() {
      const data = {
        groups: this.emojiGroups,
        settings: this.settings,
        favorites: this.favorites
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'emoji-data.json'
      a.click()
      URL.revokeObjectURL(url)
      message.success('数据导出成功')
    },

    importData() {
      try {
        const data = JSON.parse(this.importData)
        
        if (this.importFormat === 'merge') {
          // Merge with existing data
          this.emojiGroups = [...this.emojiGroups, ...(data.groups || [])]
          this.favorites = [...this.favorites, ...(data.favorites || [])]
        } else {
          // Replace existing data
          this.emojiGroups = data.groups || []
          this.favorites = data.favorites || []
          if (data.settings) {
            this.settings = { ...this.settings, ...data.settings }
          }
        }
        
        this.saveData()
        this.showImportModal = false
        this.importData = ''
        message.success('数据导入成功')
      } catch (error) {
        message.error('数据格式错误，请检查JSON格式')
      }
    },

    // Utilities
    getEmojiCount() {
      return this.emojiGroups.reduce((total, group) => total + (group.emojis?.length || 0), 0)
    },

    getGroupEmojiCount(group: any) {
      return group.emojis?.length || 0
    },

    // Browser AI Availability Check
    async checkBrowserAiAvailability() {
      // Check Chrome AI
      try {
        if (typeof window !== 'undefined' && (window as any).chrome?.ai) {
          this.chromeAiAvailable = true
        }
      } catch (error) {
        console.log('Chrome AI not available')
      }

      // Check Edge AI
      try {
        if (typeof window !== 'undefined' && (window as any).navigator?.ml) {
          this.edgeAiAvailable = true
        }
      } catch (error) {
        console.log('Edge AI not available')
      }
    },

    // External Import Methods
    async searchTenorGifs() {
      if (!this.tenorSearchQuery.trim()) {
        message.error('请输入搜索关键词')
        return
      }

      this.tenorLoading = true
      try {
        const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(this.tenorSearchQuery)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&limit=20`)
        const data = await response.json()
        this.tenorResults = data.results || []
        
        if (this.tenorResults.length === 0) {
          message.info('未找到相关 GIF')
        }
      } catch (error) {
        console.error('Tenor 搜索失败:', error)
        message.error('搜索失败，请重试')
      } finally {
        this.tenorLoading = false
      }
    },

    async importTenorGif(gif: any) {
      // Show group selection dialog
      const groupId = await this.selectTargetGroup()
      if (!groupId) return

      const group = this.emojiGroups.find(g => g.id === groupId)
      if (group) {
        const emoji = {
          id: Date.now().toString(),
          name: gif.content_description || `gif_${Date.now()}`,
          url: gif.media_formats.tinygif.url
        }
        
        group.emojis.push(emoji)
        this.saveData()
        message.success(`已导入 GIF: ${emoji.name}`)
      }
    },

    async importWalineEmojis() {
      if (!this.walineUrl.trim()) {
        message.error('请输入 Waline 表情包 URL')
        return
      }

      this.walineLoading = true
      try {
        const response = await fetch(this.walineUrl)
        const emojis = await response.json()
        
        // Create or get Waline group
        let walineGroup = this.emojiGroups.find(g => g.name === 'Waline 表情')
        if (!walineGroup) {
          walineGroup = {
            id: Date.now().toString(),
            name: 'Waline 表情',
            icon: '💬',
            emojis: []
          }
          this.emojiGroups.push(walineGroup)
        }

        // Import emojis
        Object.entries(emojis).forEach(([name, url]) => {
          walineGroup.emojis.push({
            id: Date.now().toString() + Math.random(),
            name,
            url: url as string
          })
        })

        this.saveData()
        message.success(`已导入 ${Object.keys(emojis).length} 个 Waline 表情`)
      } catch (error) {
        console.error('Waline 导入失败:', error)
        message.error('导入失败，请检查 URL 是否正确')
      } finally {
        this.walineLoading = false
      }
    },

    handleLocalImport(file: File) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const groupId = await this.selectTargetGroup()
        if (!groupId) return

        const group = this.emojiGroups.find(g => g.id === groupId)
        if (group) {
          const emoji = {
            id: Date.now().toString(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            url: dataUrl
          }
          
          group.emojis.push(emoji)
          this.saveData()
          message.success(`已导入图片: ${emoji.name}`)
        }
      }
      reader.readAsDataURL(file)
      return false // Prevent upload
    },

    async selectTargetGroup(): Promise<string | null> {
      return new Promise((resolve) => {
        const modal = Modal.confirm({
          title: '选择目标分组',
          content: () => {
            const div = document.createElement('div')
            div.innerHTML = this.emojiGroups.map(g => 
              `<div style="padding: 8px; cursor: pointer; border: 1px solid #ddd; margin: 4px; border-radius: 4px" data-group-id="${g.id}">
                ${g.icon} ${g.name}
              </div>`
            ).join('')
            
            div.addEventListener('click', (e) => {
              const target = e.target as HTMLElement
              const groupId = target.getAttribute('data-group-id')
              if (groupId) {
                modal.destroy()
                resolve(groupId)
              }
            })
            
            return div
          },
          onCancel: () => resolve(null)
        })
      })
    },

    // AI Rename Methods
    onAiProviderChange() {
      // Reset fields when provider changes
      this.aiApiKey = ''
      this.aiBaseUrl = ''
      this.aiModel = this.aiProvider === 'openai-compatible' ? 'gpt-4-vision-preview' : ''
    },

    isLocalAi(provider: string) {
      return provider === 'chrome-ai' || provider === 'edge-ai'
    },

    selectGroupForRename(groupId: string) {
      this.selectedGroupForRename = groupId
      this.selectedEmojisForRename = []
    },

    getSelectedGroupEmojis() {
      const group = this.emojiGroups.find(g => g.id === this.selectedGroupForRename)
      return group?.emojis || []
    },

    toggleEmojiSelection(emoji: any) {
      const index = this.selectedEmojisForRename.findIndex(e => e.id === emoji.id || e.name === emoji.name)
      if (index !== -1) {
        this.selectedEmojisForRename.splice(index, 1)
      } else {
        this.selectedEmojisForRename.push(emoji)
      }
    },

    canStartRename() {
      return this.selectedEmojisForRename.length > 0 && 
             (this.isLocalAi(this.aiProvider) || this.aiApiKey.trim().length > 0)
    },

    async startAiRename() {
      if (!this.canStartRename()) return

      this.aiRenameLoading = true
      this.aiRenameProgress = { completed: 0, total: this.selectedEmojisForRename.length }
      this.renameResults = []

      for (const emoji of this.selectedEmojisForRename) {
        try {
          const suggestions = await this.getAiSuggestions(emoji)
          this.renameResults.push({
            emoji,
            suggestions,
            selectedSuggestion: 0
          })
        } catch (error) {
          console.error('AI 重命名失败:', error)
          message.error(`AI 重命名失败: ${emoji.name}`)
        }
        
        this.aiRenameProgress.completed++
      }

      this.aiRenameLoading = false
      message.success(`完成 ${this.renameResults.length} 个表情的 AI 重命名`)
    },

    async getAiSuggestions(emoji: any): Promise<string[]> {
      const prompt = `请为这个表情图片提供3个简洁的中文名称建议。要求：
1. 名称简短（1-4个字）
2. 准确描述图片内容
3. 适合用作表情包名称
4. 只返回3个名称，用逗号分隔`

      switch (this.aiProvider) {
        case 'gemini':
          return this.callGeminiApi(prompt, emoji.url)
        case 'openai':
          return this.callOpenAiApi(prompt, emoji.url)
        case 'claude':
          return this.callClaudeApi(prompt, emoji.url)
        case 'openai-compatible':
          return this.callOpenAiCompatibleApi(prompt, emoji.url)
        case 'chrome-ai':
          return this.callChromeAi(prompt, emoji.url)
        case 'edge-ai':
          return this.callEdgeAi(prompt, emoji.url)
        default:
          throw new Error('不支持的 AI 提供商')
      }
    },

    async callGeminiApi(prompt: string, imageUrl: string): Promise<string[]> {
      const imageData = await this.getImageAsBase64(imageUrl)
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.aiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { 
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageData.split(',')[1]
                }
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      return text.split(',').map((s: string) => s.trim()).slice(0, 3)
    },

    async callOpenAiApi(prompt: string, imageUrl: string): Promise<string[]> {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.aiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }],
          max_tokens: 100
        })
      })

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''
      return text.split(',').map((s: string) => s.trim()).slice(0, 3)
    },

    async callClaudeApi(prompt: string, imageUrl: string): Promise<string[]> {
      const imageData = await this.getImageAsBase64(imageUrl)
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.aiApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { 
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageData.split(',')[1]
                }
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      return text.split(',').map((s: string) => s.trim()).slice(0, 3)
    },

    async callOpenAiCompatibleApi(prompt: string, imageUrl: string): Promise<string[]> {
      const response = await fetch(`${this.aiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.aiApiKey}`
        },
        body: JSON.stringify({
          model: this.aiModel,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }],
          max_tokens: 100
        })
      })

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''
      return text.split(',').map((s: string) => s.trim()).slice(0, 3)
    },

    async callChromeAi(prompt: string, imageUrl: string): Promise<string[]> {
      // Chrome AI implementation (requires Chrome 127+ with AI features enabled)
      try {
        const session = await (window as any).chrome.ai.createTextSession()
        const response = await session.prompt(`${prompt}\n\n基于图片: ${imageUrl}`)
        return response.split(',').map((s: string) => s.trim()).slice(0, 3)
      } catch (error) {
        throw new Error('Chrome AI 不可用，请确保使用支持 AI 的 Chrome 版本')
      }
    },

    async callEdgeAi(prompt: string, imageUrl: string): Promise<string[]> {
      // Edge AI implementation (requires Edge with AI features enabled)
      try {
        const response = await (window as any).navigator.ml.generateText({
          prompt: `${prompt}\n\n基于图片: ${imageUrl}`,
          maxTokens: 100
        })
        return response.split(',').map((s: string) => s.trim()).slice(0, 3)
      } catch (error) {
        throw new Error('Edge AI 不可用，请确保使用支持 AI 的 Edge 版本')
      }
    },

    async getImageAsBase64(imageUrl: string): Promise<string> {
      if (imageUrl.startsWith('data:')) {
        return imageUrl
      }
      
      try {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch (error) {
        throw new Error('无法获取图片数据')
      }
    },

    selectSuggestion(result: any, index: number) {
      result.selectedSuggestion = index
    },

    applyRename(result: any) {
      const emoji = result.emoji
      const newName = result.suggestions[result.selectedSuggestion]
      
      if (!newName) {
        message.error('请选择一个建议名称')
        return
      }

      // Find the emoji in groups and update name
      for (const group of this.emojiGroups) {
        const emojiIndex = group.emojis.findIndex((e: any) => 
          e.id === emoji.id || (e.name === emoji.name && e.url === emoji.url)
        )
        
        if (emojiIndex !== -1) {
          group.emojis[emojiIndex].name = newName
          break
        }
      }

      this.saveData()
      
      // Remove from results
      const resultIndex = this.renameResults.findIndex(r => r.emoji === emoji)
      if (resultIndex !== -1) {
        this.renameResults.splice(resultIndex, 1)
      }
      
      message.success(`已重命名: ${emoji.name} → ${newName}`)
    },

    rejectRename(result: any) {
      const resultIndex = this.renameResults.findIndex(r => r.emoji === result.emoji)
      if (resultIndex !== -1) {
        this.renameResults.splice(resultIndex, 1)
      }
      message.info('已拒绝重命名建议')
    }
  }
})

app.mount('#app')