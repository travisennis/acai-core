import fs from "node:fs";
import path from "node:path";
import type {
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
} from "ai";

const checkAndRolloverFile = async (filePath: string): Promise<void> => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return;
    }

    // Read the file content
    const content = await fs.promises.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");

    // If less than 50 lines, no need to rollover
    if (lines.length < 50) {
      return;
    }

    // Get the directory and base filename
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const basePattern = baseName.replace(/-\d+$/, ""); // Remove any existing number

    // Find existing rollover files to determine next number
    const files = await fs.promises.readdir(dir);
    const rolloverFiles = files
      .filter((f) => f.startsWith(`${basePattern}-`) && f.endsWith(ext))
      .map((f) => {
        const match = f.match(new RegExp(`${basePattern}-(\\d+)${ext}`));
        return match ? Number.parseInt(match[1]) : 0;
      });

    const nextNumber =
      rolloverFiles.length > 0 ? Math.max(...rolloverFiles) + 1 : 1;
    const newPath = path.join(dir, `${basePattern}-${nextNumber}${ext}`);

    // Rename the current file
    await fs.promises.rename(filePath, newPath);
  } catch (error) {
    console.error("Error during file rollover:", error);
    throw error; // Re-throw to be handled by the caller
  }
};

const appendToFile = async (
  filePath: string,
  content: string,
): Promise<void> => {
  try {
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await checkAndRolloverFile(filePath);
    await fs.promises.appendFile(filePath, `${content}\n`);
  } catch (error) {
    console.error("Error writing to audit file:", error);
    throw error;
  }
};

export const auditMessage = ({ path = "messages.jsonl" }: { path: string }) => {
  const middleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        const result = await doGenerate();

        const msg = {
          prompt: params.prompt,
          response: result.text,
        };

        await appendToFile(path, JSON.stringify(msg));

        return result;
      } catch (error) {
        console.error("Error in wrapGenerate middleware:", error);
        throw error;
      }
    },

    wrapStream: async ({ doStream, params }) => {
      const { stream, ...rest } = await doStream();

      let generatedText = "";

      const transformStream = new TransformStream<
        LanguageModelV1StreamPart,
        LanguageModelV1StreamPart
      >({
        transform(chunk, controller) {
          if (chunk.type === "text-delta") {
            generatedText += chunk.textDelta;
          }

          controller.enqueue(chunk);
        },

        async flush() {
          try {
            const msg = {
              prompt: params.prompt,
              response: generatedText,
            };

            await appendToFile(path, JSON.stringify(msg));
          } catch (error) {
            console.error("Error in transform stream flush:", error);
            throw error;
          }
        },
      });

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },
  };
  return middleware;
};
