import fs from 'node:fs'
import path from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'

// Load .env manually (so vitest doesn't need to resolve dotenv)
try {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8')
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) {
        const k = m[1]
        let v = m[2] || ''
        // strip optional surrounding quotes
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (!process.env[k]) process.env[k] = v
      }
    }
  }
} catch (e) {
  // ignore
}

// This integration test runs only if OPENROUTER_API_KEYS is set in env
if (!process.env.OPENROUTER_API_KEYS) {
  // skip file if not set
  describe.skip('OpenRouter integration (skipped - no API key)', () => {})
} else {
  describe('OpenRouter integration', () => {
    it('sends a simple prompt and receives assistant reply (integration)', async () => {
      const mod = await import('../src/options/components/OpenRouterChat.vue')
      const OpenRouterChat = mod.default
      const wrapper = mount(OpenRouterChat)

      // Ensure api keys from env are set to the service via localStorage
      const keys = process.env.OPENROUTER_API_KEYS?.split(',')
      localStorage.setItem('openrouter-api-keys', JSON.stringify(keys))

      wrapper.vm.inputMessage = 'Hello from integration test (please return an image)'
      // force image generation
      wrapper.vm.enableImageGeneration = true
      // choose an image-capable model
      wrapper.vm.selectedModel = 'google/gemini-2.5-flash-image-preview:free'
      // disable streaming for simpler behavior
      wrapper.vm.enableStreaming = false

      await wrapper.vm.sendMessage()

      const assistant = wrapper.vm.messages.find((m: any) => m.role === 'assistant')
      expect(assistant).toBeTruthy()
      if (!assistant) throw new Error('assistant is undefined')
      expect(typeof assistant.content).toBe('string')

      // If assistant returned images, save them and try to display in terminal
      if (assistant.images && assistant.images.length) {
        const outDir = path.resolve(process.cwd(), 'test-results')
        try {
          fs.mkdirSync(outDir, { recursive: true })
        } catch (e) {
          // ignore
        }

        const savedPaths: string[] = []
        for (let i = 0; i < assistant.images.length; i++) {
          const img = assistant.images[i]
          const url = img.image_url?.url || ''
          if (!url) continue

          try {
            if (url.startsWith('data:')) {
              const m = url.match(/^data:(.+);base64,(.*)$/)
              if (!m) continue
              const mime = m[1]
              const b64 = m[2]
              const ext = mime.split('/')[1] || 'png'
              const filePath = path.join(outDir, `openrouter-image-${Date.now()}-${i}.${ext}`)
              fs.writeFileSync(filePath, Buffer.from(b64, 'base64'))
              savedPaths.push(filePath)
              console.error('--- SAVED IMAGE START ---')
              console.error(filePath)
              // Attempt to show inline in iTerm2
              try {
                // iTerm2 inline image escape
                const name = path.basename(filePath)
                const esc = `\u001b]1337;File=name=${encodeURIComponent(name)};inline=1:${b64}\u0007`
                // Write escape to stderr (more likely to be shown by test runner)
                // @ts-ignore
                process.stderr.write(esc + '\n')
                console.error('Saved image to', filePath)
              } catch (e) {
                // fallback: print file path to stderr
                console.error('Saved image to', filePath)
              }
              console.error('--- SAVED IMAGE END ---')
            } else if (url.startsWith('http')) {
              // download and save
              const res = await fetch(url)
              const buffer = Buffer.from(await res.arrayBuffer())
              const contentType = res.headers.get('content-type') || 'image/png'
              const ext = contentType.split('/')[1] || 'png'
              const filePath = path.join(outDir, `openrouter-image-${Date.now()}-${i}.${ext}`)
              fs.writeFileSync(filePath, buffer)
              savedPaths.push(filePath)
              console.error('--- SAVED IMAGE START ---')
              console.error(filePath)
              console.error('Saved image to', filePath)
              console.error('--- SAVED IMAGE END ---')
            } else {
              // assume bare base64
              const b64 = url
              const filePath = path.join(outDir, `openrouter-image-${Date.now()}-${i}.png`)
              fs.writeFileSync(filePath, Buffer.from(b64, 'base64'))
              savedPaths.push(filePath)
              console.error('--- SAVED IMAGE START ---')
              console.error(filePath)
              // try iTerm show
              try {
                const name = path.basename(filePath)
                const esc = `\u001b]1337;File=name=${encodeURIComponent(name)};inline=1:${b64}\u0007`
                // @ts-ignore
                process.stderr.write(esc + '\n')
                console.error('Saved image to', filePath)
              } catch (e) {
                console.error('Saved image to', filePath)
              }
              console.error('--- SAVED IMAGE END ---')
            }
          } catch (e) {
            // If any per-image error, log and continue
            console.error('Error saving image', e)
          }
        }

        // write a listing file and print it to stderr so test output captures saved paths
        if (savedPaths.length) {
          const listFile = path.join(outDir, `saved-images-${Date.now()}.txt`)
          fs.writeFileSync(listFile, savedPaths.join('\n'))
          console.error('Saved images list:')
          console.error(fs.readFileSync(listFile, 'utf8'))
        }
      }
    }, 60000)
  })
}
