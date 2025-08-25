export interface aiOption {
  max_output_tokens?: number // An upper bound for the number of tokens that can be generated for a response.
  max_tool_calls?: number // The maximum number of tool calls allowed in a response.
  temperature?: number // Sampling temperature, between 0 and 2, influencing randomness.
  top_p?: number // Nucleus sampling probability mass, between 0 and 1.
  truncation?: 'auto' | 'disabled' // The truncation strategy to use for the model response.
  stream?: boolean // Whether to stream the model response data as it is generated.
  parallel_tool_calls?: boolean // Whether to allow the model to run tool calls in parallel.
}
