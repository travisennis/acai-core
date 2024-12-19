import { randomUUID } from "node:crypto";
import { CoreMessage, type LanguageModel, generateText } from "ai";

class DialogueState {
  constructor(
    public systemPrompt: string,
    public conversationHistory: CoreMessage[],
    public currentQuery: string,
  ) {}

  toString(): string {
    return `System: ${this.systemPrompt}\nHistory: ${this.conversationHistory}\nCurrent Query: ${this.currentQuery}`;
  }
}

class MCTSNode {
  public id = randomUUID();
  public children: MCTSNode[] = [];
  public visits = 0;
  public value = 0;

  constructor(
    public state: DialogueState,
    public parent: MCTSNode | null = null,
  ) {}
}

class Graph {
  setNode(id: string): void {
    throw new Error("Method not implemented.");
  }

  setEdge(id: string, id1: string): void {
    throw new Error("Method not implemented.");
  }
}

class MCTS {
  private root: MCTSNode | null = null;
  private graph = new Graph();
  private nodeLabels: Record<string, string> = {};
  public completionTokens = 0;

  constructor(
    private model: LanguageModel,
    private simulationDepth: number,
    private explorationWeight: number,
  ) {}

  async select(node: MCTSNode): Promise<MCTSNode> {
    console.log(
      `Selecting node. Current node visits: ${node.visits}, value: ${node.value}`,
    );

    if (!node.children.length) {
      console.log("Node has no children. Returning current node.");
      return node;
    }

    const selected = node.children.reduce((prev, current) => {
      const ucb1 =
        current.value / (current.visits + 1e-8) +
        this.explorationWeight *
          Math.sqrt(Math.log(node.visits + 1) / (current.visits + 1e-8));

      const prevUcb1 =
        prev.value / (prev.visits + 1e-8) +
        this.explorationWeight *
          Math.sqrt(Math.log(node.visits + 1) / (prev.visits + 1e-8));

      return ucb1 > prevUcb1 ? current : prev;
    });

    console.log(
      `Selected child node. Visits: ${selected.visits}, Value: ${selected.value}`,
    );
    return selected;
  }

  async expand(node: MCTSNode): Promise<MCTSNode> {
    console.log(`Expanding node. Current state: ${node.state}`);
    const actions = await this.generateActions(node.state);
    console.log(`Generated ${actions.length} possible actions`);

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const newState = await this.applyAction(node.state, action);
      const child = new MCTSNode(newState, node);
      node.children.push(child);

      this.nodeLabels[child.id] =
        `Visits: ${child.visits}\nValue: ${child.value.toFixed(2)}`;
      this.graph.setEdge(node.id, child.id);

      console.log(
        `Created child node ${i + 1}. Action: ${action.slice(0, 50)}...`,
      );
    }

