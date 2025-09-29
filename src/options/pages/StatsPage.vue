<script setup lang="ts">
import { inject } from 'vue'

import type { OptionsInject } from '../types'
import EmojiStats from '../components/EmojiStats.vue'

const options = inject<OptionsInject>('options')!

const { emojiStore, totalEmojis } = options
</script>

<template>
  <div class="space-y-8">
    <EmojiStats
      :groupCount="emojiStore.groups.length"
      :totalEmojis="totalEmojis"
      :favoritesCount="emojiStore.favorites.size"
    />
  </div>
</template>
