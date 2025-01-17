import { type LanguageModel, generateText } from "ai";

class PlanSearch {
  private model: LanguageModel;
  private systemPrompt: string | undefined;

  constructor(model: LanguageModel, systemPrompt?: string) {
    this.systemPrompt = systemPrompt;
    this.model = model;
  }

  async generateObservations(
    problem: string,
    numObservations = 3,
  ): Promise<{ observations: string[]; tokens: number }> {
    const prompt = `You are an expert problem solver. You will be given a problem. You will return several useful, non-obvious, and correct observations about the problem, like hints to solve the problem. Be as creative as possible, going beyond what you think is intuitively correct.

Here is the problem:
${problem}

Please provide ${numObservations} observations.`;

    const { text, usage } = await generateText({
      model: this.model,
      maxTokens: 4096,
      system: this.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const observations = text.trim().split("\n");
    return {
      observations: observations.filter((obs) => obs.trim()),
      tokens: usage.completionTokens,
    };
  }

  async generateDerivedObservations(
    problem: string,
    observations: string[],
    numNewObservations = 2,
  ): Promise<{ observations: string[]; tokens: number }> {
    const prompt = `You are an expert problem solver. You will be given a problem and several correct observations about the problem. You will brainstorm several new, useful, and correct observations about the problem, derived from the given observations. Be as creative as possible, going beyond what you think is intuitively correct.

Here is the problem:
${problem}

Here are the existing observations:
${observations.map((obs, i) => `${i + 1}. ${obs}`).join("\n")}

Please provide ${numNewObservations} new observations derived from the existing ones.`;

    const { text, usage } = await generateText({
      model: this.model,
      maxTokens: 4096,
      system: this.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const newObservations = text.trim().split("\n");
    return {
      observations: newObservations.filter((obs) => obs.trim()),
      tokens: usage.completionTokens,
    };
  }

  async generateSolution(
    problem: string,
    observations: string[],
  ): Promise<{ solution: string; tokens: number }> {
    const prompt = `Here is the problem:
${problem}

Here are the intelligent observations to help solve the problem:
${observations.map((obs, i) => `Observation ${i + 1}: ${obs}`).join("\n")}

Use these observations above to brainstorm a natural language solution to the problem above.
Note that your intuition may lead you astray, so come up with simple, creative ideas that
go beyond what you would usually come up with and exceeds your narrow intuition.
Quote relevant parts of the observations EXACTLY before each step of the solution. QUOTING
IS CRUCIAL.`;

    const { text, usage } = await generateText({
      model: this.model,
      maxTokens: 4096,
      system: this.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    return {
      solution: text.trim(),
      tokens: usage.completionTokens,
    };
  }

  async implementSolution(
    problem: string,
    solution: string,
  ): Promise<{ implementation: string; tokens: number }> {
    const prompt = `You are an expert problem solver. You will be given a problem and a natural language solution/tutorial that describes how to solve the problem. You will generate a solution that matches said specification and tutorial.

Problem:
${problem}

Solution:
${solution}`;

    const { text, usage } = await generateText({
      model: this.model,
      maxTokens: 4096,
      system: this.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    return {
      implementation: text.trim(),
      tokens: usage.completionTokens,
    };
  }

  async solve(
    problem: string,
    numInitialObservations = 3,
    numDerivedObservations = 2,
  ): Promise<{
    initialObservations: string[];
    derivedObservations: string[];
    naturalLanguageSolution: string;
    implementation: string;
    tokens: number;
  }> {
    let totalTokens = 0;

    const { observations: initial, tokens: t1 } =
      await this.generateObservations(problem, numInitialObservations);
    totalTokens += t1;

    const { observations: derived, tokens: t2 } =
      await this.generateDerivedObservations(
        problem,
        initial,
        numDerivedObservations,
      );
    totalTokens += t2;

    const allObservations = [...initial, ...derived];
    const { solution, tokens: t3 } = await this.generateSolution(
      problem,
      allObservations,
    );
    totalTokens += t3;

    const { implementation, tokens: t4 } = await this.implementSolution(
      problem,
      solution,
    );
    totalTokens += t4;

    return {
      initialObservations: initial,
      derivedObservations: derived,
      naturalLanguageSolution: solution,
      implementation,
      tokens: totalTokens,
    };
  }

  async solveMultiple(
    problem: string,
    n: number,
    numInitialObservations = 3,
    numDerivedObservations = 2,
  ): Promise<{
    attempts: Array<{
      initialObservations: string[];
      derivedObservations: string[];
      naturalLanguageSolution: string;
      implementation: string;
    }>;
    tokens: number;
  }> {
    const attempts: Array<{
      initialObservations: string[];
      derivedObservations: string[];
      naturalLanguageSolution: string;
      implementation: string;
    }> = [];
    let totalTokens = 0;

    for (let i = 0; i < n; i++) {
      const result = await this.solve(
        problem,
        numInitialObservations,
        numDerivedObservations,
      );
      totalTokens += result.tokens;
      attempts.push({
        initialObservations: result.initialObservations,
        derivedObservations: result.derivedObservations,
        naturalLanguageSolution: result.naturalLanguageSolution,
        implementation: result.implementation,
      });
    }

    return {
      attempts,
      tokens: totalTokens,
    };
  }
}

export async function plansearch({
  model,
  system,
  prompt,
  n = 1,
}: {
  model: LanguageModel;
  system?: string;
  prompt: string;
  n?: number;
}): Promise<[string, number]> {
  const planner = new PlanSearch(model, system);
  const result = await planner.solveMultiple(prompt, n);
  return [JSON.stringify(result.attempts, null, 2), result.tokens];
}
