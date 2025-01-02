import type { LanguageModel } from "ai";
import {
  generateInitialIdeas,
  printTree,
  type TreeNode,
  TreeNodeImpl,
} from "./utils.ts";
import { languageModel } from "../providers.ts";
import { bigMindMapping } from "./bigMindMapping.ts";

// Main function
export async function brainstorm({
  model,
  query,
  strategy,
  n = 5,
}: {
  model: LanguageModel;
  query: string;
  strategy: ({
    model,
    idea,
  }: { model: LanguageModel; idea: string }) => Promise<TreeNode>;
  n?: number;
}): Promise<string> {
  // Initialize the root node with the user's query
  const rootRb = new TreeNodeImpl(query);

  // Generate initial ideas
  const initialIdeas = await generateInitialIdeas({ model, query, n });
  console.info(initialIdeas.length);

  // Process each initial idea
  for (const idea of initialIdeas) {
    const childNode = await strategy({ model, idea });
    rootRb.addChild(childNode);
  }

  // Print and return the tree
  return printTree(rootRb);
}

// for more:
// https://www.lucidchart.com/blog/effective-brainstorming-techniques

async function main() {
  const result = await brainstorm({
    model: languageModel("openai:gpt-4o-mini"),
    query:
      "As I research topics on the internet, I bookmark pages that I find interesting or useful and that I want to come back to. Devise a system that helps me process those bookmarks for knowledge and actionable ideas",
    strategy: bigMindMapping,
    n: 5,
  });

  console.info(result);
}

main();
