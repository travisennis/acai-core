type AnthropicModel = "opus" | "sonnet" | "haiku";
type OpenAIModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4o-structured"
  | "gpt-4o-mini-structured"
  | "o1"
  | "o1-mini";
type OpenRouterModel = string;
type GoogleModel = "pro" | "flash" | "flash2";

export type ModelName =
  | `anthropic:${AnthropicModel}`
  | `openai:${OpenAIModel}`
  | "azure:text"
  | `openrouter:${OpenRouterModel}`
  | `google:${GoogleModel}`;

export const Models: ModelName[] = [
  "anthropic:sonnet",
  "anthropic:haiku",
  "openai:gpt-4o",
  "openai:gpt-4o-mini",
  "openai:o1",
  "openai:o1-mini",
  "google:pro",
  "google:flash",
  "google:flash2",
];
