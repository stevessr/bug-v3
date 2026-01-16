import { createRouter, createWebHashHistory, createMemoryHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 优化：使用动态导入实现路由懒加载
// 这可以显著减少初始 bundle 体积，加快选项页启动速度
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/groups'
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../pages/SettingsPage.vue'),
    meta: {
      title: '设置'
    }
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('../pages/FavoritesPage.vue'),
    meta: {
      title: '常用'
    }
  },
  {
    path: '/groups',
    name: 'groups',
    component: () => import('../pages/GroupsPage.vue'),
    meta: {
      title: '分组管理'
    }
  },
  {
    path: '/ungrouped',
    name: 'ungrouped',
    component: () => import('../pages/UngroupedPage.vue'),
    meta: {
      title: '未分组'
    }
  },
  {
    path: '/archived',
    name: 'archived',
    component: () => import('../pages/ArchivedPage.vue'),
    meta: {
      title: '已归档'
    }
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('../pages/StatsPage.vue'),
    meta: {
      title: '统计'
    }
  },
  {
    path: '/ai-rename',
    name: 'ai-rename',
    component: () => import('../pages/ai-rename/AIRenamePage.vue'),
    meta: {
      title: 'AI 批量重命名'
    }
  },
  {
    path: '/buffer',
    name: 'buffer',
    component: () => import('../pages/BufferPage.vue'),
    meta: {
      title: '缓冲区'
    }
  },
  {
    path: '/bilibili-import',
    name: 'bilibili-import',
    component: () => import('../pages/BilibiliImportPage.vue'),
    meta: {
      title: 'Bilibili 导入'
    }
  },
  {
    path: '/telegram-import',
    name: 'telegram-import',
    component: () => import('../pages/TelegramImportPage.vue'),
    meta: {
      title: 'Telegram 导入'
    }
  },
  {
    path: '/export',
    name: 'export',
    component: () => import('../pages/ExportPage.vue'),
    meta: {
      title: '导出表情'
    }
  },
  {
    path: '/market',
    name: 'market',
    component: () => import('../pages/MarketPage.vue'),
    meta: {
      title: '云端市场'
    }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../pages/AboutPage.vue'),
    meta: {
      title: '关于'
    }
  }
]

const router = createRouter({
  // Use hash history for browser environments, memory history for SSR
  history: typeof window !== 'undefined' ? createWebHashHistory() : createMemoryHistory(),
  routes
})

export default router
