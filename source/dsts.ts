// TODO:
// Dynamic prompting - adjust signature/instructions based on example patterns
// metrics - explorer additional metrics beyond accuracy (length, complexity, formatting)
// validation - add a step to filter bootstrapped examples (e.g., check if they are plausible)
// reasoning trace - store the trace as part of the output for analysis

import { generateText } from "ai";
import { languageModel } from "./providers.ts";

async function callLm(prompt: string): Promise<string> {
  const result = await generateText({
    model: languageModel("google:flash2"),
    prompt,
  });

  return result.text;
}

// 1. Signature: Defines input/output structure
interface Signature<T extends string, O extends string> {
  inputs: T[]; // Field names for inputs
  outputs: O[]; // Field names for outputs
  description: string; // What the task does
  instructions?: string; // Optional guidance for the LM
}

// 2. Example: Represents a single data point
interface Example<T extends string, O extends string> {
  input: Record<T, string>;
  output?: Record<O, string>; // Optional for inference
}

interface Predict<T extends string, O extends string> {
  predict(input: Record<T, string>): Promise<Record<O, string>>;
  setExamples(examples: Example<T, O>[]): void;
}

// 3. Predictor: Processes inputs to outputs
class Predictor<T extends string, O extends string> implements Predict<T, O> {
  private signature: Signature<T, O>;
  private examples: Example<T, O>[] = [];
  private lm: (prompt: string) => Promise<string>;

  constructor(
    signature: Signature<T, O>,
    examples: Example<T, O>[] = [],
    lm: (prompt: string) => Promise<string> = callLm,
  ) {
    this.signature = signature;
    this.examples = examples;
    this.lm = lm;
  }

  // Generate a prompt with examples (few-shot) and input
  private createPrompt(input: Record<T, string>): string {
    // Format examples for few-shot learning
    const exampleStr = this.examples
      .map((ex) => {
        const inputStr = this.signature.inputs
          .map((field) => `${field}: ${ex.input[field]}`)
          .join(", ");
        const outputStr = ex.output
          ? this.signature.outputs
              .map((field) => `${field}: ${ex.output?.[field]}`)
              .join(", ")
          : "N/A";
        return `Input: ${inputStr}\nOutput: ${outputStr}`;
      })
      .join("\n---\n");

    // Format the current input
    const inputStr = this.signature.inputs
      .map((field) => `${field}: ${input[field]}`)
      .join(", ");

    // Construct the full prompt
    let prompt = `${this.signature.description}\n`;
    if (this.signature.instructions) {
      prompt += `Instructions: ${this.signature.instructions}\n`;
    }
    if (exampleStr) {
      prompt += `\nExamples:\n${exampleStr}\n---\n`;
    }
    prompt += `\nInput: ${inputStr}\nOutput:`;
    return prompt;
  }

  // Predict: Call LM and parse output
  async predict(input: Record<T, string>): Promise<Record<O, string>> {
    const prompt = this.createPrompt(input);

    const rawOutput = await this.lm(prompt);

    // Parse the output (assume it’s in "field: value" format)
    const result: Partial<Record<O, string>> = {};
    const outputLines = rawOutput.split("\n");
    for (const field of this.signature.outputs) {
      const line = outputLines.find((l) => l.startsWith(`${field}:`));
      result[field] = line ? line.split(`${field}: `)[1]?.trim() : "unknown";
    }
    return result as Record<O, string>;
  }

  // Update examples (used by compile)
  setExamples(examples: Example<T, O>[]) {
    this.examples = examples;
  }
}

