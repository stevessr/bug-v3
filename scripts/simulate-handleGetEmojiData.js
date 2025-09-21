// Simulate background.handleGetEmojiData logic in Node (no browser)
// This script simulates newStorageHelpers with in-memory storage and runs the handler logic

async function simulate() {
  // in-memory storage
  const store = {
    emojiGroups: [
      { id: 'g1', order: 0, name: 'A' },
      { id: 'g2', order: 1, name: 'B' },
      { id: 3, order: 2, name: 'C' }
    ],
    settings: { foo: 'bar' },
    favorites: [],
    discourseDomains: []
  }

  const newStorageHelpers = {
    getAllEmojiGroups: async () => store.emojiGroups,
    getSettings: async () => store.settings,
    getFavorites: async () => store.favorites,
    getDiscourseDomain: async (d) => (store.discourseDomains.find(x => x.domain === d) || null),
    ensureDiscourseDomainExists: async (d) => {
      const exists = store.discourseDomains.find(x => x.domain === d)
      if (exists) return exists
      const o = { domain: d, enabledGroups: (await newStorageHelpers.getAllEmojiGroups()).map(g => g.id) }
      store.discourseDomains.push(o)
      return o
    },
    getDiscourseDomains: async () => store.discourseDomains,
  }

  async function handleGetEmojiData(message) {
    const groups = (await newStorageHelpers.getAllEmojiGroups()) || []
    const settings = (await newStorageHelpers.getSettings()) || {}
    const favorites = (await newStorageHelpers.getFavorites()) || []

    let finalGroups = groups

    try {
      const src = message && message.sourceDomain ? String(message.sourceDomain).trim() : ''
      console.log('[Sim] received sourceDomain:', src)
      if (src) {
        let entry = await newStorageHelpers.getDiscourseDomain(src)
        console.log('[Sim] existing entry:', entry)
        if (!entry) {
          entry = await newStorageHelpers.ensureDiscourseDomainExists(src)
          console.log('[Sim] created entry:', entry)
        }

        if (entry && Array.isArray(entry.enabledGroups)) {
          console.log('[Sim] enabledGroups types+values:', entry.enabledGroups.map(k => ({ val: k, type: typeof k })))
          const allowed = new Set(entry.enabledGroups.map(k => String(k)))
          finalGroups = groups.filter(g => g && allowed.has(String(g.id)))
          console.log('[Sim] finalGroups after filter:', finalGroups.map(g => ({ id: g.id, type: typeof g.id })))
        } else {
          console.log('[Sim] no enabledGroups, returning all')
        }
      }
    } catch (e) {
      console.warn('[Sim] filtering failed', e)
    }

    return { success: true, data: { groups: finalGroups, settings, favorites } }
  }

  // Run simulation: domain missing -> should be created and filtered
  const resp1 = await handleGetEmojiData({ type: 'GET_EMOJI_DATA', sourceDomain: 'missing.example' })
  console.log('Response1 groups:', resp1.data.groups.map(g => g.id))
  console.log('Store discourseDomains after:', JSON.stringify(store.discourseDomains, null, 2))

  // Run simulation: domain existing with only 'g1' enabled
  store.discourseDomains = [{ domain: 'onlyg1', enabledGroups: ['g1'] }]
  const resp2 = await handleGetEmojiData({ type: 'GET_EMOJI_DATA', sourceDomain: 'onlyg1' })
  console.log('Response2 groups:', resp2.data.groups.map(g => g.id))

}

simulate().catch(e => { console.error('Sim error', e); process.exit(1) })
