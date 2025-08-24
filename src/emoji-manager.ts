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
  Tag,
  Form,
  FormItem,
  Input,
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
    ATag: Tag,
    AForm: Form,
    AFormItem: FormItem,
    AInput: Input,
    ASlider: Slider,
    ARadioGroup: RadioGroup,
    ARadio: Radio,
    ACheckbox: Checkbox,
    ASpace: Space,
    ADivider: Divider,
    AModal: Modal,
    ATextarea: Textarea,
    ARow: Row,
    ACol: Col
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
      importFormat: 'json'
    }
  },
  mounted() {
    this.loadData()
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
    }
  }
})

app.mount('#app')