// 4. ChainOfThought Predictor
class ChainOfThoughtPredictor<T extends string, O extends string>
  implements Predict<T, O>
{
  private signature: Signature<T, O>;
  private examples: Example<T, O>[] = [];
  private lm: (prompt: string) => Promise<string>;
  constructor(
    signature: Signature<T, O>,
    examples: Example<T, O>[] = [],
    lm: (prompt: string) => Promise<string> = callLm,
  ) {
    this.signature = signature;
    this.examples = examples;
    this.lm = lm;
  }
  private createPrompt(input: Record<T, string>): string {
    const exampleStr = this.examples
      .map((ex) => {
        const inputStr = this.signature.inputs
          .map((field) => `${field}: ${ex.input[field]}`)
          .join(", ");
        const outputStr = ex.output
          ? `Let's reason step-by-step:\n(Simulated reasoning)\nFinal answer: ${this.signature.outputs
              .map((field) => `${field}: ${ex.output?.[field]}`)
              .join(", ")}`
          : "N/A";
        return `Input: ${inputStr}\n${outputStr}`;
      })
      .join("\n---\n");

    const inputStr = this.signature.inputs
      .map((field) => `${field}: ${input[field]}`)
      .join(", ");

    let prompt = `${this.signature.description}\n`;
    if (this.signature.instructions) {
      prompt += `Instructions: ${this.signature.instructions}\n`;
    }
    prompt += `Provide your response in the following format:
Let's reason step-by-step:
1. [Step 1]
2. [Step 2]
...
Final answer: [Your answer]\n`;
    if (exampleStr) {
      prompt += `\nExamples:\n${exampleStr}\n---\n`;
    }
    prompt += `\nInput: ${inputStr}\n`;
    return prompt;
  }

  async predict(input: Record<T, string>): Promise<Record<O, string>> {
    const prompt = this.createPrompt(input);
    console.info("CoT Predictor Prompt:\n", prompt);
    const rawOutput = await this.lm(prompt);
    console.info("Raw Output:\n", rawOutput);

    // Parse the final answer from the CoT response
    const result: Partial<Record<O, string>> = {};
    const lines = rawOutput.split("\n");
    const finalAnswerLine = lines.find((line) =>
      line.startsWith("Final answer:"),
    );
    const finalAnswer = finalAnswerLine
      ? finalAnswerLine.replace("Final answer: ", "").trim()
      : "unknown";

    // Split final answer if multiple outputs (simplified parsing)
    const answerParts = finalAnswer.split(", ").reduce(
      (acc, part) => {
        const [key, value] = part.split(": ");
        if (key && value) {
          acc[key as O] = value;
        }
        return acc;
      },
      {} as Partial<Record<O, string>>,
    );

    for (const field of this.signature.outputs) {
      result[field] = answerParts[field] || finalAnswer || "unknown";
    }
    return result as Record<O, string>;
  }

  setExamples(examples: Example<T, O>[]) {
    this.examples = examples;
  }
}

interface Optimizer<T extends string, O extends string> {
  optimize: (
    examples: Example<T, O>[],
    maxExamples: number,
  ) => Promise<Example<T, O>[]>;
}

class BasicOptimizer<T extends string, O extends string>
  implements Optimizer<T, O>
{
  optimize(
    examples: Example<T, O>[],
    maxExamples: number,
  ): Promise<Example<T, O>[]> {
    const selectedExamples = examples
      .filter((ex) => ex.output !== undefined)
      .slice(0, maxExamples);

    return Promise.resolve(selectedExamples);
  }
}

// 4. BootstrapFewShot Optimizer
class BootstrapFewShot<T extends string, O extends string>
  implements Optimizer<T, O>
{
  private predictor: Predict<T, O>;
  private metric: (
    predicted: Record<O, string>,
    expected: Record<O, string>,
  ) => number;
  constructor(
    predictor: Predict<T, O>,
    metric: (
      predicted: Record<O, string>,
      expected: Record<O, string>,
    ) => number,
  ) {
    this.predictor = predictor;
    this.metric = metric;
  }

  // Score an example by predicting and comparing to expected output
  private async scoreExample(example: Example<T, O>): Promise<number> {
    if (!example.output) {
      return 0; // Can't score without expected output
    }
    const predicted = await this.predictor.predict(example.input);
    return this.metric(predicted, example.output);
  }

  // Bootstrap: Generate outputs for unlabeled examples
  private async bootstrapExamples(
    examples: Example<T, O>[],
  ): Promise<Example<T, O>[]> {
    const bootstrapped = await Promise.all(
      examples.map(async (ex) => {
        if (ex.output) {
          return ex; // Keep labeled examples
        }
        const predicted = await this.predictor.predict(ex.input);
        return { input: ex.input, output: predicted };
      }),
    );
    return bootstrapped;
  }

  async optimize(
    examples: Example<T, O>[],
    maxExamples = 2,
  ): Promise<Example<T, O>[]> {
    // Bootstrap unlabeled examples
    const allExamples = await this.bootstrapExamples(examples);

    // Score all examples (only those with original outputs are scored)
    const scoredExamples = (
      await Promise.all(
        allExamples.map(async (ex) => ({
          example: ex,
          score:
            ex.output && examples.some((e) => e === ex)
              ? await this.scoreExample(ex)
              : 0,
        })),
      )
    ).filter((se) => se.score > 0 || !examples.some((e) => e === se.example)); // Keep high-scoring or bootstrapped

    // Sort by score (descending) and take top maxExamples
    const selectedExamples = scoredExamples
      .sort((a, b) => b.score - a.score)
      .slice(0, maxExamples)
      .map((se) => se.example);

    return selectedExamples;
  }
}

