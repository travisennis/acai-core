import {
  createAnthropic,
  anthropic as originalAnthropic,
} from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { deepseek as originalDeepseek } from "@ai-sdk/deepseek";
import { google as originalGoogle } from "@ai-sdk/google";
import { createOpenAI, openai as originalOpenAI } from "@ai-sdk/openai";
import {
  experimental_createProviderRegistry as createProviderRegistry,
  experimental_customProvider as customProvider,
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
    "gpt-4o": originalOpenAI("gpt-4o-2024-11-20"),
    "gpt-4o-mini": originalOpenAI("gpt-4o-mini"),
    "gpt-4o-structured": originalOpenAI("gpt-4o-2024-11-20", {
      structuredOutputs: true,
    }),
    "gpt-4o-mini-structured": originalOpenAI("gpt-4o-mini", {
      structuredOutputs: true,
    }),
    o1: originalOpenAI("o1-preview"),
    "o1-mini": originalOpenAI("o1-mini"),
  },
  fallbackProvider: originalOpenAI,
});

const google = customProvider({
  languageModels: {
    pro: originalGoogle("gemini-1.5-pro-latest"),
    flash: originalGoogle("gemini-1.5-flash-latest"),
    flash2: originalGoogle("gemini-2.0-flash-exp"),
    "flash2-search": originalGoogle("gemini-2.0-flash-exp", {
      useSearchGrounding: true,
    }),
    flash2thinking: originalGoogle("gemini-2.0-flash-thinking-exp-01-21"),
    "gemini-experimental": originalGoogle("gemini-exp-1206"),
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
  "openai:gpt-4o",
  "openai:gpt-4o-mini",
  "openai:gpt-4o-structured",
  "openai:gpt-4o-mini-structured",
  "openai:o1",
  "openai:o1-mini",
  "google:pro",
  "google:flash",
  "google:flash2",
  "google:flash2-search",
  "google:flash2thinking",
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
      (model.startsWith("openrouter:") || model.startsWith("ollama:")))
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function languageModel(input: ModelName) {
  return registry.languageModel(input);
}
