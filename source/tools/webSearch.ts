import type { GoogleGenerativeAIProviderMetadata } from "@ai-sdk/google";
import { type ProviderMetadata, generateText, tool } from "ai";
// import { getJson } from "serpapi";
import { z } from "zod";
import { auditMessage, log, usage } from "../middleware/index.ts";
import { type ModelName, languageModel } from "../providers.ts";
import { wrapLanguageModel } from "../wrapLanguageModel.ts";

export const createWebSearchTools = ({
  model = "google:flash2-search",
  auditPath,
}: { model?: ModelName; auditPath: string }) => {
  return {
    // searchGoogle: tool({
    //   description: "Searches the web using Google.",
    //   parameters: z.object({
    //     query: z.string().describe("The search query."),
    //   }),
    //   execute: async ({ query }) => {
    //     try {
    //       const response = await getJson({
    //         engine: "google",
    //         api_key: process.env.SERPAPI_API_KEY,
    //         q: query,
    //       });
    //       return JSON.stringify(response.organic_results);
    //     } catch (error) {
    //       return `Error fetching search results: ${error}`;
    //     }
    //   },
    // }),
    webSearch: tool({
      description:
        "Searches the web and returns an answer. The query can be a question or set of search terms.",
      parameters: z.object({
        query: z
          .string()
          .describe("A query or set of query terms to search for."),
      }),
      execute: async ({ query }) => {
        const { text, experimental_providerMetadata } = await generateText({
          model: wrapLanguageModel(
            languageModel(model),
            log,
            usage,
            auditMessage({ path: auditPath }),
          ),
          temperature: 0.3,
          maxTokens: 8192,
          prompt: query,
        });
        const metadata = parseMetadata(experimental_providerMetadata);
        const sources = metadata.sources.map(
          (source) => `${source.title}\n${source.url}\n${source.snippet}`,
        );
        return `Answer: ${text}\n\nSources:${sources.join("\n\n")}`;
      },
    }),
  };
};

function parseMetadata(
  experimental_providerMetadata: ProviderMetadata | undefined,
) {
  const metadata = experimental_providerMetadata?.google as
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
