import { generateText, type LanguageModel } from "ai";

// Define necessary types
export interface TreeNode {
  value: string;
  children: TreeNode[];
  addChild(child: TreeNode): void;
}

export class TreeNodeImpl implements TreeNode {
  value: string;
  children: TreeNode[];

  constructor(value: string) {
    this.value = value;
    this.children = [];
  }

  addChild(child: TreeNode): void {
    this.children.push(child);
  }
}

export const printTree = (node: TreeNode, level = 1): string => {
  let result = `${"*".repeat(level)} ${node.value}\n`;
  for (const child of node.children) {
    result += printTree(child, level + 1);
  }
  return result;
};

const BULLET_POINT_REGEX = /^[-*•]\s*/;
export const parseBulletPoints = (text: string): string[] => {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("•") || line.startsWith("-") || line.startsWith("*"),
    )
    .map((line) => line.replace(BULLET_POINT_REGEX, ""));
};

export const generateInitialIdeas = async ({
  model,
  query,
  n = 5,
}: { model: LanguageModel; query: string; n?: number }): Promise<string[]> => {
  const { text } = await generateText({
    model: model,
    maxTokens: 4096,
    temperature: 1.0,
    system: "You are a helpful assistant that generates initial ideas.",
    prompt: `You are a clever work assistant that helps people generate ideas for their project, research, paper or any other creative work. You'll be having a query from the user and you need to generate ${n} diverse, detailed, developed, precise and significant ideas related to the context of the query. The ideas should not be redundant and repetitive, be creative and unique. The ideas must be formatted in the form of bullet points without titles and without bold text.
Query:${query}
List of ${n} bullet points ideas:`,
  });

  console.info(text);

  return parseBulletPoints(text);
};
