<template>
  <div class="container">
    <h1>Emoji Management</h1>
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane key="1" tab="Emoji Groups">
        <p>Manage your emoji groups here.</p>
      </a-tab-pane>
      <a-tab-pane key="2" tab="Add Emojis">
        <p>Add new emojis here.</p>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import 'ant-design-vue/dist/reset.css';

const activeKey = ref('1');
</script>

<style>
.container {
  padding: 20px;
}
</style>
