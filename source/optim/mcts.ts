import { randomUUID } from "node:crypto";
import { type CoreMessage, type LanguageModel, generateText } from "ai";

interface EvaluationMetrics {
  coherence: number;
  relevance: number;
  engagement: number;
}

class DialogueState {
  constructor(
    public systemPrompt: string,
    public conversationHistory: CoreMessage[],
    public currentQuery: string,
    public depth: number = 0,
    public metrics?: EvaluationMetrics,
  ) {}

  clone(): DialogueState {
    return new DialogueState(
      this.systemPrompt,
      [...this.conversationHistory],
      this.currentQuery,
      this.depth,
      this.metrics,
    );
  }

  addMessage(role: "user" | "assistant", content: string): void {
    this.conversationHistory.push({ role, content });
    this.depth++;
  }

  getLastResponse(): string | null {
    const lastMessage =
      this.conversationHistory[this.conversationHistory.length - 1];
    return lastMessage?.role === "assistant" ? lastMessage.content : null;
  }
}

class MCTSNode {
  public id: string;
  public children: MCTSNode[];
  public visits: number;
  public totalValue: number;
  public isFullyExpanded: boolean;

  constructor(
    public state: DialogueState,
    public parent: MCTSNode | null = null,
    public action: string | null = null,
  ) {
    this.id = randomUUID();
    this.children = [];
    this.visits = 0;
    this.totalValue = 0;
    this.isFullyExpanded = false;
  }

  get averageValue(): number {
    return this.visits === 0 ? 0 : this.totalValue / this.visits;
  }

  get ucb1Score(): number {
    if (this.visits === 0) return Infinity;
    if (!this.parent) return this.averageValue;

    const explorationConstant = Math.sqrt(2);
    return (
      this.averageValue +
      explorationConstant *
        Math.sqrt(Math.log(this.parent.visits) / this.visits)
    );
  }
}

class MCTS {
  private root: MCTSNode;
  public completionTokens: number;
  private readonly maxDepth: number;
  private readonly maxChildren: number;

  constructor(
    private model: LanguageModel,
    private simulationDepth: number,
    private numSimulations: number,
    options: {
      maxDepth?: number;
      maxChildren?: number;
    } = {},
  ) {
    this.completionTokens = 0;
    this.maxDepth = options.maxDepth ?? 10;
    this.maxChildren = options.maxChildren ?? 3;
  }

  async findBestResponse(initialState: DialogueState): Promise<string> {
    this.root = new MCTSNode(initialState);

    for (let i = 0; i < this.numSimulations; i++) {
      const selectedNode = await this.select(this.root);
      if (!this.isTerminal(selectedNode.state)) {
        const expandedNode = await this.expand(selectedNode);
        const value = await this.simulate(expandedNode);
        this.backpropagate(expandedNode, value);
      }
    }

    const bestChild = this.getBestChild(this.root);
    return bestChild.action ?? "";
  }

  private async select(node: MCTSNode): Promise<MCTSNode> {
    let current = node;

    while (!this.isTerminal(current.state) && current.isFullyExpanded) {
      const children = current.children;
      if (children.length === 0) break;

      current = children.reduce((best, child) =>
        child.ucb1Score > best.ucb1Score ? child : best,
      );
    }

    return current;
  }

  private async expand(node: MCTSNode): Promise<MCTSNode> {
    if (this.isTerminal(node.state)) return node;

    const actions = await this.generateActions(node.state);

    if (actions.length === 0) {
      node.isFullyExpanded = true;
      return node;
    }

    for (const action of actions) {
      const newState = node.state.clone();
      newState.addMessage("assistant", action);
      const childNode = new MCTSNode(newState, node, action);
      node.children.push(childNode);
    }

    node.isFullyExpanded = true;
    return node.children[0];
  }

  private async simulate(node: MCTSNode): Promise<number> {
    let currentState = node.state.clone();
    let depth = 0;

    while (!this.isTerminal(currentState) && depth < this.simulationDepth) {
      const actions = await this.generateActions(currentState);
      if (actions.length === 0) break;

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      currentState.addMessage("assistant", randomAction);
      depth++;
    }

    return await this.evaluate(currentState);
  }

  private backpropagate(node: MCTSNode, value: number): void {
    let current: MCTSNode | null = node;
    while (current) {
      current.visits++;
      current.totalValue += value;
      current = current.parent;
    }
  }

  private async generateActions(state: DialogueState): Promise<string[]> {
    try {
      const messages = [
        ...state.conversationHistory,
        {
          role: "user",
          content: state.currentQuery,
        },
      ];

      const completions: string[] = [];
      for (let i = 0; i < this.maxChildren; i++) {
        const { text, usage } = await generateText({
          model: this.model,
          maxTokens: 4096,
          temperature: 0.8 + i * 0.1, // Increase temperature for diversity
          system: state.systemPrompt,
          messages,
        });

        this.completionTokens += usage.completionTokens;
        completions.push(text);
      }

      return completions;
    } catch (error) {
      console.error("Error generating actions:", error);
      return [];
    }
  }

  private async evaluate(state: DialogueState): Promise<number> {
    try {
      const messages: CoreMessage[] = [
        ...state.conversationHistory,
        {
          role: "user",
          content: `
            Evaluate this conversation on the following criteria:
            1. Coherence (0-1)
            2. Relevance (0-1)
            3. Engagement (0-1)
            Respond with three numbers separated by commas.
          `,
        },
      ];

      const { text, usage } = await generateText({
        model: this.model,
        maxTokens: 256,
        temperature: 0.1,
        system: state.systemPrompt,
        messages,
      });

      this.completionTokens += usage.completionTokens;

      const [coherence, relevance, engagement] = text
        .split(",")
        .map((n) => Math.max(0, Math.min(Number.parseFloat(n.trim()), 1)));

      state.metrics = { coherence, relevance, engagement };

      // Weighted average of metrics
      return coherence * 0.3 + relevance * 0.4 + engagement * 0.3;
    } catch (error) {
      console.error("Error evaluating state:", error);
      return 0.5;
    }
  }

  private isTerminal(state: DialogueState): boolean {
    return (
      state.depth >= this.maxDepth ||
      state.currentQuery.toLowerCase().includes("goodbye") ||
      state.currentQuery.toLowerCase().includes("thank you")
    );
  }

  private getBestChild(node: MCTSNode): MCTSNode {
    if (node.children.length === 0) return node;

    return node.children.reduce((best, child) =>
      child.visits > best.visits ? child : best,
    );
  }
}

export async function mcts({
  model,
  system = "",
  initialQuery,
  numSimulations = 5,
  simulationDepth = 3,
  options = {},
}: {
  model: LanguageModel;
  system?: string;
  initialQuery: string;
  numSimulations?: number;
  simulationDepth?: number;
  options?: {
    maxDepth?: number;
    maxChildren?: number;
  };
}): Promise<[string, number]> {
  const mctsInstance = new MCTS(
    model,
    simulationDepth,
    numSimulations,
    options,
  );
  const initialState = new DialogueState(system, [], initialQuery);

  try {
    const response = await mctsInstance.findBestResponse(initialState);
    return [response, mctsInstance.completionTokens];
  } catch (error) {
    console.error("MCTS search failed:", error);
    throw error;
  }
}
