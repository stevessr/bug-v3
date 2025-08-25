import type { aiAbility } from './ability'
import type { aiFeature } from './feature'
import type { aiOption } from './option'
import type { aimodel, reasoningOpenaiModel } from './model'

interface aiprovider {
  provider: string // The name of the AI service provider, e.g., "OpenAI".
  model: (aimodel | reasoningOpenaiModel)[] // An array of AI models offered by this provider.
}

interface aiSetting {
  options?: aiOption // Optional configurations for the model response generation.
  provider: aiprovider // Information about the AI provider and its models.
}

export type { aiAbility, aiOption, aiprovider, aimodel, reasoningOpenaiModel, aiSetting }
