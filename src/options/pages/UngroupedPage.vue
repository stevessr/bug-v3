<script setup lang="ts">
import { inject } from 'vue'
import type { OptionsInject } from '../types'

import UngroupedTab from '../components/UngroupedTab.vue'

const options = inject<OptionsInject>('options')!

const { emojiStore, removeEmojiFromGroup, openEditEmoji } = options
</script>

<template>
  <UngroupedTab :emojiStore="emojiStore" @remove="removeEmojiFromGroup" @edit="openEditEmoji" />
</template>
