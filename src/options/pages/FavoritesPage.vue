<script setup lang="ts">
import { inject } from 'vue'

import type { OptionsInject } from '../types'
import FavoritesTab from '../components/FavoritesTab'

const options = inject<OptionsInject>('options')!

const { removeEmojiFromGroup, openEditEmoji } = options
</script>

<template>
  <FavoritesTab @remove="removeEmojiFromGroup" @edit="openEditEmoji" />
</template>
