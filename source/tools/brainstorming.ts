import { tool } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { bigMindMapping } from "../brainstorm/bigMindMapping.ts";
import { reverseBrainstorming } from "../brainstorm/reverseBrainstorming.ts";
import { roleStorming } from "../brainstorm/roleStorming.ts";
import { scamper } from "../brainstorm/scamper.ts";
import { sixHats } from "../brainstorm/sixHats.ts";
import { starbursting } from "../brainstorm/starBursting.ts";
import type { TreeNode } from "../brainstorm/utils.ts";

export const createBrainstormingTools = (model: LanguageModel) => {
  return {
    bigMindMapping: tool({
      description:
        "Generate ideas using the Big Mind Mapping technique, which expands one idea into multiple related ideas and then further expands those ideas",
      parameters: z.object({
        idea: z.string().describe("The initial idea to expand upon"),
        n: z
          .number()
          .optional()
          .describe("Number of ideas to generate at each level (default: 5)"),
      }),
      execute: async ({ idea, n }) => {
        try {
          const result: TreeNode = await bigMindMapping({ model, idea, n });
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error in big mind mapping: ${(error as Error).message}`;
        }
      },
    }),

    reverseBrainstorming: tool({
      description:
        "Generate ideas using Reverse Brainstorming, which identifies potential problems or challenges an idea may encounter",
      parameters: z.object({
        idea: z
          .string()
          .describe("The initial idea to analyze for potential problems"),
        n: z
          .number()
          .optional()
          .describe("Number of problems to identify (default: 5)"),
      }),
      execute: async ({ idea, n }) => {
        try {
          const result: TreeNode = await reverseBrainstorming({
            model,
            idea,
            n,
          });
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error in reverse brainstorming: ${(error as Error).message}`;
        }
      },
    }),

    roleStorming: tool({
      description:
        "Generate ideas using Role Storming, which adopts various personas (Positive, Negative, Child, Analyst, Futurist) to generate diverse perspectives",
      parameters: z.object({
        idea: z
          .string()
          .describe(
            "The topic to brainstorm from different personas' perspectives",
          ),
      }),
      execute: async ({ idea }) => {
        try {
          const result: TreeNode = await roleStorming({ model, idea });
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error in role storming: ${(error as Error).message}`;
        }
      },
    }),

    scamper: tool({
      description:
        "Generate ideas using the SCAMPER method (Substitute, Combine, Adjust, Modify, Put to other uses, Eliminate, Reverse)",
      parameters: z.object({
        idea: z
          .string()
          .describe("The topic to analyze using the SCAMPER framework"),
      }),
      execute: async ({ idea }) => {
        try {
          const result: TreeNode = await scamper({ model, idea });
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error in SCAMPER analysis: ${(error as Error).message}`;
        }
      },
    }),

    sixHats: tool({
      description:
        "Analyze an idea using Six Thinking Hats method, examining it from six perspectives (White/facts, Red/emotions, Black/risks, Yellow/benefits, Green/creativity, Blue/process)",
      parameters: z.object({
        idea: z
          .string()
          .describe("The topic to analyze using the Six Thinking Hats method"),
      }),
      execute: async ({ idea }) => {
        try {
          const result: TreeNode = await sixHats({ model, idea });
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error in Six Hats analysis: ${(error as Error).message}`;
        }
      },
    }),

    starbursting: tool({
      description:
        "Generate questions and answers using the Starbursting method, which explores a topic through the 5 W's and 1 H (Who, What, Where, When, Why, How)",
      parameters: z.object({
        idea: z
          .string()
          .describe("The topic to explore using the Starbursting method"),
      }),
      execute: async ({ idea }) => {
        try {
          const result: TreeNode = await starbursting({ model, idea });
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error in Starbursting analysis: ${(error as Error).message}`;
        }
      },
    }),
  };
};
