import { exec } from "node:child_process";
import { tool } from "ai";
import { z } from "zod";
import type { SendData } from "./types.ts";

export interface Config {
  build: string | undefined;
  lint: string | undefined;
  format: string | undefined;
  test: string | undefined;
}

export const createCodeTools = ({
  baseDir,
  config,
  sendData,
}: { baseDir: string; config?: Config; sendData?: SendData }) => {
  return {
    buildCode: tool({
      description:
        "Executes the build command for the current code base and returns the output.",
      parameters: z.object({}),
      execute: async () => {
        const buildCommand = config?.build || "npm run build";
        if (sendData) {
          sendData({
            event: "tool-init",
            data: `Building code in ${baseDir}`,
          });
        }
        try {
          return await asyncExec(buildCommand, baseDir);
        } catch (error) {
          return `Failed to execute build command: ${(error as Error).message}`;
        }
      },
    }),
    lintCode: tool({
      description:
        "Lints the current code base and returns the results. This tool helps identify and report potential issues, style violations, or errors in the code, improving code quality and consistency.",
      parameters: z.object({}),
      execute: async () => {
        if (sendData) {
          sendData({
            event: "tool-init",
            data: `Linting code in ${baseDir}`,
          });
        }
        const lintCommand = config?.lint || "npm run lint";
        try {
          return await asyncExec(lintCommand, baseDir);
        } catch (error) {
          return `Failed to execute lint command: ${(error as Error).message}`;
        }
      },
    }),
    formatCode: tool({
      description:
        "Executes the 'format' command on the current code base and returns the results. This reports style and formatting issues with the code base.",
      parameters: z.object({}),
      execute: async () => {
        if (sendData) {
          sendData({
            event: "tool-init",
            data: `Formatting code in ${baseDir}`,
          });
        }
        const formatCommand = config?.format || "npm run format";
        try {
          return await asyncExec(formatCommand, baseDir);
        } catch (error) {
          return `Failed to execute format command: ${(error as Error).message}`;
        }
      },
    }),
    testCode: tool({
      description:
        "Executes the 'test' command on the current code base to run unit tests and return the results.",
      parameters: z.object({}),
      execute: async () => {
        if (sendData) {
          sendData({
            event: "tool-init",
            data: `Running unit tests in ${baseDir}`,
          });
        }
        const testCommand = config?.test || "npm run test";
        try {
          return await asyncExec(testCommand, baseDir);
        } catch (error) {
          return `Failed to execute test command: ${(error as Error).message}`;
        }
      },
    }),
  };
};

function asyncExec(command: string, cwd: string): Promise<string> {
  console.info(`Running ${command} in ${cwd}`);
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  exec(command, { cwd }, (error, stdout, stderr) => {
    if (error) {
      resolve(`Command ${command} execution in ${cwd}: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Command ${command} stderr ${cwd}: ${stderr}`);
      reject(stderr);
    }
    resolve(stdout);
  });
  return promise;
}
