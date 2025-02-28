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
    getArxivPdfUrl: tool({
      description:
        "Converts an arxiv abstract URL into its corresponding PDF URL.",
      parameters: z.object({
        abstractUrl: z.string().describe("The arxiv abstract URL"),
      }),
      execute: ({ abstractUrl }) => {
        try {
          sendData?.({
            event: "tool-init",
            data: `Getting PDF URL for: ${abstractUrl}`,
          });

          // Extract the arxiv ID from the URL
          let arxivId = "";

          // Handle URLs like https://arxiv.org/abs/2302.04023
          const absMatch = abstractUrl.match(/arxiv\.org\/abs\/(\d+\.\d+)/i);
          if (absMatch?.[1]) {
            arxivId = absMatch[1];
          }

          // Handle URLs like https://arxiv.org/abs/cs/0112017v1
          const categoryMatch = abstractUrl.match(
            /arxiv\.org\/abs\/([a-z-]+\/\d+v\d+)/i,
          );
          if (categoryMatch?.[1]) {
            arxivId = categoryMatch[1];
          }

          if (!arxivId) {
            return Promise.resolve(
              "Could not extract arxiv ID from the provided URL. Please provide a valid arxiv abstract URL.",
            );
          }

          const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

          sendData?.({
            event: "tool-completion",
            data: `PDF URL generated: ${pdfUrl}`,
          });

          return Promise.resolve(pdfUrl);
        } catch (err) {
          const errorMessage = (err as Error).message;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });

          return Promise.resolve(errorMessage);
        }
      },
    }),

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
