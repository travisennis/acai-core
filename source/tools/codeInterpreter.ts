import { tool } from "ai";
import { z } from "zod";
import * as _crypto from "node:crypto";
import * as _fs from "node:fs";
import * as _http from "node:http";
import * as _https from "node:https";
import * as _os from "node:os";
import * as _process from "node:process";
import { runInNewContext } from "node:vm";

export enum InterpreterPermission {
  FS = "fs",
  NET = "net",
  OS = "os",
  CRYPTO = "crypto",
  PROCESS = "process",
}

function codeInterpreterJavascript(
  code: string,
  permissions: readonly InterpreterPermission[],
) {
  const context: Record<string, any> = { console };

  if (permissions.includes(InterpreterPermission.FS)) {
    context.fs = _fs;
  }
  if (permissions.includes(InterpreterPermission.NET)) {
    context.http = _http;
    context.https = _https;
  }
  if (permissions.includes(InterpreterPermission.OS)) {
    context.os = _os;
  }
  if (permissions.includes(InterpreterPermission.CRYPTO)) {
    context.crypto = _crypto;
  }
  if (permissions.includes(InterpreterPermission.PROCESS)) {
    context.process = _process;
  }

  const options = { timeout: 120 * 1000 }; // Timeout in milliseconds

  try {
    return runInNewContext(`(function() { ${code} })()`, context, options);
  } catch (err) {
    if ((err as Error).name === "TimeoutError") {
      return "Script timed out";
    }
    return `Error: ${err}`;
  }
}

export const createCodeInterpreterTool = ({
  permissions = [],
}: Readonly<{
  permissions?: readonly InterpreterPermission[];
}>) => {
  return {
    codeInterpreter: tool({
      description:
        "Executes Javascript code. The code will be executed in a node:vm environment. This tool will respond with the output of the execution or time out after 120.0 seconds. In order to return a result from running this code, use a return statement. Do not use console.log. The code will run inside of self-executing anonymous function: `(function() { ${code} })()` Internet access for this session is disabled. Do not make external web requests or API calls as they will fail. Fileystem access for this vm is disabled. Do not make filesystem calls as they will fail.",
      parameters: z.object({
        code: z.string().describe("Javascript code to be executed."),
      }),
      execute: ({ code }: { code: string }) => {
        return codeInterpreterJavascript(code, permissions ?? []);
      },
    }),
  };
};
