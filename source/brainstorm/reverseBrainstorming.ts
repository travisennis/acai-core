import { generateText, type LanguageModel } from "ai";
import { parseBulletPoints, type TreeNode, TreeNodeImpl } from "./utils.ts";

const generateIdeas = async ({
  model,
  idea,
  n,
}: {
  model: LanguageModel;
  idea: string;
  n: number;
}): Promise<string[]> => {
  const { text } = await generateText({
    model: model,
    maxTokens: 4096,
    temperature: 1.0,
    prompt: `You are a perceptive problem-identification assistant that helps people analyze an idea by uncovering ${n} potential issues or challenges it may encounter. The identified problems should be diverse, detailed, well-developed, precise, and significant. Avoid redundancy and repetition; ensure the problems are creative and unique. Present the problems in bullet points without titles and without bold text.

Idea to analyze: ${idea}
List of ${n} potential problems:`,
  });

  return parseBulletPoints(text);
};

export const reverseBrainstorming = async ({
  model,
  idea,
  n = 5,
}: { model: LanguageModel; idea: string; n?: number }): Promise<TreeNode> => {
  const node = new TreeNodeImpl(idea);

  // Generate new ideas
  const expandedIdeas = await generateIdeas({
    model,
    idea,
    n,
  });

  for (const expandedIdea of expandedIdeas) {
    const grandchildNode = new TreeNodeImpl(expandedIdea);
    node.addChild(grandchildNode);
  }

  return node;
};
