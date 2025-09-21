// Node-only verification for filtering logic used in handleGetEmojiData
// This script simulates groups and domain entries and runs the same filtering logic

function filterGroupsByEntry(groups, entry) {
  if (entry && Array.isArray(entry.enabledGroups)) {
    const allowed = new Set(entry.enabledGroups.map(k => String(k)))
    return groups.filter(g => g && allowed.has(String(g.id)))
  }
  return groups
}

// Test cases
const groups = [
  { id: 'g1', name: 'A' },
  { id: 'g2', name: 'B' },
  { id: 3, name: 'C' }
]

const entry1 = { domain: 'd1', enabledGroups: ['g1', 'g2'] }
const entry2 = { domain: 'd2', enabledGroups: [3] }
const entry3 = { domain: 'd3', enabledGroups: [] }

console.log('groups length', groups.length)
console.log('filter by entry1 (strings):', filterGroupsByEntry(groups, entry1).map(g=>g.id))
console.log('filter by entry2 (numeric id):', filterGroupsByEntry(groups, entry2).map(g=>g.id))
console.log('filter by entry3 (empty):', filterGroupsByEntry(groups, entry3).map(g=>g.id))
console.log('no entry (return all):', filterGroupsByEntry(groups, null).map(g=>g.id))
