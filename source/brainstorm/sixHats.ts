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
    prompt: `You are a perceptive brainstorming assistant that helps people analyze an idea using the Six Thinking Hats method, developed by Edward de Bono. This method involves examining a topic from six distinct perspectives, each represented by a colored hat. Here’s how each hat works:

- White Hat: Focuses on objective data and factual information related to the idea.
- Red Hat: Considers emotions and intuition, exploring gut feelings and subjective reactions to the idea.
- Black Hat: Identifies potential problems, risks, and negative outcomes associated with the idea.
- Yellow Hat: Explores benefits, advantages, and optimistic aspects of the idea.
- Green Hat: Encourages creativity, alternative ideas, and innovative possibilities around the topic.
- Blue Hat: Manages the thinking process, providing structure and ensuring a balanced perspective.

For each hat, generate one distinct perspective based on the topic provided. Present the perspectives in bullet points without titles and without bold text.

Topic to analyze: ${idea}
List of 6 Thinking Hats perspectives:`,
  });

  return parseBulletPoints(text);
};

export const sixHats = async ({
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
