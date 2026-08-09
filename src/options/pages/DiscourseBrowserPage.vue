<script setup lang="ts">
import DiscourseBrowser from '../components/DiscourseBrowser.vue'
</script>

<template>
  <main class="discourse-browser-page">
    <header class="discourse-browser-page__header">
      <div class="discourse-browser-page__mark" aria-hidden="true">D</div>
      <div class="discourse-browser-page__copy">
        <p class="discourse-browser-page__eyebrow">Discourse Workspace</p>
        <h1>论坛浏览器</h1>
        <p>通过 API 代理访问论坛，在同一工作区中浏览话题、聊天、通知和个人资料。</p>
      </div>
      <div class="discourse-browser-page__features" aria-label="浏览器功能">
        <span>多标签</span>
        <span>实时同步</span>
        <span>内置编辑器</span>
      </div>
    </header>

    <section class="discourse-browser-page__surface" aria-label="论坛浏览器工作区">
      <DiscourseBrowser class="discourse-browser-page__browser" />
    </section>
  </main>
</template>

<style scoped>
.discourse-browser-page {
  display: flex;
  min-height: min(760px, calc(100vh - 144px));
  flex-direction: column;
  gap: 16px;
  color: var(--md3-on-surface, var(--theme-on-surface));
}

.discourse-browser-page__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border-radius: 28px;
  background: var(--md3-surface-container-low, var(--theme-surface-container-low));
}

.discourse-browser-page__mark {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 18px;
  background: var(--md3-primary-container, var(--theme-primary-container));
  color: var(--md3-on-primary-container, var(--theme-on-primary-container));
  font-size: 22px;
  font-weight: 760;
}

.discourse-browser-page__copy {
  min-width: 0;
}

.discourse-browser-page__copy h1,
.discourse-browser-page__copy p {
  margin: 0;
}

.discourse-browser-page__copy h1 {
  font-size: 24px;
  font-weight: 560;
  letter-spacing: -0.02em;
}

.discourse-browser-page__copy > p:last-child {
  margin-top: 3px;
  color: var(--md3-on-surface-variant, var(--theme-on-surface-variant));
  font-size: 13px;
}

.discourse-browser-page__eyebrow {
  color: var(--md3-primary, var(--theme-primary));
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.discourse-browser-page__features {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.discourse-browser-page__features span {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--md3-secondary-container, var(--theme-secondary-container));
  color: var(--md3-on-secondary-container, var(--theme-on-secondary-container));
  font-size: 12px;
  font-weight: 600;
}

.discourse-browser-page__surface {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--md3-outline-variant, var(--theme-outline-variant));
  border-radius: 28px;
  background: var(--md3-surface, var(--theme-surface));
  box-shadow:
    0 1px 2px color-mix(in oklab, var(--md3-shadow, #000) 16%, transparent),
    0 2px 6px 2px color-mix(in oklab, var(--md3-shadow, #000) 8%, transparent);
}

.discourse-browser-page__browser {
  min-height: 0;
  flex: 1;
}

@media (max-width: 900px) {
  .discourse-browser-page__header {
    grid-template-columns: auto minmax(0, 1fr);
    border-radius: 20px;
  }

  .discourse-browser-page__features {
    display: none;
  }

  .discourse-browser-page__surface {
    border-radius: 20px;
  }
}

@media (max-width: 560px) {
  .discourse-browser-page {
    min-height: calc(100vh - 96px);
    gap: 10px;
  }

  .discourse-browser-page__header {
    padding: 14px;
  }

  .discourse-browser-page__mark {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .discourse-browser-page__copy h1 {
    font-size: 20px;
  }

  .discourse-browser-page__copy > p:last-child,
  .discourse-browser-page__eyebrow {
    display: none;
  }
}
</style>
