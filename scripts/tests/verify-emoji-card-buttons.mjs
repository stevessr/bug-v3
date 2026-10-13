// One-off visual verification: load dist extension, open groups tab, assert
// edit/delete buttons overlay the emoji image corners (regression guard for
// the antd .ant-btn position:relative vs @layer utilities cascade bug).
import { chromium } from 'playwright'
import path from 'path'

const EXTENSION_PATH = path.resolve('./dist')

async function main() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-features=VizDisplayCompositor'
    ]
  })

  let [background] = context.serviceWorkers()
  if (!background) background = await context.waitForEvent('serviceworker', { timeout: 20000 })
  const extensionId = new URL(background.url()).host
  console.log('extension id:', extensionId)

  const page = await context.newPage()
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="gold"/></svg>'
  const group = {
    id: 'test-group-1',
    name: '测试分组',
    emojis: [
      {
        id: 'emoji-1',
        name: 'smile',
        url: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
        tags: []
      }
    ]
  }

  await page.addInitScript(
    value => {
      ;(async () => {
        if (!chrome?.storage?.local) return
        await new Promise(r => chrome.storage.local.set({ ...value }, r))
      })()
    },
    {
      emojiGroupIndex: [{ id: group.id, order: 0 }],
      [`emojiGroup_${group.id}`]: group
    }
  )

  await page.goto(`chrome-extension://${extensionId}/index.html?type=options&tabs=groups`)

  const expandBtn = page.getByRole('button', { name: /展\s*开/ }).first()
  await expandBtn.waitFor({ state: 'visible', timeout: 30000 })
  await expandBtn.click()
  await page.waitForTimeout(1000)
  const debug = await page.evaluate(() => ({
    items: document.querySelectorAll('.options-emoji-item').length,
    grids: document.querySelectorAll('.options-emoji-grid').length,
    bodySnippet: document.body.innerText.slice(0, 400)
  }))
  console.log('DEBUG:', JSON.stringify(debug))
  await page.waitForTimeout(1000)

  const card = page.locator('.options-emoji-item').first()
  await card.waitFor({ state: 'visible', timeout: 30000 })
  const img = card.locator('img').first()
  await img.waitFor({ state: 'visible', timeout: 15000 })

  await card.hover()

  const editBtn = card.locator('button[title="编辑表情"]')
  const delBtn = card.locator('button[title="移除表情"]')
  await editBtn.waitFor({ state: 'visible', timeout: 5000 })
  await delBtn.waitFor({ state: 'visible', timeout: 5000 })

  const imgBox = await img.boundingBox()
  const editBox = await editBtn.boundingBox()
  const delBox = await delBtn.boundingBox()
  if (!imgBox || !editBox || !delBox) throw new Error('missing bounding boxes')

  const positions = await page.evaluate(() => ({
    edit: getComputedStyle(document.querySelector('button[title="编辑表情"]')).position,
    del: getComputedStyle(document.querySelector('button[title="移除表情"]')).position
  }))
  console.log('positions:', positions)

  // Edit button must sit inside the image, in its bottom-right region
  const insideImg = b =>
    b.x >= imgBox.x - 2 &&
    b.y >= imgBox.y - 2 &&
    b.x + b.width <= imgBox.x + imgBox.width + 2 &&
    b.y + b.height <= imgBox.y + imgBox.height + 2

  const editBottomRight =
    editBox.x + editBox.width > imgBox.x + imgBox.width * 0.6 &&
    editBox.y + editBox.height > imgBox.y + imgBox.height * 0.6
  const delTopRight =
    delBox.x + delBox.width > imgBox.x + imgBox.width * 0.6 &&
    delBox.y < imgBox.y + imgBox.height * 0.4

  console.log({ imgBox, editBox, delBox, editBottomRight, delTopRight })

  if (positions.edit !== 'absolute' || positions.del !== 'absolute')
    throw new Error('buttons are not position:absolute — cascade regression')
  if (!insideImg(editBox)) throw new Error('edit button not within image bounds')
  if (!editBottomRight) throw new Error('edit button not at bottom-right of image')
  if (!insideImg(delBox) && !(delBox.y < imgBox.y + imgBox.height * 0.4))
    throw new Error('delete button not near top-right of image')
  if (!delTopRight) throw new Error('delete button not at top-right of image')

  console.log('✅ EDIT/DELETE BUTTON CORNER CHECKS PASSED')
  await context.close()
}

main().catch(err => {
  console.error('❌', err)
  process.exit(1)
})
