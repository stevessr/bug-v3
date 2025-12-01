import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 页面组件
import SettingsPage from '../pages/SettingsPage.vue'
import FavoritesPage from '../pages/FavoritesPage.vue'
import GroupsPage from '../pages/GroupsPage.vue'
import UngroupedPage from '../pages/UngroupedPage.vue'
import TenorPage from '../pages/TenorPage.vue'
import StatsPage from '../pages/StatsPage.vue'
import AboutPage from '../pages/AboutPage.vue'
import DuplicateDetectionPage from '../pages/DuplicateDetectionPage.vue'
import AIRenamePage from '../pages/ai-rename/AIRenamePage.vue'
import SyncSettingsPage from '../pages/SyncSettingsPage.vue'
import BufferPage from '../pages/BufferPage.vue'

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
    path: '/tenor',
    name: 'tenor',
    component: TenorPage,
    meta: {
      title: 'Tenor GIF'
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
    path: '/duplicates',
    name: 'duplicates',
    component: DuplicateDetectionPage,
    meta: {
      title: '重复检测'
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
    path: '/sync',
    name: 'sync',
    component: SyncSettingsPage,
    meta: {
      title: '云同步'
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
