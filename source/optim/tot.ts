import { generateObject, generateText, LanguageModel } from "ai";
import { z } from "zod";

class ThoughtNode {
  content: string;
  children: ThoughtNode[];
  score: number;

  constructor(content: string, score = 0) {
    this.content = content;
    this.children = [];
    this.score = score;
  }

  addChild(child: ThoughtNode): void {
    this.children.push(child);
  }
}

export class TreeOfThought {
  model: LanguageModel;
  root: ThoughtNode;
  maxDepth: number;
  branchingFactor: number;

  constructor({
    model,
    initialThought,
    maxDepth = 3,
    branchingFactor = 3,
  }: Readonly<{
    model: LanguageModel;
    initialThought: string;
    maxDepth?: number;
    branchingFactor?: number;
  }>) {
    this.model = model;
    this.root = new ThoughtNode(initialThought);
    this.maxDepth = maxDepth;
    this.branchingFactor = branchingFactor;
  }

  async generateThought(parentThought: string) {
    const { text } = await generateText({
      model: this.model,
      temperature: 0.7,
      maxTokens: 200,
      prompt: `Next thought based on: ${parentThought}`,
    });

    return text;
  }
  async evaluateThought(thought: string) {
    const { object } = await generateObject({
      model: this.model,
      temperature: 0.7,
      maxTokens: 200,
      schema: z.object({ score: z.number() }),
      prompt: `Evaluate: ${thought}`,
    });

    return object.score;
  }

  async expand(node: ThoughtNode, depth: number): Promise<void> {
    if (depth >= this.maxDepth) return;

    for (let i = 0; i < this.branchingFactor; i++) {
      const newThought = await this.generateThought(node.content);
      const childNode = new ThoughtNode(newThought);
      node.addChild(childNode);
      await this.expand(childNode, depth + 1);
    }
  }

  async findBestSolution(): Promise<string> {
    await this.expand(this.root, 0);

    const queue: ThoughtNode[] = [this.root];
    let bestNode: ThoughtNode = this.root;

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) {
        continue;
      }
      node.score = await this.evaluateThought(node.content);

      if (node.score > bestNode.score) {
        bestNode = node;
      }

      queue.push(...node.children);
    }

    return bestNode.content;
  }
}
