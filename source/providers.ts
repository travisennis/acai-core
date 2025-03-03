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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addCacheControlToTools(body: string) {
  const parsedBody = JSON.parse(body);
  if (isRecord(parsedBody)) {
    const tools = parsedBody.tools;
    if (Array.isArray(tools)) {
      tools.at(-1).cache_control = { type: "ephemeral" };
    }
  }
  return JSON.stringify(parsedBody);
}

const anthropic = customProvider({
  languageModels: {
    opus: originalAnthropic("claude-3-opus-20240229"),
    sonnet: createAnthropic({
      fetch(input, init) {
        const body = init?.body;
        if (body && typeof body === "string") {
          init.body = addCacheControlToTools(body);
        }
        return fetch(input, init);
      },
    })("claude-3-7-sonnet-20250219"),
    "sonnet-token-efficient-tools": createAnthropic({
      headers: {
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "token-efficient-tools-2025-02-19",
      },
      fetch(input, init) {
        const body = init?.body;
        if (body && typeof body === "string") {
          init.body = addCacheControlToTools(body);
        }
        return fetch(input, init);
      },
    })("claude-3-7-sonnet-20250219"),
    "sonnet-128k": createAnthropic({
      headers: {
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "output-128k-2025-02-19",
      },
      fetch(input, init) {
        const body = init?.body;
        if (body && typeof body === "string") {
          init.body = addCacheControlToTools(body);
        }
        return fetch(input, init);
      },
    })("claude-3-7-sonnet-20250219"),
    sonnet35: createAnthropic({
      headers: {
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15",
      },
      fetch(input, init) {
        const body = init?.body;
        if (body && typeof body === "string") {
          init.body = addCacheControlToTools(body);
        }
        return fetch(input, init);
      },
    })("claude-3-5-sonnet-20241022"),
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
  "anthropic:sonnet-token-efficient-tools",
  "anthropic:sonnet-128k",
  "anthropic:sonnet35",
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

export const ModelConfig: Record<
  ModelName,
  {
    maxOutputTokens: number;
    promptFormat: "xml" | "markdown" | "bracket";
    reasoningModel: boolean;
    supportsToolCalling: boolean;
  }
> = {
  "anthropic:sonnet": {
    maxOutputTokens: 64_000,
    promptFormat: "xml",
    reasoningModel: true,
    supportsToolCalling: true,
  },
  "anthropic:sonnet-token-efficient-tools": {
    maxOutputTokens: 64_000,
    promptFormat: "xml",
    reasoningModel: true,
    supportsToolCalling: true,
  },
  "anthropic:sonnet-128k": {
    maxOutputTokens: 128_000,
    promptFormat: "xml",
    reasoningModel: true,
    supportsToolCalling: true,
  },
  "anthropic:sonnet35": {
    maxOutputTokens: 8_096,
    promptFormat: "xml",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "anthropic:opus": {
    maxOutputTokens: 4_096,
    promptFormat: "xml",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "anthropic:haiku": {
    maxOutputTokens: 4_096,
    promptFormat: "xml",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openai:chatgpt-4o-latest": {
    maxOutputTokens: 16_384,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openai:gpt-4o": {
    maxOutputTokens: 16_384,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openai:gpt-4o-mini": {
    maxOutputTokens: 16_384,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openai:gpt-4o-structured": {
    maxOutputTokens: 16_384,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openai:gpt-4o-mini-structured": {
    maxOutputTokens: 16_384,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openai:o1": {
    maxOutputTokens: 100_000,
    promptFormat: "markdown",
    reasoningModel: true,
    supportsToolCalling: false,
  },
  "openai:o1-mini": {
    maxOutputTokens: 65_536,
    promptFormat: "markdown",
    reasoningModel: true,
    supportsToolCalling: false,
  },
  "openai:o3-mini": {
    maxOutputTokens: 100_000,
    promptFormat: "markdown",
    reasoningModel: true,
    supportsToolCalling: true,
  },
  "google:pro": {
    maxOutputTokens: 8_192,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "google:flash": {
    maxOutputTokens: 8_192,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "google:flash2": {
    maxOutputTokens: 8_192,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "google:flash2lite": {
    maxOutputTokens: 8_192,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "google:flash2-search": {
    maxOutputTokens: 8_192,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "google:flash2thinking": {
    maxOutputTokens: 8_192,
    promptFormat: "markdown",
    reasoningModel: true,
    supportsToolCalling: true,
  },
  "google:pro2": {
    maxOutputTokens: 8_192,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "google:gemini-experimental": {
    maxOutputTokens: 8_192,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "deepseek:deepseek-chat": {
    maxOutputTokens: 8_000,
    promptFormat: "bracket",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "deepseek:deepseek-reasoner": {
    maxOutputTokens: 8_000,
    promptFormat: "bracket",
    reasoningModel: true,
    supportsToolCalling: false,
  },
  "openrouter:llama-3-70-b": {
    maxOutputTokens: 4_096,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openrouter:llama-3.3-70b-instruct": {
    maxOutputTokens: 4_096,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openrouter:deepseek-v3": {
    maxOutputTokens: 8_000,
    promptFormat: "bracket",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "openrouter:deepseek-r1": {
    maxOutputTokens: 8_000,
    promptFormat: "bracket",
    reasoningModel: true,
    supportsToolCalling: false,
  },
  "ollama:llama3.1": {
    maxOutputTokens: 4_096,
    promptFormat: "markdown",
    reasoningModel: false,
    supportsToolCalling: true,
  },
  "ollama:deepseek-r1:1.5b": {
    maxOutputTokens: 8_000,
    promptFormat: "markdown",
    reasoningModel: true,
    supportsToolCalling: false,
  },
};
