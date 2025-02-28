import type { GoogleGenerativeAIProviderMetadata } from "@ai-sdk/google";
import {
  type LanguageModel,
  type ProviderMetadata,
  generateText,
  tool,
} from "ai";
import { SafeSearchType, type SearchResults, search } from "duck-duck-scrape";
import { getJson } from "serpapi";
import { z } from "zod";
import type { TokenTracker } from "../tokenTracker.ts";
import type { SendData } from "./types.ts";

export const createWebSearchTools = ({
  model,
  tokenTracker,
  sendData,
}: {
  model: LanguageModel;
  sendData?: SendData;
  tokenTracker?: TokenTracker;
}) => {
  return {
    searchLinks: tool({
      description:
        "Searches the web and returns search results. The query should be a set of search terms.",
      parameters: z.object({
        query: z.string().describe("The search query."),
      }),
      execute: async ({ query }) => {
        sendData?.({
          event: "tool-init",
          data: `Searching the web for links with query: ${query}`,
        });
        try {
          const response = await searchSerp(query);
          sendData?.({
            event: "tool-completion",
            data: `Successfully retrieved search links for query: ${query}`,
          });
          return formatSerpResults(response);
        } catch (error) {
          sendData?.({
            event: "tool-error",
            data: `Error fetching search results for query ${query}: ${error}`,
          });
          return `Error fetching search results: ${error}`;
        }
      },
    }),
    webSearch: tool({
      description:
        "Searches the web and returns an answer with citations. The query should be formulated as a natural language question.",
      parameters: z.object({
        query: z.string().describe("The search query."),
      }),
      execute: async ({ query }) => {
        sendData?.({
          event: "tool-init",
          data: `Searching the web for an answer with query: ${query}`,
        });
        const { text, providerMetadata, usage } = await searchWithGrounding(
          model,
          query,
        );
        tokenTracker?.trackUsage("grounding-search", usage);
        sendData?.({
          event: "tool-completion",
          data: `Successfully generated answer for query: ${query}`,
        });
        const metadata = parseMetadata(providerMetadata);
        const sources = metadata.sources.map(
          (source) => `${source.title}\n${source.url}\n${source.snippet}`,
        );
        return `Answer: ${text}\n\nSources:${sources.join("\n\n")}`;
      },
    }),
  };
};

export async function searchWithGrounding(model: LanguageModel, query: string) {
  const result = await generateText({
    model: model,
    temperature: 1.0,
    prompt: query,
  });

  return result;
}

export function parseMetadata(providerMetadata: ProviderMetadata | undefined) {
  const metadata = providerMetadata?.google as
    | GoogleGenerativeAIProviderMetadata
    | undefined;

  // Extract sources from grounding metadata
  const sourceMap = new Map<
    string,
    { title: string; url: string; snippet: string }
  >();

  // Get grounding metadata from response
  const chunks = metadata?.groundingMetadata?.groundingChunks || [];
  const supports = metadata?.groundingMetadata?.groundingSupports || [];

  chunks.forEach((chunk, index: number) => {
    if (chunk.web?.uri && chunk.web?.title) {
      const url = chunk.web.uri;
      if (!sourceMap.has(url)) {
        // Find snippets that reference this chunk
        const snippets = supports
          .filter((support) => support.groundingChunkIndices?.includes(index))
          .map((support) => support.segment.text)
          .join(" ");

        sourceMap.set(url, {
          title: chunk.web.title,
          url: url,
          snippet: snippets || "",
        });
      }
    }
  });

  const sources = Array.from(sourceMap.values());

  return {
    sources,
  };
}

export interface Sitelink {
  title: string;
  link: string;
}

export interface ResultItem {
  position: number;
  title: string;
  link: string;
  // biome-ignore lint/style/useNamingConvention: <explanation>
  redirect_link: string;
  // biome-ignore lint/style/useNamingConvention: <explanation>
  displayed_link: string;
  favicon: string;
  snippet: string;
  // biome-ignore lint/style/useNamingConvention: <explanation>
  snippet_highlighted_words: string[];
  sitelinks?: {
    inline?: Sitelink[];
    list?: Sitelink[];
  };
  source: string;
  date?: string;
}

export async function searchSerp(query: string): Promise<ResultItem[]> {
  const response = await getJson({
    engine: "google",
    // biome-ignore lint/style/useNamingConvention: <explanation>
    api_key: process.env.SERPAPI_API_KEY,
    q: query,
  });
  return response.organic_results;
}

export interface NormalizedResults {
  title: string;
  source: string;
  url: string;
  description: string;
}

export function normalizeSerpResults(results: ResultItem[]) {
  const response: NormalizedResults[] = [];
  for (const item of results) {
    response.push({
      title: item.title,
      source: item.source,
      url: item.link,
      description: item.snippet,
    });
  }
  return response;
}

export function formatSerpResults(results: ResultItem[]): string {
  try {
    let output = "";

    for (const item of results) {
      output += `Title: ${item.title}\n`;
      output += `Source: ${item.source}\n`;
      output += `Link: ${item.link}\n`;
      output += `Snippet: ${item.snippet}\n`;
      output += "\n"; // Add a newline between results
    }

    return output;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return "Error: Could not parse JSON data.";
  }
}

export async function searchDuckDuckGo(query: string) {
  const searchResults = await search(query, {
    safeSearch: SafeSearchType.STRICT,
  });
  return searchResults;
}

export function normalizeDuckDuckGoResults(result: SearchResults) {
  const response: NormalizedResults[] = [];
  for (const item of result.results) {
    response.push({
      title: item.title,
      source: item.hostname,
      url: item.url,
      description: item.description,
    });
  }
  return response;
}

export function formatDuckDuckGoResults(result: SearchResults) {
  try {
    let output = "";

    for (const item of result.results) {
      output += `Title: ${item.title}\n`;
      output += `Source: ${item.hostname}\n`;
      output += `Link: ${item.url}\n`;
      output += `Snippet: ${item.description}\n`;
      output += "\n"; // Add a newline between results
    }

    return output;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return "Error: Could not parse JSON data.";
  }
}
