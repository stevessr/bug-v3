<template>
  <div class="flex border-b border-gray-100 overflow-x-auto">
    <button
      v-for="group in groups"
      :key="group.id"
      @click="setActive(group.id)"
      :class="[
        'flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
        activeGroupId === group.id
          ? 'border-blue-500 text-blue-600 bg-blue-50'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
      ]"
    >
      <span class="mr-1">
        <template v-if="isImageUrl(group.icon)">
          <img
            :src="group.icon"
            alt="group icon"
            class="w-4 h-4 object-contain inline-block"
          />
        </template>
        <template v-else>
          {{ group.icon }}
        </template>
      </span>
      {{ group.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from "vue";
import type { EmojiGroup } from "../../types/emoji";
import { isImageUrl } from "../../utils/isImageUrl";

const props = defineProps<{
  groups: EmojiGroup[];
  activeGroupId: string | null;
  setActive: (id: string) => void;
}>();

const { groups, activeGroupId, setActive } = props;

// isImageUrl is imported and usable directly in the template
</script>
