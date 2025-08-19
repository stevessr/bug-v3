<template>
  <div class="options-root" style="padding:14px;">
    <div class="toolbar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <button @click="addNewGroup">Add New Group</button>
      </div>
      <div>
        <button @click="resetToDefault">恢复默认</button>
        <button @click="saveEmojiData(emojiData)">保存</button>
      </div>
    </div>

    <div class="status" v-if="status" style="margin-bottom:8px;color:green">{{ status }}</div>

    <div class="groups">
      <draggable v-model="emojiData" item-key="group" @end="onGroupDragEnd">
        <template #item="{element: group, index: groupIndex}">
          <div class="group-card" style="border:1px solid #e6e6e6;padding:10px;border-radius:6px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <img v-if="group.icon" :src="group.icon" :alt="group.group" style="width:32px;height:32px;object-fit:cover;border-radius:4px;" />
                <input :value="group.group" @input="(e) => updateGroupName(groupIndex, (e.target as HTMLInputElement).value)" placeholder="Group Name" style="width:140px;padding:4px" />
                <input :value="group.icon || ''" @input="(e) => updateGroupIcon(groupIndex, (e.target as HTMLInputElement).value)" placeholder="Icon URL" style="width:180px;padding:4px" />
              </div>
              <div>
                <button @click="deleteGroup(groupIndex)">删除分组</button>
              </div>
            </div>

            <div v-if="group.icon" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <img :src="group.icon" :alt="group.group" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" />
              <div style="font-weight:600">{{ group.group }}</div>
            </div>

            <ul style="list-style:none;padding:0;margin:0">
              <draggable v-model="group.emojis" :group="{ name: 'emojis' }" item-key="url" @end="() => onEmojiDragEnd(groupIndex)">
                <template #item="{element: emoji, index: emojiIndex}">
                  <li style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #f0f0f0;">
                    <div style="display:flex;align-items:center;gap:8px;max-width:70%">
                      <template v-if="isLinux(emoji.url)">
                        <img :src="emoji.url" :alt="emoji.name" width="36" height="36" style="border-radius:6px;object-fit:cover;" />
                      </template>
                      <div style="display:flex;flex-direction:column;">
                        <div style="font-weight:500">{{ emoji.name }}</div>
                        <div style="font-size:12px;color:#666;word-break:break-all;max-width:420px">{{ emoji.url }}</div>
                      </div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                      <button @click="openExternal(emoji.url)">打开</button>
                      <button @click="copyUrl(emoji.url)">复制</button>
                      <button @click="deleteEmoji(groupIndex, emojiIndex)">删除</button>
                    </div>
                  </li>
                </template>
              </draggable>
            </ul>

            <div style="margin-top:8px;">
              <button @click="addNewEmoji(groupIndex)">Add Emoji</button>
            </div>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable';
import {
  emojiData,
  status,
  addNewGroup,
  resetToDefault,
  saveEmojiData,
  deleteGroup,
  updateGroupName,
  updateGroupIcon,
  addNewEmoji,
  deleteEmoji,
  onGroupDragEnd,
  onEmojiDragEnd,
  isLinux,
  openExternal,
  copyUrl,
} from './options.ts';

// expose draggable as a local component
const components = { draggable } as any;
</script>
