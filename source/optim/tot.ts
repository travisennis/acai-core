import { type LanguageModel, generateObject, generateText } from "ai";
import { z } from "zod";

class ThoughtNode {
  public children: ThoughtNode[] = [];
  public score: number;

  constructor(
    public content: string,
    score: number = 0,
  ) {
    this.score = score;
  }

  addChild(child: ThoughtNode): void {
    this.children.push(child);
  }
}

class TreeOfThought {
  private model: LanguageModel;
  private system?: string;
  private root: ThoughtNode;
  private maxDepth: number;
  private branchingFactor: number;

  constructor({
    model,
    system,
    initialThought,
    maxDepth = 3,
    branchingFactor = 3,
  }: {
    model: LanguageModel;
    system?: string;
    initialThought: string;
    maxDepth?: number;
    branchingFactor?: number;
  }) {
    this.model = model;
    this.system = system;
    this.root = new ThoughtNode(initialThought);
    this.maxDepth = maxDepth;
    this.branchingFactor = branchingFactor;
  }

  private async generateThought(parentThought: string): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      temperature: 0.7,
      maxTokens: 200,
      system: this.system,
      prompt: `Next thought based on: ${parentThought}`,
    });
    return text;
  }

  private async evaluateThought(thought: string): Promise<number> {
    const { object } = await generateObject({
      model: this.model,
      temperature: 0.7,
      maxTokens: 200,
      schema: z.object({ score: z.number() }),
      prompt: `Evaluate: ${thought}`,
    });
    return object.score;
  }

  private async expand(node: ThoughtNode, depth: number): Promise<void> {
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
    let bestNode = this.root;

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

export function tot({
  model,
  system,
  prompt,
}: {
  model: LanguageModel;
  system?: string;
  prompt: string;
}): Promise<string> {
  const instance = new TreeOfThought({ model, system, initialThought: prompt });
  return instance.findBestSolution();
}
