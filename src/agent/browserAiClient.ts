import type {
  AiCallOptions,
  AiContentBlock,
  AiMessage,
  AiModel,
  AiTool,
  AssistantMessage
} from './aiTypes'

type JsonRecord = Record<string, any>

export type BrowserAiRequest = {
  model: AiModel
  systemPrompt?: string
  messages: AiMessage[]
  tools?: AiTool[]
  options?: AiCallOptions
}

const DEFAULT_ENDPOINTS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  xai: 'https://api.x.ai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  zai: 'https://open.bigmodel.cn/api/paas/v4',
  minimax: 'https://api.minimax.chat/v1',
  opencode: 'https://api.opencode.ai/v1',
  'opencode-go': 'https://api.opencode.ai/v1',
  'kimi-coding': 'https://api.moonshot.cn/v1'
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const endpointFor = (model: AiModel): string => {
  const base = trimTrailingSlash(model.baseUrl || DEFAULT_ENDPOINTS[model.provider] || '')
  if (model.apiFamily === 'anthropic') {
    if (base.endsWith('/messages')) return base
    if (base.endsWith('/v1')) return `${base}/messages`
    return `${base}/v1/messages`
  }
  if (model.apiFamily === 'google') {
    if (/\/models\/[^/]+:(?:stream)?generateContent/.test(base)) return base
    return `${base}/v1beta/models/${encodeURIComponent(model.id)}:streamGenerateContent`
  }
  // The browser runtime intentionally uses the portable chat-completions
  // contract for every OpenAI-compatible endpoint. Older settings may still
  // contain apiFlavor="responses"; keeping the endpoint portable avoids
  // sending a chat-completions body to the Responses-only route.
  if (base.endsWith('/chat/completions')) return base
  return `${base}/chat/completions`
}

const textFrom = (content: AiMessage['content']): string => {
  if (typeof content === 'string') return content
  return content
    .filter((block): block is Extract<AiContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
}

const imageParts = (content: AiMessage['content']) => {
  if (typeof content === 'string') return []
  return content.filter(
    (block): block is Extract<AiContentBlock, { type: 'image' }> => block.type === 'image'
  )
}

const asAnthropicMessages = (messages: AiMessage[]): JsonRecord[] =>
  messages
    .filter(message => message.role !== 'system')
    .map(message => {
      if (message.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.toolCallId,
              content: textFrom(message.content),
              is_error: message.isError === true
            }
          ]
        }
      }
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        return {
          role: 'assistant',
          content: message.content.reduce<JsonRecord[]>((blocks, block) => {
            if (block.type === 'toolCall') {
              blocks.push({
                type: 'tool_use',
                id: block.id,
                name: block.name,
                input: block.arguments
              })
              return blocks
            }
            if (block.type === 'thinking') {
              blocks.push({ type: 'thinking', thinking: block.thinking })
              return blocks
            }
            if (block.type === 'text') blocks.push({ type: 'text', text: block.text })
            return blocks
          }, [])
        }
      }
      const contentBlocks: JsonRecord[] = []
      const text = textFrom(message.content)
      if (text) contentBlocks.push({ type: 'text', text })
      for (const image of imageParts(message.content)) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: image.mimeType, data: image.data }
        })
      }
      return { role: 'user', content: contentBlocks.length ? contentBlocks : text }
    })

