import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

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
