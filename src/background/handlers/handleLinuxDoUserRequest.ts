import { sendMessageToLinuxDoTab } from '../utils/linuxDoTabMessenger'

interface LinuxDoUserResponse {
  success: boolean
  user?: { username: string; [key: string]: unknown }
  error?: string
}

export async function handleLinuxDoUserRequest(_sendResponse: (resp: LinuxDoUserResponse) => void) {
  const resp = await sendMessageToLinuxDoTab<LinuxDoUserResponse>(
    { type: 'GET_LINUX_DO_USER' },
    r => r?.success && !!r?.user?.username
  )
  _sendResponse(resp)
}
