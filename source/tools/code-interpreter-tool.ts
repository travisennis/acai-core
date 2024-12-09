import * as _crypto from "node:crypto";
import * as _fs from "node:fs";
import * as _http from "node:http";
import * as _https from "node:https";
import * as _os from "node:os";
import * as _process from "node:process";
import { runInNewContext } from "node:vm";
import { tool } from "ai";
import { z } from "zod";

export enum InterpreterPermission {
  FS = "node:fs",
  NET = "net",
  OS = "os",
  CRYPTO = "crypto",
  PROCESS = "process",
}

function codeInterpreterJavascript(
  code: string,
  permissions: readonly InterpreterPermission[],
) {
  const context: { [key: string]: unknown } = { console };

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
    } else {
      return `Error: ${err}`;
    }
  }
}

export function initTool({
  permissions = [],
}:
  | Readonly<{ permissions?: readonly InterpreterPermission[] }>
  | undefined = {}) {
  return tool({
    description:
      "When you send a message containing javascript code to javascript, it will be executed in a node:vm environment. javascript will respond with the output of the execution or time out after 120.0 seconds. Internet access for this session is disabled. Do not make external web requests or API calls as they will fail.",
    parameters: z.object({
      code: z.string().describe("Javascript code to be exectued."),
    }),
    execute: ({ code }) => {
      return codeInterpreterJavascript(code, permissions ?? []);
    },
  });
}
