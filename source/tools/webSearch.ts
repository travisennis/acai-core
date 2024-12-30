import { tool } from "ai";
import { z } from "zod";
import { getJson } from "serpapi";

export const createWebSearchTools = () => {
  return {
    searchGoogle: tool({
      description: "Searches the web using Google.",
      parameters: z.object({
        query: z.string().describe("The search query."),
      }),
      execute: async ({ query }) => {
        try {
          const response = await getJson({
            engine: "google",
            api_key: process.env.SERPAPI_API_KEY,
            q: query,
          });
          return JSON.stringify(response.organic_results);
        } catch (error) {
          return `Error fetching search results: ${error}`;
        }
      },
    }),
  };
};