// 5. Dynamic Prompt Analyzer
class PromptAnalyzer<I extends string, O extends string> {
  private signature: Signature<I, O>;

  constructor(signature: Signature<I, O>) {
    this.signature = signature;
  }

  analyzeExamples(examples: Example<I, O>[]): void {
    const labeledExamples = examples.filter((ex) => ex.output !== undefined);
    if (labeledExamples.length === 0) {
      return;
    }

    // Pattern 1: Output length (conciseness)
    const avgAnswerLength =
      labeledExamples
        .map((ex) => (ex.output as any).answer.toString().length)
        .reduce((sum, len) => sum + len, 0) / labeledExamples.length;
    const isConcise = avgAnswerLength < 5; // Arbitrary threshold (e.g., "7" vs. "seven")

    // Pattern 2: Input complexity (e.g., operation type)
    const operations = labeledExamples.map((ex) =>
      (ex.input as any).problem.toLowerCase(),
    );
    const allAddition = operations.every((op) => op.includes("add"));

    // Update Signature
    this.signature.description = allAddition
      ? "Solve the given addition problem."
      : "Solve the given math problem.";
    this.signature.instructions = isConcise
      ? "Use clear reasoning and provide a concise answer."
      : "Use clear reasoning and explain each step fully.";
  }
}

export class EnhancedPromptAnalyzer<I extends string, O extends string> {
  private signature: Signature<I, O>;

  constructor(signature: Signature<I, O>) {
    this.signature = signature;
  }

  analyzeExamples(examples: Example<I, O>[]): void {
    const labeledExamples = examples.filter((ex) => ex.output !== undefined);
    if (labeledExamples.length === 0) {
      return;
    }

    // Detect output format patterns
    const formatType = this.detectOutputFormat(labeledExamples);
    this.updateFormatInstructions(formatType);
  }

  private detectOutputFormat(
    examples: Example<I, O>[],
  ): "json" | "list" | "keyvalue" | "freeform" {
    const outputs = examples.map((ex) => ex.output![this.signature.outputs[0]]);

    // Check for JSON
    if (outputs.some((o) => o?.trim().startsWith("{"))) {
      return "json";
    }

    // Check for lists (bullets, commas)
    if (outputs.some((o) => o?.includes("\n- ") || o?.match(/, |;/))) {
      return "list";
    }

    // Check for key-value pairs
    if (outputs.some((o) => o?.includes(": ") && o.split(": ").length > 1)) {
      return "keyvalue";
    }

    return "freeform";
  }

  private updateFormatInstructions(formatType: string): void {
    const formatInstruction = {
      json: "Format your response as valid JSON.",
      list: "Present items in a bulleted list.",
      keyvalue: "Use 'key: value' format for each piece of information.",
      freeform: "",
    }[formatType];

    if (formatInstruction) {
      this.signature.instructions = [
        this.signature.instructions,
        formatInstruction,
      ]
        .filter(Boolean)
        .join(" ");
    }
  }
}

export class TaskAwarePromptAnalyzer<I extends string, O extends string> {
  private signature: Signature<I, O>;

  constructor(signature: Signature<I, O>) {
    this.signature = signature;
  }

  analyzeExamples(examples: Example<I, O>[]): void {
    const labeledExamples = examples.filter((ex) => ex.output !== undefined);
    if (labeledExamples.length === 0) {
      return;
    }

    // Detect task type
    const taskType = this.inferTaskType(labeledExamples);
    this.updateTaskMetadata(taskType);
  }

  private inferTaskType(
    examples: Example<I, O>[],
  ): "qa" | "classification" | "math" | "generation" {
    const firstOutput = examples[0].output![this.signature.outputs[0]];

    // Math: Numeric answers
    if (
      examples.every(
        (ex) => !Number.isNaN(Number(ex.output![this.signature.outputs[0]])),
      )
    ) {
      return "math";
    }

    // Classification: Limited discrete outputs
    const uniqueOutputs = new Set(
      examples.map((ex) => ex.output![this.signature.outputs[0]].toLowerCase()),
    );
    if (uniqueOutputs.size <= 5) {
      return "classification";
    }

    // QA: Short answers to questions
    if (
      this.signature.inputs.includes("question" as I) &&
      firstOutput.length < 50
    ) {
      return "qa";
    }

    return "generation";
  }