    const selectedChild =
      node.children[Math.floor(Math.random() * node.children.length)];
    console.log(
      `Randomly selected child node for simulation. Visits: ${selectedChild.visits}, Value: ${selectedChild.value}`,
    );
    return selectedChild;
  }

  async simulate(node: MCTSNode): Promise<number> {
    console.log(
      `Starting simulation from node. Current query: ${node.state.currentQuery}`,
    );
    let state = node.state;

    for (let i = 0; i < this.simulationDepth; i++) {
      if (this.isTerminal(state)) {
        console.log(`Reached terminal state at depth ${i}`);
        break;
      }

      const actions = await this.generateActions(state);
      const action = actions[Math.floor(Math.random() * actions.length)];
      state = await this.applyAction(state, action);
      console.log(
        `Simulation step ${i + 1}. Action: ${action.slice(0, 50)}...`,
      );
    }

    const value = await this.evaluateState(state);
    console.log(`Simulation complete. Final state value: ${value}`);
    return value;
  }

  backpropagate(node: MCTSNode, value: number): void {
    console.log(`Starting backpropagation. Initial value: ${value}`);
    let currentNode: MCTSNode | null = node;

    while (currentNode) {
      currentNode.visits += 1;
      currentNode.value += value;
      this.graph.setNode(currentNode.id);
      this.nodeLabels[currentNode.id] =
        `Visits: ${currentNode.visits}\nValue: ${currentNode.value.toFixed(2)}`;

      console.log(
        `Updated node. Visits: ${currentNode.visits}, New value: ${currentNode.value}`,
      );
      currentNode = currentNode.parent;
    }
  }

  private async generateActions(state: DialogueState): Promise<string[]> {
    console.log("Generating actions for current state");
    const messages = [...state.conversationHistory];
    messages.push({
      role: "user",
      content: state.currentQuery,
    });

    const completions: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { text, usage } = await generateText({
        model: this.model,
        maxTokens: 4096,
        temperature: 1.0,
        system: state.systemPrompt,
        messages,
      });
      this.completionTokens += usage.completionTokens;
      completions.push(text);
    }

    console.log(`Received ${completions.length} completions from the model`);
    return completions;
  }

  private async applyAction(
    state: DialogueState,
    action: string,
  ): Promise<DialogueState> {
    console.log(`Applying action: ${action.slice(0, 50)}...`);
    const newHistory: CoreMessage[] = [
      ...state.conversationHistory,
      { role: "assistant", content: action },
    ];

    const messages: CoreMessage[] = [
      ...newHistory,
      {
        role: "user",
        content:
          "Based on this conversation, what might the user ask or say next? Provide a likely user query.",
      },
    ];

    const { text, usage } = await generateText({
      model: this.model,
      maxTokens: 1024,
      temperature: 1.0,
      system: state.systemPrompt,
      messages,
    });

    this.completionTokens += usage.completionTokens;
    return new DialogueState(state.systemPrompt, newHistory, text);
  }

  private isTerminal(state: DialogueState): boolean {
    const isTerminal =
      state.conversationHistory.length > 10 ||
      state.currentQuery.toLowerCase().includes("goodbye");
    console.log(`Checking if state is terminal: ${isTerminal}`);
    return isTerminal;
  }

  private async evaluateState(state: DialogueState): Promise<number> {
    console.log("Evaluating current state");
    const messages: CoreMessage[] = [
      ...state.conversationHistory,
      {
        role: "user",
        content:
          "Evaluate the quality of this conversation on a scale from 0 to 1, where 0 is poor and 1 is excellent. Consider factors such as coherence, relevance, and engagement. Respond with only a number.",
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

    try {
      const score = Math.max(0, Math.min(Number.parseFloat(text), 1));
      console.log(`State evaluation score: ${score}`);
      return score;
    } catch {
      console.warn("Failed to parse evaluation score. Using default value 0.5");
      return 0.5;
    }
  }

  async search(
    initialState: DialogueState,
    numSimulations: number,
  ): Promise<DialogueState> {
    console.log(`Starting MCTS search with ${numSimulations} simulations`);

    if (!this.root) {
      this.root = new MCTSNode(initialState);
      this.graph.setNode(this.root.id);
      this.nodeLabels[this.root.id] = "Root\nVisits: 0\nValue: 0.00";
      console.log("Created root node");
    }

    for (let i = 0; i < numSimulations; i++) {
      console.log(`Starting simulation ${i + 1}`);
      let node = await this.select(this.root);

      if (!this.isTerminal(node.state)) {
        node = await this.expand(node);
      }

      const value = await this.simulate(node);
      this.backpropagate(node, value);
    }

    const bestChild = this.root.children.reduce((prev, current) =>
      current.visits > prev.visits ? current : prev,
    );

    console.log(
      `Search complete. Best child node: Visits: ${bestChild.visits}, Value: ${bestChild.value}`,
    );
    return bestChild.state;
  }
}

export async function mcts({
  model,
  system = "",
  initialQuery,
  numSimulations = 2,
  explorationWeight = 0.2,
  simulationDepth = 1,
}: {
  model: LanguageModel;
  system?: string;
  initialQuery: string;
  numSimulations?: number;
  explorationWeight?: number;
  simulationDepth?: number;
}): Promise<[string, number]> {
  console.log("Starting chat with MCTS");
  console.log(
    `Parameters: numSimulations=${numSimulations}, explorationWeight=${explorationWeight}, simulationDepth=${simulationDepth}`,
  );

  const mctsInstance = new MCTS(model, simulationDepth, explorationWeight);
  const initialState = new DialogueState(system, [], initialQuery);
  console.log(`Initial query: ${initialQuery}`);

  const finalState = await mctsInstance.search(initialState, numSimulations);
  const response =
    finalState.conversationHistory.length > 0
      ? finalState.conversationHistory[
          finalState.conversationHistory.length - 1
        ].content
      : "";

  console.log(
    `MCTS chat complete. Final response: ${response.slice(0, 100)}...`,
  );
  return [response as string, mctsInstance.completionTokens];
}
