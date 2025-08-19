<template>
  <div class="options-root p-4">
    <div class="toolbar flex justify-between items-center mb-3">
      <div>
        <button @click="addNewGroup" class="btn btn-primary">Add New Group</button>
      </div>
      <div class="flex items-center gap-2">
        <button @click="resetToDefault" class="btn">恢复默认</button>
        <button @click="saveEmojiData(emojiData)" class="btn btn-primary">保存</button>
      </div>
    </div>

    <div class="status text-green-600 mb-2" v-if="status">{{ status }}</div>

    <div class="groups space-y-3">
      <draggable v-model="emojiData" item-key="group" @end="onGroupDragEnd">
        <template #item="{element: group, index: groupIndex}">
          <div class="group-card card p-3 mb-3 rounded-md bg-white">
            <div class="flex justify-between items-center mb-2">
              <div class="flex items-center gap-2">
                <img v-if="group.icon" :src="group.icon" :alt="group.group" class="w-8 h-8 object-cover rounded" />
                <input :value="group.group" @input="(e) => updateGroupName(groupIndex, (e.target as HTMLInputElement).value)" placeholder="Group Name" class="w-36 px-2 py-1 border rounded" />
                <input :value="group.icon || ''" @input="(e) => updateGroupIcon(groupIndex, (e.target as HTMLInputElement).value)" placeholder="Icon URL" class="w-44 px-2 py-1 border rounded" />
              </div>
              <div>
                <button @click="deleteGroup(groupIndex)" class="btn btn-primary">删除分组</button>
              </div>
            </div>

            <div v-if="group.icon" class="flex items-center gap-2 mb-2">
              <img :src="group.icon" :alt="group.group" class="w-12 h-12 object-cover rounded-md" />
              <div class="font-semibold">{{ group.group }}</div>
            </div>

            <ul class="list-none p-0 m-0">
              <draggable v-model="group.emojis" :group="{ name: 'emojis' }" item-key="url" @end="() => onEmojiDragEnd(groupIndex)">
                <template #item="{element: emoji, index: emojiIndex}">
                  <li class="flex justify-between items-center p-2 border-b">
                    <div class="flex items-center gap-2 max-w-[70%]">
                      <template v-if="isLinux(emoji.url)">
                        <img :src="emoji.url" :alt="emoji.name" width="36" height="36" class="rounded-md object-cover" />
                      </template>
                      <div class="flex flex-col">
                        <div class="font-medium">{{ emoji.name }}</div>
                        <div class="text-sm text-gray-500 break-words max-w-[420px]">{{ emoji.url }}</div>
                      </div>
                    </div>
                    <div class="flex gap-2 items-center">
                      <button @click="openExternal(emoji.url)" class="btn">打开</button>
                      <button @click="copyUrl(emoji.url)" class="btn">复制</button>
                      <button @click="deleteEmoji(groupIndex, emojiIndex)" class="btn btn-primary">删除</button>
                    </div>
                  </li>
                </template>
              </draggable>
            </ul>

            <div class="mt-2">
              <button @click="addNewEmoji(groupIndex)" class="btn">Add Emoji</button>
            </div>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable';
import * as api from './options.ts';

// expose draggable as a local component
const components = { draggable } as any;

// re-export helpers for template usage
const emojiData = (api as any).emojiData;
const status = (api as any).status;
const addNewGroup = (api as any).addNewGroup;
const resetToDefault = (api as any).resetToDefault;
const saveEmojiData = (api as any).saveEmojiData;
const deleteGroup = (api as any).deleteGroup;
const updateGroupName = (api as any).updateGroupName;
const updateGroupIcon = (api as any).updateGroupIcon;
const addNewEmoji = (api as any).addNewEmoji;
const deleteEmoji = (api as any).deleteEmoji;
const onGroupDragEnd = (api as any).onGroupDragEnd;
const onEmojiDragEnd = (api as any).onEmojiDragEnd;
const isLinux = (api as any).isLinux;
const openExternal = (api as any).openExternal;
const copyUrl = (api as any).copyUrl;
</script>
