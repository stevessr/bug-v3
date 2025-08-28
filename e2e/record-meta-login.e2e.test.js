const path = require('path')
const readline = require('readline')

const { chromium } = require('playwright')(async () => {
  try {
    const extensionPath = path.resolve(__dirname, '..', 'dist')
    const userDataDir = path.join(__dirname, '.meta-user-data')

    console.log('Launching Chromium (headful) with extension loaded...')
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    })

    const page = await context.newPage()
    await page.goto('https://meta.discourse.org/')

    console.log('\nManual step required:')
    console.log(
      ' - Please sign in to https://meta.discourse.org in the opened browser (if not already).',
    )
    console.log(' - After login, press Enter in this terminal to save the authentication state.')

    await new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      rl.question('', () => {
        rl.close()
        resolve()
      })
    })

    const storagePath = path.join(__dirname, '.meta-storage.json')
    await context.storageState({ path: storagePath })
    console.log('Saved storage state to', storagePath)

    await context.close()
    process.exit(0)
  } catch (err) {
    console.error('Error recording login:', err)
    process.exit(1)
  }
})()
