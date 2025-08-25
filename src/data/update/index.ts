import settingsStore from './settingsStore'
import emojiGroupsStore from './emojiGroupsStore'

export { settingsStore, emojiGroupsStore }
export default {
  ...settingsStore,
  ...emojiGroupsStore,
}
