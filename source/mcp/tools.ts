import { type CoreTool, jsonSchema, tool } from "ai";

export function convertTools(
  tools: {
    tools: { name: string; description: string; inputSchema: any }[];
  },
  toolCallFn: (args: any) => Promise<any>,
) {
  return tools.tools.reduce<Record<string, CoreTool<any, any>>>(
    (prev, toolDef) => {
      prev[toolDef.name] = tool({
        description: toolDef.description,
        parameters: jsonSchema(toolDef.inputSchema),
        execute: (args: any) => {
          return toolCallFn({
            name: toolDef.name,
            arguments: args,
          });
        },
      });
      return prev;
    },
    {},
  );
}
