import { sendMessageToLinuxDoTab } from '../utils/linuxDoTabMessenger'
import { sendMessageToDomainTab } from '../utils/domainTabMessenger'

interface LinuxDoUserResponse {
  success: boolean
  user?: { username: string; [key: string]: unknown }
  error?: string
}

export async function handleLinuxDoUserRequest(
  url: string | undefined,
  _sendResponse: (resp: LinuxDoUserResponse) => void
) {
  const message = { type: 'GET_LINUX_DO_USER', ...(url ? { url } : {}) }
  const successCheck = (response: LinuxDoUserResponse) =>
    response?.success && !!response?.user?.username
  const resp = url
    ? await sendMessageToDomainTab<LinuxDoUserResponse>(url, message, successCheck)
    : await sendMessageToLinuxDoTab<LinuxDoUserResponse>(message, successCheck)
  _sendResponse(resp)
}