const asOpenAiMessages = (messages: AiMessage[]): JsonRecord[] =>
  messages
    .filter(message => message.role !== 'system')
    .map(message => {
      if (message.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: message.toolCallId,
          content: textFrom(message.content)
        }
      }
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        const calls = message.content.filter(
          (block): block is Extract<AiContentBlock, { type: 'toolCall' }> =>
            block.type === 'toolCall'
        )
        return {
          role: 'assistant',
          content: textFrom(message.content) || null,
          ...(calls.length
            ? {
                tool_calls: calls.map(call => ({
                  id: call.id,
                  type: 'function',
                  function: { name: call.name, arguments: JSON.stringify(call.arguments) }
                }))
              }
            : {})
        }
      }
      const images = imageParts(message.content)
      if (!images.length) return { role: message.role, content: textFrom(message.content) }
      const content: JsonRecord[] = []
      const text = textFrom(message.content)
      if (text) content.push({ type: 'text', text })
      for (const image of images) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${image.mimeType};base64,${image.data}` }
        })
      }
      return { role: message.role, content }
    })

const asGoogleMessages = (messages: AiMessage[]): JsonRecord[] =>
  messages
    .filter(message => message.role !== 'system')
    .map(message => {
      const parts: JsonRecord[] = []
      const text = textFrom(message.content)
      if (text) parts.push({ text })
      for (const image of imageParts(message.content)) {
        parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } })
      }
      if (message.role === 'tool') {
        parts.push({
          functionResponse: {
            name: message.toolName || message.toolCallId || 'tool',
            response: { content: text }
          }
        })
      }
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        for (const call of message.content.filter(
          (block): block is Extract<AiContentBlock, { type: 'toolCall' }> =>
            block.type === 'toolCall'
        )) {
          parts.push({ functionCall: { name: call.name, args: call.arguments } })
        }
      }
      return { role: message.role === 'assistant' ? 'model' : 'user', parts }
    })

const toolDefinitions = (tools: AiTool[] | undefined, family: AiModel['apiFamily']) => {
  if (!tools?.length) return undefined
  if (family === 'anthropic') {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }))
  }
  if (family === 'google') {
    return [
      {
        functionDeclarations: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }
    ]
  }
  return tools.map(tool => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters }
  }))
}

const parseJson = (value: string): JsonRecord | null => {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const safeJson = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') return parseJson(value) || {}
  return {}
}

const parseToolArguments = (value: unknown): Record<string, unknown> => safeJson(value)

const appendStreamingText = (
  state: { text: string; thinking: string },
  delta: { text?: string; thinking?: string },
  options?: AiCallOptions
) => {
  if (delta.text) {
    state.text += delta.text
    options?.onDelta?.({ text: delta.text })
  }
  if (delta.thinking) {
    state.thinking += delta.thinking
    options?.onDelta?.({ thinking: delta.thinking })
  }
}

const parseAnthropicResponse = (body: JsonRecord): AssistantMessage => {
  const content: AiContentBlock[] = []
  for (const block of Array.isArray(body.content) ? body.content : []) {
    if (block?.type === 'text' && typeof block.text === 'string')
      content.push({ type: 'text', text: block.text })
    if (block?.type === 'thinking' && typeof block.thinking === 'string') {
      content.push({ type: 'thinking', thinking: block.thinking })
    }
    if (block?.type === 'tool_use' && typeof block.name === 'string') {
      content.push({
        type: 'toolCall',
        id: String(block.id || crypto.randomUUID()),
        name: block.name,
        arguments: parseToolArguments(block.input)
      })
    }
  }
  return {
    role: 'assistant',
    content,
    usage: {
      input: Number(body.usage?.input_tokens || 0),
      output: Number(body.usage?.output_tokens || 0),
      cacheRead: Number(body.usage?.cache_read_input_tokens || 0)
    }
  }
}

const parseOpenAiResponse = (body: JsonRecord): AssistantMessage => {
  const choice = Array.isArray(body.choices) ? body.choices[0] || {} : {}
  const message = choice.message || {}
  const content: AiContentBlock[] = []
  if (typeof message.content === 'string' && message.content)
    content.push({ type: 'text', text: message.content })
  if (typeof message.reasoning_content === 'string' && message.reasoning_content) {
    content.push({ type: 'thinking', thinking: message.reasoning_content })
  }
  for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
    const fn = call.function || {}
    content.push({
      type: 'toolCall',
      id: String(call.id || crypto.randomUUID()),
      name: String(fn.name || ''),
      arguments: parseToolArguments(fn.arguments)
    })
  }
  return {
    role: 'assistant',
    content,
    usage: {
      input: Number(body.usage?.prompt_tokens || 0),
      output: Number(body.usage?.completion_tokens || 0),
      cacheRead: Number(body.usage?.prompt_tokens_details?.cached_tokens || 0)
    }
  }
}

const parseGoogleResponse = (body: JsonRecord): AssistantMessage => {
  const content: AiContentBlock[] = []
  const parts = body.candidates?.[0]?.content?.parts
  for (const part of Array.isArray(parts) ? parts : []) {
    if (typeof part?.text === 'string') content.push({ type: 'text', text: part.text })
    if (part?.functionCall?.name) {
      content.push({
        type: 'toolCall',
        id: `${part.functionCall.name}-${crypto.randomUUID()}`,
        name: part.functionCall.name,
        arguments: safeJson(part.functionCall.args)
      })
    }
  }
  return {
    role: 'assistant',
    content,
    usage: {
      input: Number(body.usageMetadata?.promptTokenCount || 0),
      output: Number(body.usageMetadata?.candidatesTokenCount || 0),
      cacheRead: Number(body.usageMetadata?.cachedContentTokenCount || 0)
    }
  }
}

const mergeMessage = (
  target: AssistantMessage,
  next: AssistantMessage,
  options?: AiCallOptions
) => {
  const targetText = target.content
    .filter((block): block is Extract<AiContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
  const nextText = next.content
    .filter((block): block is Extract<AiContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
  if (nextText) {
    const delta = nextText.startsWith(targetText) ? nextText.slice(targetText.length) : nextText
    if (delta) options?.onDelta?.({ text: delta })
    if (delta) {
      const index = target.content.findIndex(block => block.type === 'text')
      if (index >= 0 && target.content[index].type === 'text') {
        target.content[index] = { type: 'text', text: target.content[index].text + delta }
      } else {
        target.content.push({ type: 'text', text: delta })
      }
    }
  }
  for (const block of next.content) {
    if (block.type === 'toolCall') {
      const existing = target.content.find(item => item.type === 'toolCall' && item.id === block.id)
      if (!existing) target.content.push(block)
    }
    if (block.type === 'thinking') {
      const existing = target.content.find(item => item.type === 'thinking')
      if (existing?.type === 'thinking') existing.thinking += block.thinking
      else target.content.push(block)
    }
  }
  target.usage = next.usage || target.usage
}

const streamSse = async (
  response: Response,
  model: AiModel,
  options?: AiCallOptions
): Promise<AssistantMessage> => {
  const contentType = response.headers.get('content-type') || ''
  if (!response.body || !contentType.includes('event-stream')) {
    const body = (await response.json()) as JsonRecord
    return model.apiFamily === 'anthropic'
      ? parseAnthropicResponse(body)
      : model.apiFamily === 'google'
        ? parseGoogleResponse(body)
        : parseOpenAiResponse(body)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const result: AssistantMessage = { role: 'assistant', content: [], usage: null }
  const toolBuffers = new Map<string, { name: string; raw: string }>()
  const toolIdsByIndex = new Map<number, string>()
  const state = { text: '', thinking: '' }

  const processEvent = (raw: string) => {
    const data = raw
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .join('\n')
      .trim()
    if (!data || data === '[DONE]') return
    const event = parseJson(data)
    if (!event) return

    if (model.apiFamily === 'anthropic') {
      if (event.type === 'message_start') {
        result.usage = {
          input: Number(event.message?.usage?.input_tokens || 0),
          output: 0,
          cacheRead: Number(event.message?.usage?.cache_read_input_tokens || 0)
        }
      } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        const id = String(event.content_block.id || crypto.randomUUID())
        toolBuffers.set(id, { name: String(event.content_block.name || ''), raw: '' })
        result.content.push({
          type: 'toolCall',
          id,
          name: String(event.content_block.name || ''),
          arguments: {}
        })
      } else if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'text_delta') {
          const text = String(event.delta.text || '')
          state.text += text
          const textBlock = result.content.find(block => block.type === 'text')
          if (textBlock?.type === 'text') textBlock.text += text
          else result.content.push({ type: 'text', text })
          options?.onDelta?.({ text })
        } else if (event.delta?.type === 'thinking_delta') {
          const thinking = String(event.delta.thinking || '')
          state.thinking += thinking
          const thinkingBlock = result.content.find(block => block.type === 'thinking')
          if (thinkingBlock?.type === 'thinking') thinkingBlock.thinking += thinking
          else result.content.push({ type: 'thinking', thinking })
          options?.onDelta?.({ thinking })
        } else if (event.delta?.type === 'input_json_delta') {
          const keys = [...toolBuffers.keys()]
          const lastTool = keys[keys.length - 1]
          if (lastTool) {
            const current = toolBuffers.get(lastTool)
            if (current) current.raw += String(event.delta.partial_json || '')
          }
        }
      } else if (event.type === 'message_delta') {
        if (result.usage)
          result.usage.output = Number(event.usage?.output_tokens || result.usage.output)
      }
      return
    }

    if (model.apiFamily === 'google') {
      const next = parseGoogleResponse(event)
      mergeMessage(result, next, options)
      return
    }

    const choice = event.choices?.[0]
    const delta = choice?.delta || {}
    if (typeof delta.content === 'string' && delta.content) {
      appendStreamingText(state, { text: delta.content }, options)
      const textBlock = result.content.find(block => block.type === 'text')
      if (textBlock?.type === 'text') textBlock.text += delta.content
      else result.content.push({ type: 'text', text: delta.content })
    }
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      appendStreamingText(state, { thinking: delta.reasoning_content }, options)
      const thinkingBlock = result.content.find(block => block.type === 'thinking')
      if (thinkingBlock?.type === 'thinking') thinkingBlock.thinking += delta.reasoning_content
      else result.content.push({ type: 'thinking', thinking: delta.reasoning_content })
    }
    for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      const index = Number(call.index ?? toolBuffers.size)
      const id = String(call.id || toolIdsByIndex.get(index) || `tool-${index}`)
      toolIdsByIndex.set(index, id)
      const current = toolBuffers.get(id) || { name: '', raw: '' }
      current.name = current.name || String(call.function?.name || '')
      current.raw += String(call.function?.arguments || '')
      toolBuffers.set(id, current)
      const existing = result.content.find(block => block.type === 'toolCall' && block.id === id)
      if (existing?.type === 'toolCall') {
        existing.name = current.name
        existing.arguments = parseToolArguments(current.raw)
      } else {
        result.content.push({ type: 'toolCall', id, name: current.name, arguments: {} })
      }
    }
    if (event.usage) {
      result.usage = {
        input: Number(event.usage.prompt_tokens || 0),
        output: Number(event.usage.completion_tokens || 0),
        cacheRead: Number(event.usage.prompt_tokens_details?.cached_tokens || 0)
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    for (const event of events) processEvent(event)
    if (done) {
      if (buffer.trim()) processEvent(buffer)
      break
    }
  }

  for (const block of result.content) {
    if (block.type !== 'toolCall') continue
    const current = toolBuffers.get(block.id)
    if (current) {
      block.name = current.name || block.name
      block.arguments = parseToolArguments(current.raw)
    }
  }
  return result
}

const requestBody = (request: BrowserAiRequest) => {
  const { model, systemPrompt, messages, tools, options } = request
  const maxTokens = options?.maxTokens || 1024
  if (model.apiFamily === 'anthropic') {
    return {
      model: model.id,
      max_tokens: maxTokens,
      system: systemPrompt || undefined,
      messages: asAnthropicMessages(messages),
      tools: toolDefinitions(tools, model.apiFamily),
      ...(options?.reasoning === 'high'
        ? { thinking: { type: 'enabled', budget_tokens: Math.min(maxTokens, 4096) } }
        : {}),
      stream: true
    }
  }
  if (model.apiFamily === 'google') {
    return {
      contents: asGoogleMessages(messages),
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: { maxOutputTokens: maxTokens },
      tools: toolDefinitions(tools, model.apiFamily)
    }
  }
  return {
    model: model.id,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...asOpenAiMessages(messages)
    ],
    max_tokens: maxTokens,
    tools: toolDefinitions(tools, model.apiFamily),
    ...(options?.reasoning === 'high' ? { reasoning_effort: 'high' } : {}),
    stream: true,
    stream_options: { include_usage: true }
  }
}

const buildHeaders = (model: AiModel, apiKey: string): Record<string, string> => {
  if (model.apiFamily === 'anthropic') {
    return {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  }
  if (model.apiFamily === 'google') return { 'content-type': 'application/json' }
  return {
    'content-type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  }
}

export async function completeBrowserAi(request: BrowserAiRequest): Promise<AssistantMessage> {
  const apiKey = request.options?.apiKey?.trim()
  if (!apiKey) throw new Error('未配置 AI API Key。')
  const endpoint = endpointFor(request.model)
  const url =
    request.model.apiFamily === 'google'
      ? `${endpoint}?alt=sse&key=${encodeURIComponent(apiKey)}`
      : endpoint
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120_000)
  if (request.options?.signal) {
    if (request.options.signal.aborted) controller.abort()
    else request.options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(request.model, apiKey),
      body: JSON.stringify(requestBody(request)),
      credentials: 'omit',
      signal: controller.signal
    })
    if (!response.ok) {
      const text = await response.text()
      let detail = text
      try {
        const parsed = JSON.parse(text) as JsonRecord
        detail = String(parsed.error?.message || parsed.error || text)
      } catch {
        // Keep the plain response when it is not JSON.
      }
      throw new Error(`AI 请求失败（HTTP ${response.status}）：${detail.slice(0, 500)}`)
    }
    return await streamSse(response, request.model, request.options)
  } finally {
    clearTimeout(timeoutId)
  }
}
