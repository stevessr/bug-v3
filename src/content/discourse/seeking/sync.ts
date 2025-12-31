import { state } from './state'

// --- BroadcastChannel ---
export const CHANNEL_NAME = 'ld_seeking_channel'
export const channel = new BroadcastChannel(CHANNEL_NAME)

export function broadcastState() {
  channel.postMessage({
    type: 'data_update',
    data: state.data,
    lastIds: state.lastIds,
    hiddenUsers: Array.from(state.hiddenUsers),
    nextFetchTime: state.nextFetchTime,
    multipliers: state.multipliers,
    userProfiles: state.userProfiles,
    users: state.users
  })
}

export function broadcastNewAction(action: any) {
  channel.postMessage({ type: 'new_action', action })
}
