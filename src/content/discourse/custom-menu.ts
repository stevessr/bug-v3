export function initCustomMenu() {
  // placeholder for custom menu logic for Discourse content
  // currently a no-op to keep modules decoupled
  ;(window as any).__discourseCustomMenu = { initialized: true }
}

try {
  initCustomMenu()
} catch (e) {
  // noop
}
