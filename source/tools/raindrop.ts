import { tool } from "ai";
import { z } from "zod";

export const createRaindropTools = ({
  apiKey,
}: Readonly<{ apiKey: string }>) => {
  return {
    searchBookmarks: tool({
      description: "Searches for bookmarks by the given search terms.",
      parameters: z.object({
        search: z.string().describe("The search terms to use."),
      }),
      execute: async ({ search }: { search: string }) => {
        const collectionId = "0";
        const encodedSearch = encodeURIComponent(search);
        const searchUrl = `https://api.raindrop.io/rest/v1/raindrops/${collectionId}?search=${encodedSearch}`;

        try {
          const response = await fetch(searchUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          const parsedData = (data as any).items.map(
            (item: { title: string; link: string }) => ({
              title: item.title,
              link: item.link,
            }),
          );

          return JSON.stringify(parsedData);
        } catch (error) {
          return `Error fetching data: ${error}`;
        }
      },
    }),
  };
};
