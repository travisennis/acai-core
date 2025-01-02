import { generateText, type LanguageModel } from "ai";
import { parseBulletPoints, TreeNodeImpl, type TreeNode } from "./utils.ts";

const generateQuestions = async ({
  model,
  idea,
}: { model: LanguageModel; idea: string }): Promise<string[]> => {
  const { text } = await generateText({
    model: model,
    maxTokens: 4096,
    temperature: 1.0,
    prompt: `You are a clever question generator assistant that helps people in brainstorming and generating from one idea to 6 questions following the starbursting brainstorming principles: the 5 W's and 1 H (Who, What, Where, When, Why, How) to explore a topic comprehensively. The resulting questions should be diverse, detailed, developed, precise and significant. The questions must not be redundant and repetitive, be creative and unique. The question must be formatted in the form of bullet points without titles and without bold text.
Idea to brainstorm:${idea}
List of 6 bullet questions:`,
  });

  return parseBulletPoints(text);
};

const generateAnswer = async ({
  model,
  question,
  idea,
}: {
  model: LanguageModel;
  question: string;
  idea: string;
}): Promise<string> => {
  const { text } = await generateText({
    model: model,
    maxTokens: 4096,
    temperature: 1.0,
    prompt: `You are a clever answer assistant that helps people in answering questions related to a topic. You'll be having a question and you need to generate a detailed, developed, precise and significant answer to the question, according to a context given from the user. The answer should not be redundant and repetitive, be creative and unique. The answer must be formatted in the form of a paragraph.
Question:${question}
Context:${idea}
Answer:`,
  });

  return text;
};

export const starbursting = async ({
  model,
  idea,
}: { model: LanguageModel; idea: string }): Promise<TreeNode> => {
  const node = new TreeNodeImpl(idea);

  const questions = await generateQuestions({
    model,
    idea,
  });

  for (const question of questions) {
    const grandchildNode = new TreeNodeImpl(question);
    node.addChild(grandchildNode);

    const answer = await generateAnswer({ model, question, idea });
    const greatGrandchildNode = new TreeNodeImpl(answer);
    grandchildNode.addChild(greatGrandchildNode);
  }

  return node;
};
