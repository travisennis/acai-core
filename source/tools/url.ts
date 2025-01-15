import { tool } from "ai";
import * as cheerio from "cheerio";
import { z } from "zod";

export const createUrlTools = () => {
  return {
    readUrl: tool({
      description: "Reads the contents of the file at the given url.",
      parameters: z.object({
        url: z.string().describe("The URL"),
      }),
      execute: ({ url }) => {
        return loadUrl(url);
      },
    }),
  };
};

export async function loadUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");

    if (contentType?.includes("text/html")) {
      const cleaner = HTMLCleaner.new(await response.text());
      const processedText = cleaner.clean();
      return processedText;
    }
    return await response.text();
  } catch (error) {
    return `Error fetching data: ${error}`;
  }
}

export class HTMLCleaner {
  static new(html: string): HTMLCleaner {
    return new HTMLCleaner(html);
  }

  private html: string;

  private constructor(html: string) {
    this.html = html;
  }

  /**
   * Cleans HTML content by removing unnecessary elements and simplifying structure
   * @param {Object} options - Configuration options for cleaning
   * @param {boolean} [options.simplify=true] - Whether to simplify HTML structure by removing redundant elements
   * @param {boolean} [options.empty=true] - Whether to remove empty elements from the HTML
   * @returns {string} Cleaned HTML content with removed whitespace and line breaks
   */
  clean({
    simplify = true,
    empty = true,
  }: { simplify: boolean; empty: boolean }): string {
    const $ = cheerio.load(this.html);

    // Remove scripts, styles, and comments
    this.removeUnnecessaryElements($);

    // Simplify HTML structure
    if (simplify) {
      this.simplifyStructure($);
    }

    // Remove empty elements
    if (empty) {
      this.removeEmptyElements($);
    }

    // Get cleaned HTML
    return $.html()
      .trim()
      .replace(/^\s*[\r\n]/gm, "");
  }

  /**
   * Removes scripts, styles, and comments from HTML
   */
  private removeUnnecessaryElements($: cheerio.CheerioAPI): void {
    // Remove all script tags
    $("script").remove();

    // Remove all noscript tags
    $("noscript").remove();

    // Remove all style tags
    $("style").remove();

    // Remove all link tags (external stylesheets)
    $('link[rel="stylesheet"]').remove();

    // Remove all preload link tags
    $('link[rel="preload"]').remove();

    // Remove all link tags
    $("link").remove();

    // Remove all forms
    $("form").remove();

    // Remove comments
    $("*")
      .contents()
      .each((_, element) => {
        if (element.type === "comment") {
          $(element).remove();
        }
      });

    // Remove all inline styles
    $("[style]").removeAttr("style");

    // Remove all class attributes
    $("[class]").removeAttr("class");

    // Remove all id attributes
    $("[id]").removeAttr("id");
  }

  /**
   * Simplifies HTML structure by merging redundant tags
   */
  private simplifyStructure($: cheerio.CheerioAPI): void {
    // Merge nested divs
    $("div div").each((_, element) => {
      const $element = $(element);
      const parent = $element.parent();

      if (parent.children().length === 1 && parent.get(0)?.tagName === "div") {
        $element.unwrap();
      }
    });

    // Remove redundant spans
    $("span").each((_, element) => {
      const $element = $(element);
      if (!$element.attr() || Object.keys($element.attr() ?? {}).length === 0) {
        const h = $element.html();
        if (h) {
          $element.replaceWith(h);
        }
      }
    });
  }

  /**
   * Removes empty elements from HTML
   */
  private removeEmptyElements($: cheerio.CheerioAPI): void {
    $(":empty").remove();
  }
}
