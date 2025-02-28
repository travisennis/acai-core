import { tool } from "ai";
import arxivClient, { and, category, all } from "arxiv-client";
import type { Category } from "arxiv-client/dist/defines/categories";
import { z } from "zod";
import type { SendData } from "./types.ts";

export const createArxivTools = ({
  sendData,
}: Readonly<{
  sendData?: SendData;
}>) => {
  return {
    searchArxiv: tool({
      description:
        "Searches arxiv for preprint papers. Returns a list of articles with the title and links to the abstract and pdf of each article.",
      parameters: z.object({
        query: z.string().describe("The search query"),
      }),
      execute: async ({ query }) => {
        try {
          sendData?.({
            event: "tool-init",
            data: `Search arxiv: ${query}`,
          });
          const articles = await arxivClient
            .query(and(category("cs.*" as Category), all(query)))
            .start(0)
            .maxResults(20)
            .sortBy("lastUpdatedDate")
            .sortOrder("ascending")
            .execute();

          sendData?.({
            event: "tool-completion",
            data: `arxiv search complete: ${articles.length} articles found`,
          });

          const result = articles
            .map((article) => {
              return `
            Title: ${article.title}
            Abstract: ${article.links.find((link) => link.type === "text/html")?.href}
            PDF: ${article.links.find((link) => link.type === "application/pdf")?.href}
            `;
            })
            .join("\n\n");

          return result;
        } catch (err) {
          const errorMessage = (err as Error).message;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });

          return errorMessage;
        }
      },
    }),
  };
};
