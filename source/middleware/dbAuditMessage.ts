import type {
  CoreMessage,
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
} from "ai";
import Database from "better-sqlite3";

const initializeDatabase = (dbPath: string): Database.Database => {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");

  // Create the messages table if it doesn't exist
  db.exec(`
  CREATE TABLE IF NOT EXISTS model_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    messages JSON NOT NULL,
    duration INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
  return db;
};

export const dbAuditMessage = ({ dbPath }: { dbPath: string }) => {
  let db: Database.Database;
  let insertStmt: Database.Statement;

  try {
    db = initializeDatabase(dbPath);
    // Prepare statement once during initialization
    insertStmt = db.prepare(
      "INSERT INTO model_messages (model, messages, duration) VALUES (?, json(?), ?)",
    );

    // Setup cleanup on process exit
    process.on("exit", () => {
      try {
        db.close();
      } catch (error) {
        console.error("Error closing database:", error);
      }
    });
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }

  const insertMessage = (
    model: string,
    prompt: unknown,
    response: string,
    duration: number,
  ) => {
    try {
      (prompt as CoreMessage[]).push({ role: "assistant", content: response });
      // No need to stringify prompt - let SQLite handle it
      insertStmt.run(model, JSON.stringify(prompt), duration);
    } catch (error) {
      console.error("Error inserting message:", error);
      throw error;
    }
  };

  const middleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      console.info("db audit message middleware");
      try {
        const startTime = performance.now();
        const result = await doGenerate();

        insertMessage(
          model.modelId,
          params.prompt, // Pass the raw prompt object
          result.text ?? "",
          performance.now() - startTime,
        );

        return result;
      } catch (error) {
        console.error("Error in wrapGenerate middleware:", error);
        throw error;
      }
    },

    wrapStream: async ({ doStream, params, model }) => {
      const startTime = performance.now();
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

        flush() {
          try {
            insertMessage(
              model.modelId,
              params.prompt, // Pass the raw prompt object
              generatedText,
              performance.now() - startTime,
            );
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
