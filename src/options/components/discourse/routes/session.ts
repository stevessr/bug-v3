import type { Ref } from 'vue'

import { pageFetch, extractData } from '../utils'

export async function loadSessionUsername(baseUrl: Ref<string>): Promise<string | null> {
  try {
    const result = await pageFetch<any>(`${baseUrl.value}/session/current.json`)
    const data = extractData(result)
    return data?.current_user?.username || null
  } catch {
    return null
  }
}
