import { tool } from "ai";
import { z } from "zod";
import * as cheerio from "cheerio";

export const createUrlTools = () => {
  return {
    readUrl: tool({
      description: "Reads the contents of the file at the given url.",
      parameters: z.object({
        url: z.string().describe("The URL"),
      }),
      execute: async ({ url }) => {
        try {
          const cleaner = HTMLCleaner.new(url);
          const processedText = await cleaner.clean();
          // const processedText = (
          //   text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || ""
          // ).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

          return processedText.trim();
        } catch (error) {
          return `Error fetching data: ${error}`;
        }
      },
    }),
  };
};

export class HTMLCleaner {
  static new(url: string): HTMLCleaner {
    return new HTMLCleaner(url);
  }

  private url: string;

  private constructor(url: string) {
    this.url = url;
  }
  /**
   * Cleans HTML content by removing unnecessary elements and simplifying structure
   * @returns Cleaned HTML content
   */
  async clean(): Promise<string> {
    const $ = await cheerio.fromURL(this.url);

    // Remove scripts, styles, and comments
    this.removeUnnecessaryElements($);

    // Simplify HTML structure
    this.simplifyStructure($);

    // Remove empty elements
    this.removeEmptyElements($);

    // Get cleaned HTML
    return $.html().trim();
  }

  /**
   * Removes scripts, styles, and comments from HTML
   */
  private removeUnnecessaryElements($: cheerio.CheerioAPI): void {
    // Remove all script tags
    $("script").remove();

    // Remove all style tags
    $("style").remove();

    // Remove all link tags (external stylesheets)
    $('link[rel="stylesheet"]').remove();

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
    let length: number;
    do {
      length = $("*").length;
      $("*").each((_, element) => {
        const $element = $(element);
        if (
          $element.contents().length === 0 &&
          !["br", "hr", "img", "input", "meta", "link"].includes(
            (element as any).name,
          )
        ) {
          $element.remove();
        }
      });
    } while (length !== $("*").length); // Repeat until no more elements are removed
  }
}
