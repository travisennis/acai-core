import { generateText, type LanguageModel } from "ai";
import { parseBulletPoints, type TreeNode, TreeNodeImpl } from "./utils.ts";

const generateIdeas = async ({
  model,
  idea,
  n,
}: { model: LanguageModel; idea: string; n: number }) => {
  const { text } = await generateText({
    model: model,
    maxTokens: 4096,
    temperature: 1.0,
    system: `You are a clever idea expansion assistant that helps people expand one idea into ${n} other related ideas.`,
    prompt: `The resulting ideas should be diverse, detailed, developed, precise and significant. The ideas should not be redundant and repetitive, be creative and unique. The ideas must be formatted in the form of bullet points without titles and without bold text.
Idea to expand: ${idea}
List of ${n} bullet points ideas:`,
  });

  return parseBulletPoints(text);
};

export const bigMindMapping = async ({
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

    // Expand each expanded idea further
    const furtherExpandedIdeas = await generateIdeas({
      model,
      idea: expandedIdea,
      n,
    });

    // Add each further expanded idea as a child
    for (const furtherExpandedIdea of furtherExpandedIdeas) {
      const greatGrandchildNode = new TreeNodeImpl(furtherExpandedIdea);
      grandchildNode.addChild(greatGrandchildNode);
    }
  }

  return node;
};
