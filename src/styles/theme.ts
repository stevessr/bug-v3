function applyTheme() {
  const theme = localStorage.getItem('theme') || 'system'
  const root = document.documentElement

  function apply(theme: string) {
    let finalTheme = theme
    if (theme === 'system') {
      finalTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    root.setAttribute('data-theme', finalTheme)
  }

  apply(theme)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', _ => {
    const currentTheme = localStorage.getItem('theme') || 'system'
    if (currentTheme === 'system') {
      apply('system')
    }
  })
}

applyTheme()
