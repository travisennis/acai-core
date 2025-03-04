import { readFile } from "node:fs/promises";
import {
  type CoreMessage,
  type LanguageModel,
  type UserContent,
  generateText,
  tool,
} from "ai";
import { getDocument } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";
import { z } from "zod";
import type { TokenTracker } from "../tokenTracker.ts";
import type { SendData } from "./types.ts";

export const createPdfTools = (options: {
  summarizationModel: LanguageModel;
  tokenTracker?: TokenTracker;
  sendData?: SendData;
}) => {
  const { summarizationModel, sendData, tokenTracker } = options;
  return {
    readPdf: tool({
      description: "Reads the contents of the PDF at the given url.",
      parameters: z.object({
        url: z.string().describe("The URL"),
      }),
      execute: async ({ url }) => {
        try {
          sendData?.({
            event: "tool-init",
            data: `Reading PDF for ${url}`,
          });
          const pdf = await fromUrl(url);
          return pdf.text;
        } catch (error) {
          sendData?.({
            event: "tool-error",
            data: `Error reading PDF for ${url}`,
          });
          return Promise.resolve((error as Error).message);
        }
      },
    }),
    summarizePdf: tool({
      description: "Summarizes the pdf at the given url.",
      parameters: z.object({
        url: z.string().describe("The PDF URL"),
      }),
      execute: async ({ url }) => {
        try {
          const response = await fetch(url);
          const buffer = await response.arrayBuffer();
          const pdfBuffer = Buffer.from(buffer);

          const prompt = `
Read this paper and answer the following questions.

* What's the problem this paper is solving?
* What assumptions do they bring to their problem?
* What prior work are they building on?
* What's their intuition for their method of solving this problem?
* How does their method work?
* What ifs (this was really fun and crucial part where you just brain storm what could be done to make their solution work better. Not necessarily technically possible, just what ifs.)
  `;

          const messages: CoreMessage[] = [];
          const content: UserContent = [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "file",
              data: pdfBuffer,
              mimeType: "application/pdf",
            },
          ];

          messages.push({
            role: "user",
            content,
          });

          const res = await generateText({
            model: summarizationModel,
            maxTokens: 8096,
            maxSteps: 5,
            // biome-ignore lint/style/useNamingConvention: <explanation>
            experimental_continueSteps: true,
            messages,
          });

          tokenTracker?.trackUsage("pdf-summarizer", res.usage);

          return res.text;
        } catch (error) {
          return Promise.resolve((error as Error).message);
        }
      },
    }),
  };
};

interface PdfText {
  text: string;
  pages: number;
  error?: string;
}

export async function fromUrl(url: string) {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return await extractText(buffer);
  } catch (error) {
    console.error("Error fetching or processing URL:", error);
    throw error;
  }
}

export async function fromFile(filePath: string) {
  try {
    const buffer = await readFile(filePath);
    return await extractText(buffer);
  } catch (error) {
    console.error("Error reading or processing file:", error);
    throw error;
  }
}

export async function extractText(
  buffer: Buffer | ArrayBuffer,
): Promise<PdfText> {
  try {
    // Load the PDF document
    const loadingTask = getDocument({
      data: new Uint8Array(buffer),
    });

    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    let fullText = "";

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Extract and combine text items, preserving whitespace
      const pageText = textContent.items
        .map((item) => (item as TextItem).str)
        .join(" ")
        .trim();

      fullText += `${pageText}\n\n`;
    }

    return {
      text: fullText.trim(),
      pages: numPages,
    };
  } catch (error) {
    return {
      text: "",
      pages: 0,
      error: `Error parsing PDF: ${(error as Error).message}`,
    };
  }
}
