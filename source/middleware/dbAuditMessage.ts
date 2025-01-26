import Database from "better-sqlite3";
import type {
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
} from "ai";

const initializeDatabase = (dbPath: string): Database.Database => {
  const db = new Database(dbPath);

  // Create the messages table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
};

export const dbAuditMessage = ({ dbPath }: { dbPath: string }) => {
  let db: Database.Database;

  try {
    db = initializeDatabase(dbPath);
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }

  const insertMessage = (model: string, prompt: string, response: string) => {
    const stmt = db.prepare(
      "INSERT INTO model_messages (model, prompt, response) VALUES (?, ?, ?)",
    );
    stmt.run(model, prompt, response);
  };

  const middleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      try {
        const result = await doGenerate();

        insertMessage(
          model.provider,
          JSON.stringify(params.prompt),
          result.text ?? "",
        );

        return result;
      } catch (error) {
        console.error("Error in wrapGenerate middleware:", error);
        throw error;
      }
    },

    wrapStream: async ({ doStream, params, model }) => {
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
              model.provider,
              JSON.stringify(params.prompt),
              generatedText,
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
