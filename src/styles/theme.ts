function applyTheme() {
  const theme = localStorage.getItem('theme') || 'system'
  const root = document.documentElement

  function apply(theme: string) {
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  apply(theme)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    const currentTheme = localStorage.getItem('theme') || 'system'
    if (currentTheme === 'system') {
      if (event.matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  })
}

applyTheme()
