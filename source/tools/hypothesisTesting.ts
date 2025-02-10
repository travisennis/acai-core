import { tool } from "ai";
import { z } from "zod";
import type { SendData } from "./types.ts";

interface HypothesisData {
  hypothesis: string;
  testCase: string;
  result?: string;
  testNumber: number;
  totalTests: number;
  status: "pending" | "confirmed" | "refuted" | "revised";
  revisedHypothesis?: string;
}

class HypothesisTestingManager {
  private testHistory: HypothesisData[] = [];
  private sendData?: SendData;

  constructor(sendData?: SendData) {
    this.sendData = sendData;
  }

  private validateTestData(input: unknown): HypothesisData {
    const data = input as Record<string, unknown>;

    if (!data.hypothesis || typeof data.hypothesis !== "string") {
      throw new Error("Invalid hypothesis: must be a string");
    }
    if (!data.testCase || typeof data.testCase !== "string") {
      throw new Error("Invalid testCase: must be a string");
    }
    if (!data.testNumber || typeof data.testNumber !== "number") {
      throw new Error("Invalid testNumber: must be a number");
    }
    if (!data.totalTests || typeof data.totalTests !== "number") {
      throw new Error("Invalid totalTests: must be a number");
    }
    if (
      !["pending", "confirmed", "refuted", "revised"].includes(
        data.status as string,
      )
    ) {
      throw new Error("Invalid status");
    }

    return {
      hypothesis: data.hypothesis as string,
      testCase: data.testCase as string,
      result: data.result as string | undefined,
      testNumber: data.testNumber as number,
      totalTests: data.totalTests as number,
      status: data.status as "pending" | "confirmed" | "refuted" | "revised",
      revisedHypothesis: data.revisedHypothesis as string | undefined,
    };
  }

  private formatTest(testData: HypothesisData): string {
    const {
      testNumber,
      totalTests,
      hypothesis,
      testCase,
      result,
      status,
      revisedHypothesis,
    } = testData;

    let statusLabel = "🧪 Test Pending";
    if (status === "confirmed") statusLabel = "✅ Confirmed";
    if (status === "refuted") statusLabel = "❌ Refuted";
    if (status === "revised") statusLabel = "🔄 Revised";

    const header = `${statusLabel} ${testNumber}/${totalTests}`;
    const content = [
      `🔍 Hypothesis: "${hypothesis}"`,
      `🔬 Test Case: "${testCase}"`,
      ...(result ? [`📖 Result: ${result}`] : []),
      ...(revisedHypothesis
        ? [`🔄 Revised Hypothesis: "${revisedHypothesis}"`]
        : []),
    ].join("\n");

    const maxLength = Math.max(
      header.length,
      ...content.split("\n").map((line) => line.length),
    );
    const border = "─".repeat(maxLength + 2);

    return `
┌${border}┐
│ ${header.padEnd(maxLength)} │
├${border}┤
${content
  .split("\n")
  .map((line) => `│ ${line.padEnd(maxLength)} │`)
  .join("\n")}
└${border}┘`;
  }

  processTest(input: unknown): string {
    try {
      this.sendData?.({
        event: "tool-init",
        data: "Processing new test",
      });

      const validatedInput = this.validateTestData(input);

      if (validatedInput.testNumber > validatedInput.totalTests) {
        validatedInput.totalTests = validatedInput.testNumber;
      }

      this.testHistory.push(validatedInput);

      const formattedTest = this.formatTest(validatedInput);
      console.error(formattedTest);

      this.sendData?.({
        event: "tool-completion",
        data: `Processed test ${validatedInput.testNumber}/${validatedInput.totalTests}`,
      });

      return JSON.stringify(
        {
          testNumber: validatedInput.testNumber,
          totalTests: validatedInput.totalTests,
          status: validatedInput.status,
          revisedHypothesis: validatedInput.revisedHypothesis,
          testHistoryLength: this.testHistory.length,
        },
        null,
        2,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.sendData?.({
        event: "tool-error",
        data: `Error processing test: ${errorMessage}`,
      });
      throw new Error(errorMessage);
    }
  }
}

export const createHypothesisTestingTool = ({
  sendData,
}: {
  sendData?: SendData;
} = {}) => {
  const manager = new HypothesisTestingManager(sendData);

  return {
    hypothesisTesting: tool({
      description: `A structured tool for hypothesis-driven reasoning.
This tool helps validate ideas by requiring explicit test cases, tracking results, and refining hypotheses.

When to use this tool:
- Debugging code by formulating testable assumptions
- Evaluating scientific hypotheses step by step
- Checking assumptions in problem-solving scenarios
- Structuring multi-step validation processes
- Refining theories when new evidence emerges

Key features:
- Hypotheses are tested in structured steps
- Each step is logged, forcing iterative refinement
- Tests can confirm, refute, or modify hypotheses
- Supports step-by-step debugging and hypothesis refinement`,
      parameters: z.object({
        hypothesis: z.string().describe("The assumption being tested"),
        testCase: z
          .string()
          .describe("A specific test to verify or falsify the hypothesis"),
        result: z.string().optional().describe("The test outcome"),
        testNumber: z.number().int().min(1).describe("Current test number"),
        totalTests: z
          .number()
          .int()
          .min(1)
          .describe("Estimated total tests needed"),
        status: z
          .enum(["pending", "confirmed", "refuted", "revised"])
          .describe("Test status"),
        revisedHypothesis: z
          .string()
          .optional()
          .describe("The revised hypothesis if applicable"),
      }),
      execute: (params) => {
        try {
          return Promise.resolve(manager.processTest(params));
        } catch (error) {
          const errorMessage = `Error processing test: ${(error as Error).message}`;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });
          return Promise.resolve(errorMessage);
        }
      },
    }),
  };
};
