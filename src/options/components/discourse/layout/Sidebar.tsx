import { defineComponent } from 'vue'

import type { DiscourseCategory, DiscourseUser, TopicListType } from '../types'
import SidebarTopicList from './SidebarTopicList'
import SidebarQuickLinks from './SidebarQuickLinks'
import SidebarCategories from './SidebarCategories'
import SidebarActiveUsers from './SidebarActiveUsers'
import SidebarStats from './SidebarStats'
import '../css/Sidebar.css'

export default defineComponent({
  name: 'Sidebar',
  props: {
    categories: { type: Array as () => DiscourseCategory[], required: true },
    users: { type: Array as () => DiscourseUser[], required: true },
    baseUrl: { type: String, required: true },
    topicListType: { type: String as () => TopicListType, required: true }
  },
  emits: ['clickCategory', 'clickUser', 'changeTopicListType', 'navigateTo'],
  setup(props, { emit }) {
    const topicListTypes: Array<{ value: TopicListType; label: string }> = [
      { value: 'latest', label: '最新' },
      { value: 'new', label: '新' },
      { value: 'unread', label: '未读' },
      { value: 'unseen', label: '未见' },
      { value: 'top', label: '顶流' },
      { value: 'hot', label: '火热' },
      { value: 'posted', label: '我的帖子' },
      { value: 'bookmarks', label: '书签' }
    ]

    const quickLinks: Array<{ path: string; label: string; icon: string }> = [
      { path: '/search', label: '搜索', icon: 'discourse-chat-search' },
      { path: '/categories', label: '分类', icon: 'folder' },
      { path: '/tags', label: '标签', icon: 'tags' },
      { path: '/posted', label: '我的帖子', icon: 'edit' },
      { path: '/bookmarks', label: '书签', icon: 'bookmark' },
      { path: '/notifications', label: '通知', icon: 'bell' }
    ]

    const buildNavigationUrl = (path: string) => {
      if (!path) return props.baseUrl
      if (path.startsWith('http://') || path.startsWith('https://')) return path
      if (!props.baseUrl) return path

      const base = props.baseUrl.replace(/\/+$/, '')
      const normalizedPath = path.startsWith('/') ? path : `/${path}`
      return `${base}${normalizedPath}`
    }

    const handleNavigateTo = (path: string) => {
      emit('navigateTo', buildNavigationUrl(path))
    }

    return () => (
      <div class="sidebar space-y-4">
        <SidebarTopicList
          topicListType={props.topicListType}
          items={topicListTypes}
          onChange={(type: TopicListType) => emit('changeTopicListType', type)}
        />

        <SidebarQuickLinks links={quickLinks} onNavigate={handleNavigateTo} />

        {props.categories.length > 0 && (
          <SidebarCategories
            categories={props.categories}
            baseUrl={props.baseUrl}
            onSelect={(category: DiscourseCategory) => emit('clickCategory', category)}
          />
        )}

        {props.users.length > 0 && (
          <SidebarActiveUsers
            users={props.users}
            baseUrl={props.baseUrl}
            onSelect={(username: string) => emit('clickUser', username)}
          />
        )}

        <SidebarStats categoriesCount={props.categories.length} usersCount={props.users.length} />
      </div>
    )
  }
})
