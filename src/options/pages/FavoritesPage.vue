<script setup lang="ts">
import { inject } from 'vue'
import type { OptionsInject } from '../types'

import FavoritesTab from '../components/FavoritesTab.vue'

const options = inject<OptionsInject>('options')!

const {
  emojiStore,
  removeEmojiFromGroup,
  openEditEmoji
} = options
</script>

<template>
  <FavoritesTab
    :emojiStore="emojiStore"
    @remove="removeEmojiFromGroup"
    @edit="openEditEmoji"
  />
</template>