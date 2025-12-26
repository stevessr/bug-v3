import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 页面组件
import SettingsPage from '../pages/SettingsPage.vue'
import FavoritesPage from '../pages/FavoritesPage.vue'
import GroupsPage from '../pages/GroupsPage.vue'
import UngroupedPage from '../pages/UngroupedPage.vue'
import ArchivedPage from '../pages/ArchivedPage.vue'
import StatsPage from '../pages/StatsPage.vue'
import AboutPage from '../pages/AboutPage.vue'
import AIRenamePage from '../pages/ai-rename/AIRenamePage.vue'
import BufferPage from '../pages/BufferPage.vue'
import BilibiliImportPage from '../pages/BilibiliImportPage.vue'
import ExportPage from '../pages/ExportPage.vue'
import MarketPage from '../pages/MarketPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: {
      title: '设置'
    }
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: FavoritesPage,
    meta: {
      title: '常用'
    }
  },
  {
    path: '/groups',
    name: 'groups',
    component: GroupsPage,
    meta: {
      title: '分组管理'
    }
  },
  {
    path: '/ungrouped',
    name: 'ungrouped',
    component: UngroupedPage,
    meta: {
      title: '未分组'
    }
  },
  {
    path: '/archived',
    name: 'archived',
    component: ArchivedPage,
    meta: {
      title: '已归档'
    }
  },
  {
    path: '/stats',
    name: 'stats',
    component: StatsPage,
    meta: {
      title: '统计'
    }
  },
  {
    path: '/ai-rename',
    name: 'ai-rename',
    component: AIRenamePage,
    meta: {
      title: 'AI 批量重命名'
    }
  },
  {
    path: '/buffer',
    name: 'buffer',
    component: BufferPage,
    meta: {
      title: '缓冲区'
    }
  },
  {
    path: '/bilibili-import',
    name: 'bilibili-import',
    component: BilibiliImportPage,
    meta: {
      title: 'Bilibili 导入'
    }
  },
  {
    path: '/export',
    name: 'export',
    component: ExportPage,
    meta: {
      title: '导出表情'
    }
  },
  {
    path: '/market',
    name: 'market',
    component: MarketPage,
    meta: {
      title: '云端市场'
    }
  },
  {
    path: '/about',
    name: 'about',
    component: AboutPage,
    meta: {
      title: '关于'
    }
  }
]

const router = createRouter({
  // Use HTML5 history mode (no hash)
  history: createWebHashHistory(),
  routes
})

export default router
