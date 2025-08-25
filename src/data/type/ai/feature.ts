export interface aiFeature {
  tools: boolean // Corresponds to the 'tools' parameter and 'tool_choice' in the API.
  json_mode: boolean // Corresponds to 'text.format: { "type": "json_object" }' for older JSON mode.
  structured_outputs: boolean // Corresponds to 'text.format: { "type": "json_schema" }' for Structured Outputs.
  web_search: boolean // Corresponds to the 'web_search_preview' tool.
  reasoning: boolean // Corresponds to the 'reasoning' parameter for gpt-5 and o-series models.
}
