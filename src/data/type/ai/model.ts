import type { aiAbility } from './ability'
import type { aiFeature } from './feature'

interface aimodel {
  id: string // The unique ID of the model, e.g., "gpt-4o" or "o3".
  name: string // A human-readable name for the model.
  input_modalities?: aiAbility // Specifies the types of input the model can handle (text, image, file).
  output_modalities?: aiAbility // Specifies the types of output the model can generate (text, image).
  features?: aiFeature // Lists specific capabilities or features supported by the model.
  context_length?: number // The maximum token limit for the model's context window.
  max_output_length?: number // Corresponds to the 'max_output_tokens' parameter, indicating the maximum tokens generated.
  description: string // A brief description of the model.
}

interface reasoningOpenaiModel extends aimodel {
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high' // Specifies the effort level for reasoning models.
}

export type { aimodel, reasoningOpenaiModel }
