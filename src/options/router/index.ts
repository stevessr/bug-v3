import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 页面组件
import SettingsPage from '../pages/SettingsPage.vue'
import FavoritesPage from '../pages/FavoritesPage.vue'
import GroupsPage from '../pages/GroupsPage.vue'
import UngroupedPage from '../pages/UngroupedPage.vue'
import BilibiliPage from '../pages/BilibiliPage.vue'
import TenorPage from '../pages/TenorPage.vue'
import WalinePage from '../pages/WalinePage.vue'
import StatsPage from '../pages/StatsPage.vue'
import AboutPage from '../pages/AboutPage.vue'
import VideoToGifPage from '../pages/VideoToGifPage.vue'

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
    path: '/bilibili',
    name: 'bilibili',
    component: BilibiliPage,
    meta: {
      title: 'Bilibili 导入'
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
    path: '/waline',
    name: 'waline',
    component: WalinePage,
    meta: {
      title: 'Waline 导入'
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
    path: '/video2gif',
    name: 'video2gif',
    component: VideoToGifPage,
    meta: {
      title: '视频转 GIF'
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
  history: createWebHistory(),
  routes
})

export default router
