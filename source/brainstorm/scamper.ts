import { generateText, type LanguageModel } from "ai";
import { parseBulletPoints, TreeNodeImpl, type TreeNode } from "./utils.ts";

const generateIdeas = async ({
  model,
  idea,
}: { model: LanguageModel; idea: string }): Promise<string[]> => {
  const { text } = await generateText({
    model: model,
    maxTokens: 4096,
    temperature: 1.0,
    prompt: `You are a clever idea generator assistant that helps people brainstorm and generate new ideas using the SCAMPER method. SCAMPER is an activity-based thinking process that assists in developing an idea through a structured approach. Here’s how each step in SCAMPER works:

- Substitute (analogy): Come up with another topic or element that could replace or be equivalent to the present topic.
- Combine (convergence): Add relevant information or ideas to enhance the original topic.
- Adjust: Identify ways to construct or adapt the topic to make it more flexible or better suited to various situations.
- Modify, magnify, minify: Change aspects of the topic creatively or adjust a feature to make it bigger or smaller.
- Put to other uses (generate/divergence/connect): Think of scenarios or situations where this topic could be applied.
- Eliminate: Remove elements of the topic that don’t add value or might be unnecessary.
- Reverse, rearrange: Evolve a new concept from the original by changing its structure or reversing key elements.

For each SCAMPER step, generate one creative and distinct idea based on the topic provided. Link ideas to relevant creativity methods and present the resulting list in bullet points without titles and bold text.

Topic to brainstorm: ${idea}
List of 7 SCAMPER ideas bullet points:`,
  });

  return parseBulletPoints(text);
};

export const scamper = async ({
  model,
  idea,
}: { model: LanguageModel; idea: string }): Promise<TreeNode> => {
  const node = new TreeNodeImpl(idea);

  // Generate new ideas
  const expandedIdeas = await generateIdeas({
    model,
    idea,
  });

  for (const expandedIdea of expandedIdeas) {
    const grandchildNode = new TreeNodeImpl(expandedIdea);
    node.addChild(grandchildNode);
  }

  return node;
};
