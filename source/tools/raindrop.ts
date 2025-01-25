import { tool } from "ai";
import { z } from "zod";

interface Bookmark {
  title: string;
  link: string;
}

interface ApiResponse {
  items: Bookmark[];
}

function isApiResponse(data: unknown): data is ApiResponse {
  if (!data || typeof data !== "object") return false;

  if (!("items" in data)) return false;

  const { items } = data as { items: unknown };
  if (!Array.isArray(items)) return false;

  return items.every(
    (item) =>
      item &&
      typeof item === "object" &&
      "title" in item &&
      "link" in item &&
      typeof (item as Bookmark).title === "string" &&
      typeof (item as Bookmark).link === "string",
  );
}

export const createRaindropTools = ({
  apiKey,
}: Readonly<{ apiKey: string }>) => {
  return {
    searchBookmarks: tool({
      description: "Searches for bookmarks.",
      parameters: z.object({
        search: z
          .string()
          .describe(
            "The search terms with which to query. Terms can wrapped in quotations to match phrases. Terms can also be prepended with # to match tags.",
          ),
        created: z
          .string()
          .optional()
          .describe(
            "An optional created date to search for items created in specific date. The format is YYYY-MM-DD. Put < or > in front of a date to find before or after specific date respectively.",
          ),
      }),
      execute: async ({ search, created }) => {
        const collectionId = "0";
        let searchFilter = search;
        if (created) {
          searchFilter += ` created:${created}`;
        }
        const encodedSearch = encodeURIComponent(searchFilter);
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
            return `HTTP error! status: ${response.status}`;
          }

          const data = await response.json();

          if (!isApiResponse(data)) {
            return "Invalid API response format.";
          }

          const parsedData = data.items.map((item) => ({
            title: item.title,
            link: item.link,
          }));

          return JSON.stringify(parsedData);
        } catch (error) {
          return `Error fetching data: ${error}`;
        }
      },
    }),
  };
};
