import { createRouter, createWebHashHistory } from 'vue-router'
import GlobalSettings from './views/GlobalSettings.vue'
import GroupsManagement from './views/GroupsManagement.vue'
import FavoritesManagement from './views/FavoritesManagement.vue'
import UngroupedManagement from './views/UngroupedManagement.vue'
import ExternalImport from './views/ExternalImport.vue'
import Statistics from './views/Statistics.vue'
import About from './views/About.vue'

const routes = [
  {
    path: '/',
    redirect: '/settings'
  },
  {
    path: '/settings',
    name: 'settings',
    component: GlobalSettings,
    meta: { title: '设置', icon: '⚙️' }
  },
  {
    path: '/groups',
    name: 'groups',
    component: GroupsManagement,
    meta: { title: '分组管理', icon: '📁' }
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: FavoritesManagement,
    meta: { title: '收藏夹', icon: '⭐' }
  },
  {
    path: '/ungrouped',
    name: 'ungrouped',
    component: UngroupedManagement,
    meta: { title: '未分组', icon: '📋' }
  },
  {
    path: '/import',
    name: 'import',
    component: ExternalImport,
    meta: { title: '外部导入', icon: '📥' }
  },
  {
    path: '/stats',
    name: 'stats',
    component: Statistics,
    meta: { title: '统计信息', icon: '📊' }
  },
  {
    path: '/about',
    name: 'about',
    component: About,
    meta: { title: '关于', icon: 'ℹ️' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router