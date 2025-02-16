import {
  createAnthropic,
  anthropic as originalAnthropic,
} from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { deepseek as originalDeepseek } from "@ai-sdk/deepseek";
import { google as originalGoogle } from "@ai-sdk/google";
import { createOpenAI, openai as originalOpenAi } from "@ai-sdk/openai";
import {
  experimental_createProviderRegistry as createProviderRegistry,
  customProvider,
} from "ai";
import { createOllama } from "ollama-ai-provider";

const azure = customProvider({
  languageModels: {
    text: createAzure({
      resourceName: process.env.AZURE_RESOURCE_NAME,
      apiKey: process.env.AZURE_API_KEY,
    })(process.env.AZURE_DEPLOYMENT_NAME ?? ""),
  },
});

const openRouterClient = createOpenAI({
  // biome-ignore lint/style/useNamingConvention: <explanation>
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const openrouter = customProvider({
  languageModels: {
    "llama-3-70-b": openRouterClient("meta-llama/llama-3-70b"),
    "llama-3.3-70b-instruct": openRouterClient(
      "meta-llama/llama-3.3-70b-instruct",
    ),
    "deepseek-v3": openRouterClient("deepseek/deepseek-chat"),
    "deepseek-r1": openRouterClient("deepseek/deepseek-r1"),
  },
  fallbackProvider: openRouterClient,
});

const anthropic = customProvider({
  languageModels: {
    opus: originalAnthropic("claude-3-opus-20240229"),
    sonnet: createAnthropic({
      headers: {
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15",
      },
    })("claude-3-5-sonnet-20241022", {
      cacheControl: true,
    }),
    haiku: originalAnthropic("claude-3-5-haiku-20241022"),
  },
  fallbackProvider: originalAnthropic,
});

const openai = customProvider({
  languageModels: {
    "chatgpt-4o-latest": originalOpenAi("chatgpt-4o-latest"),
    "gpt-4o": originalOpenAi("gpt-4o-2024-11-20"),
    "gpt-4o-mini": originalOpenAi("gpt-4o-mini"),
    "gpt-4o-structured": originalOpenAi("gpt-4o-2024-11-20", {
      structuredOutputs: true,
    }),
    "gpt-4o-mini-structured": originalOpenAi("gpt-4o-mini", {
      structuredOutputs: true,
    }),
    o1: originalOpenAi("o1-preview"),
    "o1-mini": originalOpenAi("o1-mini"),
    "o3-mini": originalOpenAi("o3-mini"),
  },
  fallbackProvider: originalOpenAi,
});

const google = customProvider({
  languageModels: {
    pro: originalGoogle("gemini-1.5-pro-latest"),
    flash: originalGoogle("gemini-1.5-flash-latest"),
    flash2: originalGoogle("gemini-2.0-flash"),
    "flash2-search": originalGoogle("gemini-2.0-flash", {
      useSearchGrounding: true,
    }),
    flash2lite: originalGoogle("gemini-2.0-flash-lite-preview-02-05"),
    flash2thinking: originalGoogle("gemini-2.0-flash-thinking-exp-01-21"),
    "gemini-experimental": originalGoogle("gemini-exp-1206"),
    pro2: originalGoogle("gemini-2.0-pro-exp-02-05"),
  },
  fallbackProvider: originalGoogle,
});

const deepseek = customProvider({
  languageModels: {
    "deepseek-chat": originalDeepseek("deepseek-chat"),
    "deepseek-reasoner": originalDeepseek("deepseek-reasoner"),
  },
  fallbackProvider: originalDeepseek,
});

const ollama = customProvider({
  languageModels: {
    "llama3.1": createOllama()("llama3.1"),
    "deepseek-r1:1.5b": createOllama()("deepseek-r1:1.5b"),
  },
  fallbackProvider: createOllama(),
});

const registry = createProviderRegistry({
  anthropic,
  azure,
  deepseek,
  google,
  openai,
  openrouter,
  ollama,
});

export const Models = [
  "anthropic:sonnet",
  "anthropic:opus",
  "anthropic:haiku",
  "openai:chatgpt-4o-latest",
  "openai:gpt-4o",
  "openai:gpt-4o-mini",
  "openai:gpt-4o-structured",
  "openai:gpt-4o-mini-structured",
  "openai:o1",
  "openai:o1-mini",
  "openai:o3-mini",
  "google:pro",
  "google:flash",
  "google:flash2",
  "google:flash2lite",
  "google:flash2-search",
  "google:flash2thinking",
  "google:pro2",
  "google:gemini-experimental",
  "deepseek:deepseek-chat",
  "deepseek:deepseek-reasoner",
  "openrouter:llama-3-70-b",
  "openrouter:llama-3.3-70b-instruct",
  "openrouter:deepseek-v3",
  "openrouter:deepseek-r1",
  "ollama:llama3.1",
  "ollama:deepseek-r1:1.5b",
] as const;

export type ModelName = (typeof Models)[number];

export function isSupportedModel(model: unknown): model is ModelName {
  return (
    Models.includes(model as ModelName) ||
    (isString(model) &&
      (model.startsWith("openrouter:") ||
        model.startsWith("ollama:") ||
        model.startsWith("anthropic:") ||
        model.startsWith("openai:") ||
        model.startsWith("google:") ||
        model.startsWith("deepseek:")))
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function languageModel(input: ModelName) {
  return registry.languageModel(input);
}

export const ModelConfig: Record<ModelName, { maxOutputTokens: number }> = {
  "anthropic:sonnet": {
    maxOutputTokens: 8_192,
  },
  "anthropic:opus": {
    maxOutputTokens: 4_096,
  },
  "anthropic:haiku": {
    maxOutputTokens: 4_096,
  },
  "openai:chatgpt-4o-latest": {
    maxOutputTokens: 16_384,
  },
  "openai:gpt-4o": {
    maxOutputTokens: 16_384,
  },
  "openai:gpt-4o-mini": {
    maxOutputTokens: 16_384,
  },
  "openai:gpt-4o-structured": {
    maxOutputTokens: 16_384,
  },
  "openai:gpt-4o-mini-structured": {
    maxOutputTokens: 16_384,
  },
  "openai:o1": {
    maxOutputTokens: 100_000,
  },
  "openai:o1-mini": {
    maxOutputTokens: 65_536,
  },
  "openai:o3-mini": {
    maxOutputTokens: 100_000,
  },
  "google:pro": {
    maxOutputTokens: 8_192,
  },
  "google:flash": {
    maxOutputTokens: 8_192,
  },
  "google:flash2": {
    maxOutputTokens: 8_192,
  },
  "google:flash2lite": {
    maxOutputTokens: 8_192,
  },
  "google:flash2-search": {
    maxOutputTokens: 8_192,
  },
  "google:flash2thinking": {
    maxOutputTokens: 8_192,
  },
  "google:pro2": {
    maxOutputTokens: 8_192,
  },
  "google:gemini-experimental": {
    maxOutputTokens: 8_192,
  },
  "deepseek:deepseek-chat": {
    maxOutputTokens: 8_000,
  },
  "deepseek:deepseek-reasoner": {
    maxOutputTokens: 8_000,
  },
  "openrouter:llama-3-70-b": {
    maxOutputTokens: 4_096,
  },
  "openrouter:llama-3.3-70b-instruct": {
    maxOutputTokens: 4_096,
  },
  "openrouter:deepseek-v3": {
    maxOutputTokens: 8_000,
  },
  "openrouter:deepseek-r1": {
    maxOutputTokens: 8_000,
  },
  "ollama:llama3.1": {
    maxOutputTokens: 4_096,
  },
  "ollama:deepseek-r1:1.5b": {
    maxOutputTokens: 8_000,
  },
};
