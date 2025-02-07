import { tool } from "ai";
import { exec } from "node:child_process";
import { z } from "zod";

export const createCodeTools = ({ baseDir }: { baseDir: string }) => {
  return {
    buildCode: tool({
      description:
        "Executes the build command for the current code base and returns the output.",
      parameters: z.object({}),
      execute: async () => {
        const config = await readProjectConfig();
        const buildCommand = config.build || "npm run build";
        try {
          return asyncExec(buildCommand, baseDir);
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
        const config = await readProjectConfig();
        const lintCommand = config.lint || "npm run lint";
        try {
          return asyncExec(lintCommand, baseDir);
        } catch (error) {
          return `Failed to execute lint command: ${(error as Error).message}`;
        }
      },
    }),
    formatCode: tool({
      description:
        "Executes the 'format' command on the current code base and returns the results. This reports style and formatting issues with the code base",
      parameters: z.object({}),
      execute: async () => {
        const config = await readProjectConfig();
        const formatCommand = config.format || "npm run format";
        try {
          return asyncExec(formatCommand, baseDir);
        } catch (error) {
          return `Failed to execute format command: ${(error as Error).message}`;
        }
      },
    }),
  };
};

function readProjectConfig(): Promise<any> {
  return Promise.resolve({});
}

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
