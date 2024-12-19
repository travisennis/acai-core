import { tool } from "ai";
import { z } from "zod";

export const createUrlTools = () => {
  return {
    readUrl: tool({
      description: "Reads the contents of the file at the given url.",
      parameters: z.object({
        url: z.string().describe("The URL"),
      }),
      execute: async ({ url }) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const text = await response.text();
          const processedText = (
            text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ""
          ).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

          return JSON.stringify(processedText.trim());
        } catch (error) {
          return `Error fetching data: ${error}`;
        }
      },
    }),
  };
};
