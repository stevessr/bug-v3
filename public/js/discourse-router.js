;(function () {
  // 防止重复注入监听器
  if (window.__DISCOURSE_ROUTER_INJECTED__) return
  window.__DISCOURSE_ROUTER_INJECTED__ = true

  window.addEventListener('message', function (event) {
    if (!event.data) return

    if (event.data.type === 'DISCOURSE_ROUTE_REFRESH_REQUEST') {
      const id = event.data.id
      try {
        if (
          window.Discourse &&
          window.Discourse.router &&
          typeof window.Discourse.router.transitionTo === 'function'
        ) {
          const currentPath = window.location.pathname
          window.Discourse.router.transitionTo(currentPath)
          window.postMessage(
            { type: 'DISCOURSE_ROUTE_REFRESH_SUCCESS', id: id, path: currentPath },
            '*'
          )
        }
      } catch (e) {
        console.error('[DiscourseRouterRefresh] Execution error:', e)
      }
    } else if (event.data.type === 'DISCOURSE_ROUTER_PROBE_REQUEST') {
      const id = event.data.id
      const available = !!(
        window.Discourse &&
        window.Discourse.router &&
        typeof window.Discourse.router.transitionTo === 'function'
      )
      window.postMessage(
        { type: 'DISCOURSE_ROUTER_PROBE_RESULT', id: id, available: available },
        '*'
      )
    }
  })
})()