  private updateTaskMetadata(taskType: string): void {
    const taskMetadata = {
      qa: { verb: "Answer", style: "concise" },
      classification: { verb: "Classify", style: "select from options" },
      math: { verb: "Solve", style: "show calculations" },
      generation: { verb: "Generate", style: "detailed" },
    }[taskType];

    if (taskMetadata) {
      this.signature.description = `${taskMetadata.verb} the given ${taskType} problem.`;
      this.signature.instructions = `Use ${taskMetadata.style} in your response.`;
    }
  }
}
// 4. DSPyProgram: Manages the workflow
class Program<T extends string, O extends string> {
  private predictor: Predict<T, O>;
  private optimizer: Optimizer<T, O>;
  private examples: Example<T, O>[] = [];

  constructor(predictor: Predict<T, O>, optimizer = new BasicOptimizer()) {
    this.predictor = predictor;
    this.optimizer = optimizer;
  }

  // Add training examples
  addExample(example: Example<T, O>) {
    this.examples.push(example);
  }

  // Forward pass (inference)
  forward(input: Record<T, string>): Promise<Record<O, string>> {
    return this.predictor.predict(input);
  }

  // Compile: Optimize by selecting examples for few-shot prompting
  async compile(maxExamples = 2) {
    const selectedExamples = await this.optimizer.optimize(
      this.examples,
      maxExamples,
    );

    if (selectedExamples.length === 0) {
      console.warn("No examples with outputs available for optimization.");
      return;
    }

    // Update predictor with selected examples
    this.predictor.setExamples(selectedExamples);
  }
}

// Usage example: Question -> Answer task
type QaInput = { question: string };
type QaOutput = { answer: string };

const qaSignature: Signature<keyof QaInput, keyof QaOutput> = {
  inputs: ["question"],
  outputs: ["answer"],
  description: "Given a question, provide a concise answer.",
  instructions: "Answer directly and avoid extra commentary.",
};

// Create a program
const qaProgram = new Program<keyof QaInput, keyof QaOutput>(
  new Predictor(qaSignature),
);

// Add examples
qaProgram.addExample({
  input: { question: "What is TypeScript?" },
  output: { answer: "A typed superset of JavaScript." },
});
qaProgram.addExample({
  input: { question: "What is Python?" },
  output: { answer: "A high-level programming language." },
});

// Compile: Use examples to improve predictions
await qaProgram.compile(1); // Use 1 example for few-shot

// Run inference
const result = await qaProgram.forward({ question: "What is DSPy?" });
console.info("Final Result:", result);

// Usage example: Math problem
type MathInput = { problem: string };
type MathOutput = { answer: string };

const mathSignature: Signature<keyof MathInput, keyof MathOutput> = {
  inputs: ["problem"],
  outputs: ["answer"],
  description: "Solve the given math problem.",
  instructions: "Use clear reasoning to arrive at the answer.",
};

// Create programs:
function accuracyMetric(predicted: MathOutput, expected: MathOutput): number {
  const predAnswer = predicted.answer;
  const expAnswer = expected.answer;
  return predAnswer === expAnswer ? 1 : 0;
}
const analyzer = new PromptAnalyzer(mathSignature);
analyzer.analyzeExamples([
  {
    input: { problem: "Add 1 and 2" },
    output: { answer: "3" },
  },
]);

const predictor = new Predictor(mathSignature);
const basicProgram = new Program<keyof MathInput, keyof MathOutput>(
  predictor,
  new BootstrapFewShot(predictor, accuracyMetric),
);
const cotPredictor = new ChainOfThoughtPredictor(mathSignature);
const cotProgram = new Program<keyof MathInput, keyof MathOutput>(
  cotPredictor,
  new BootstrapFewShot(cotPredictor, accuracyMetric),
);

// Add examples
cotProgram.addExample({
  input: { problem: "Add 1 and 2" },
  output: { answer: "3" },
});
cotProgram.addExample({
  input: { problem: "Add 5 and 6" },
  output: { answer: "11" },
});
cotProgram.addExample({
  input: { problem: "Add 7 and 8" }, // Unlabeled
});
cotProgram.addExample({
  input: { problem: "Add 2 and 5" },
});

// Compile both
await basicProgram.compile(1);
await cotProgram.compile(1);

// Test both
console.info("\nBasic Predictor Result:");
const basicResult = await basicProgram.forward({ problem: "Add 3 and 4" });
console.info("Result:", basicResult);

console.info("\nChainOfThought Predictor Result:");
const cotResult = await cotProgram.forward({ problem: "Add 3 and 4" });
console.info("Result:", cotResult);
