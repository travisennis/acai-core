import { tool } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { bigMindMapping } from "../brainstorm/bigMindMapping.ts";
import { brainstorm } from "../brainstorm/index.ts";
import { reverseBrainstorming } from "../brainstorm/reverseBrainstorming.ts";
import { roleStorming } from "../brainstorm/roleStorming.ts";
import { scamper } from "../brainstorm/scamper.ts";
import { sixHats } from "../brainstorm/sixHats.ts";
import { starbursting } from "../brainstorm/starBursting.ts";
import type { SendData } from "./types.ts";

export const createBrainstormingTools = (
  model: LanguageModel,
  { sendData }: { sendData?: SendData } = {},
) => {
  return {
    listBrainStormingStrategies: tool({
      description:
        "Returns a comma-separated list of the supported brainstorming strategies",
      parameters: z.object({}),
      execute: () => {
        sendData?.({
          event: "tool-init",
          data: "Listing available brainstorming strategies",
        });
        return Promise.resolve(
          "bigMindMapping, reverseBrainstorming, roleStorming, scamper, sixHats, starbursting",
        );
      },
    }),

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
        sendData?.({
          event: "tool-init",
          data: `Starting Big Mind Mapping analysis for: ${idea}`,
        });
        try {
          const result = await brainstorm({
            model,
            query: idea,
            strategy: bigMindMapping,
            n,
          });
          return result;
        } catch (error) {
          const errorMessage = `Error in big mind mapping: ${(error as Error).message}`;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });
          return errorMessage;
        }
      },
    }),

    reverseBrainstorming: tool({
      description:
        "Generate ideas using Reverse Brainstorming, which identifies potential problems and challenges an idea may encounter",
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
        sendData?.({
          event: "tool-init",
          data: `Starting Reverse Brainstorming analysis for: ${idea}`,
        });
        try {
          const result = await brainstorm({
            model,
            query: idea,
            strategy: reverseBrainstorming,
            n,
          });
          return result;
        } catch (error) {
          const errorMessage = `Error in reverse brainstorming: ${(error as Error).message}`;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });
          return errorMessage;
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
        n: z
          .number()
          .optional()
          .describe("Number of initial ideas to generate (default: 5)"),
      }),
      execute: async ({ idea, n }) => {
        sendData?.({
          event: "tool-init",
          data: `Starting Role Storming analysis for: ${idea}`,
        });
        try {
          const result = await brainstorm({
            model,
            query: idea,
            strategy: roleStorming,
            n,
          });
          return result;
        } catch (error) {
          const errorMessage = `Error in role storming: ${(error as Error).message}`;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });
          return errorMessage;
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
        n: z
          .number()
          .optional()
          .describe("Number of initial ideas to generate (default: 5)"),
      }),
      execute: async ({ idea, n }) => {
        sendData?.({
          event: "tool-init",
          data: `Starting SCAMPER analysis for: ${idea}`,
        });
        try {
          const result = await brainstorm({
            model,
            query: idea,
            strategy: scamper,
            n,
          });
          return result;
        } catch (error) {
          const errorMessage = `Error in SCAMPER analysis: ${(error as Error).message}`;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });
          return errorMessage;
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
        n: z
          .number()
          .optional()
          .describe("Number of initial ideas to generate (default: 5)"),
      }),
      execute: async ({ idea, n }) => {
        sendData?.({
          event: "tool-init",
          data: `Starting Six Thinking Hats analysis for: ${idea}`,
        });
        try {
          const result = await brainstorm({
            model,
            query: idea,
            strategy: sixHats,
            n,
          });
          return result;
        } catch (error) {
          const errorMessage = `Error in Six Hats analysis: ${(error as Error).message}`;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });
          return errorMessage;
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
        n: z
          .number()
          .optional()
          .describe("Number of initial ideas to generate (default: 5)"),
      }),
      execute: async ({ idea, n }) => {
        sendData?.({
          event: "tool-init",
          data: `Starting Starbursting analysis for: ${idea}`,
        });
        try {
          const result = await brainstorm({
            model,
            query: idea,
            strategy: starbursting,
            n,
          });
          return result;
        } catch (error) {
          const errorMessage = `Error in Starbursting analysis: ${(error as Error).message}`;
          sendData?.({
            event: "tool-error",
            data: errorMessage,
          });
          return errorMessage;
        }
      },
    }),
  };
};
