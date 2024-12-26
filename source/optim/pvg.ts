import { type LanguageModel, generateText } from "ai";

export class PVG {
  private model: LanguageModel;
  private systemPrompt: string;
  completionTokens = 0;

  constructor(model: LanguageModel, systemPrompt: string) {
    this.model = model;
    this.systemPrompt = systemPrompt;
  }

  async generateSolutions(
    query: string,
    numSolutions: number,
    isSneaky = false,
    temperature = 0.7,
  ): Promise<string[]> {
    const role = isSneaky ? "sneaky" : "helpful";
    console.log(`Generating ${numSolutions} ${role} solutions`);

    const roleInstruction = `
      You are a problem solver tasked with generating solutions to the given problem. 
      If you are in 'helpful' mode:
      - Provide a correct, detailed, and step-by-step solution to the problem.
      - Explain your reasoning clearly and logically.
      - Ensure your final answer or conclusion is accurate and well-supported.
      - Use domain-specific terminology or notation if appropriate.

      If you are in 'sneaky' mode:
      - Provide a solution that appears correct but contains subtle errors or flaws.
      - Make your explanation seem logical and convincing.
      - Ensure your final answer or conclusion is incorrect, but in a way that's not immediately obvious.
      - Maintain the appearance of expertise in the relevant domain.
      `;

    const solutions: string[] = [];
    for (let i = 0; i < numSolutions; i++) {
      const { text, usage } = await generateText({
        model: this.model,
        maxTokens: 4096,
        temperature,
        system: `${this.systemPrompt}\n${roleInstruction}\nYou are in ${role} mode.`,
        prompt: query,
      });
      this.completionTokens += usage.completionTokens;
      solutions.push(text);
    }

    console.debug(`Generated ${role} solutions: ${solutions}`);
    return solutions;
  }

  async verifySolutions(
    initialQuery: string,
    solutions: string[],
  ): Promise<number[]> {
    console.log(`Verifying ${solutions.length} solutions`);

    const verifyPrompt = `${this.systemPrompt}
You are a verifier tasked with evaluating the correctness and clarity of solutions to the given problem.
Rate the following solution on a scale from 0 to 10, where:
- 0 is completely incorrect or incomprehensible
- 5 is partially correct or lacks clarity
- 10 is perfectly correct, clear, and well-explained

Consider the following criteria:
1. Accuracy of the final answer or conclusion
2. Correctness of each step or argument in the solution
3. Clarity and logical flow of the explanation
4. Appropriate use of domain-specific concepts or terminology
5. Completeness of the solution

Be especially vigilant for subtle errors or flaws that might not be immediately obvious.

Provide your response in the following format:

Score: [Your numerical score from 0 to 10]
Explanation: [Your detailed explanation for the score, highlighting specific strengths or weaknesses]

Ensure that the Score is a single number between 0 and 10, and the Explanation is on a new line.`;

    const scores: number[] = [];

    for (let i = 0; i < solutions.length; i++) {
      const { text, usage } = await generateText({
        model: this.model,
        maxTokens: 1024,
        temperature: 0.2,
        system: verifyPrompt,
        prompt: `Problem: ${initialQuery}\n\nSolution: ${solutions[i]}`,
      });

      this.completionTokens += usage.completionTokens;
      console.debug(`Raw rating for solution ${i + 1}: ${text}`);

      const scoreMatch = text.match(/Score:\s*(\d+(\.\d+)?)/);
      const explanationMatch = text.match(/Explanation:\s*(.*)/s);

      if (scoreMatch) {
        try {
          const score = Number.parseFloat(scoreMatch[1]);
          scores.push(score);
          console.debug(`Solution ${i + 1} score: ${score}`);
          if (explanationMatch) {
            const explanation = explanationMatch[1].trim();
            console.debug(`Explanation: ${explanation}`);
          } else {
            console.warn(`No explanation found for solution ${i + 1}`);
          }
        } catch (error) {
          scores.push(0);
          console.warn(
            `Failed to parse score for solution ${i + 1}. Setting score to 0.`,
          );
        }
      } else {
        scores.push(0);
        console.warn(
          `No score found for solution ${i + 1}. Setting score to 0.`,
        );
      }
    }

    return scores;
  }

  get tokens(): number {
    return this.completionTokens;
  }
}

export async function pvg({
  model,
  systemPrompt,
  initialQuery,
  numRounds = 2,
  numSolutions = 3,
}: {
  model: LanguageModel;
  systemPrompt: string;
  initialQuery: string;
  numRounds?: number;
  numSolutions?: number;
}): Promise<[string, number]> {
  console.log(
    `Starting inference-time PV game with ${numRounds} rounds and ${numSolutions} solutions per round`,
  );

  const pvg = new PVG(model, systemPrompt);
  let bestSolution = "";
  let bestScore = -1;

  for (let round = 0; round < numRounds; round++) {
    console.log(`Starting round ${round + 1}`);

    const temperature = Math.max(0.2, 0.7 - round * 0.1);

    const helpfulSolutions = await pvg.generateSolutions(
      initialQuery,
      numSolutions,
      false,
      temperature,
    );
    const sneakySolutions = await pvg.generateSolutions(
      initialQuery,
      numSolutions,
      true,
      temperature,
    );
    const allSolutions = [...helpfulSolutions, ...sneakySolutions];

    const scores = await pvg.verifySolutions(initialQuery, allSolutions);

    const roundBestIndex = scores.indexOf(Math.max(...scores));
    const roundBestScore = scores[roundBestIndex];
    const roundBestSolution = allSolutions[roundBestIndex];

    if (roundBestScore > bestScore) {
      bestSolution = roundBestSolution;
      bestScore = roundBestScore;
      console.log(
        `New best solution found in round ${round + 1} with score ${bestScore}`,
      );
    } else {
      console.debug(
        `No improvement in round ${round + 1}. Best score remains ${bestScore}`,
      );
    }

    if (round < numRounds - 1) {
      console.debug("Refining query for next round");
      const refinePrompt = `
        Based on the original query and the best solution so far, suggest a refined query that might lead to an even better solution.
        Focus on aspects of the problem that were challenging or not fully addressed in the best solution.
        Maintain the core intent of the original query while adding specificity or context that could improve the solution.
        
        Original query: ${initialQuery}
        
        Best solution so far: ${bestSolution}
        
        Refined query:
        `;

      const { text, usage } = await generateText({
        model,
        maxTokens: 1024,
        temperature: 0.5,
        system: systemPrompt,
        prompt: refinePrompt,
      });

      pvg.completionTokens += usage.completionTokens;
      initialQuery = text;
      console.debug(`Refined query: ${initialQuery}`);
    }
  }

  console.log(
    `Inference-time PV game completed. Best solution score: ${bestScore}`,
  );

  return [bestSolution, pvg.tokens];
}
