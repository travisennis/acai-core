import type { CoreMessage } from "ai";
import Database from "better-sqlite3";

export interface Interaction {
  id: number;
  model: string;
  messages: CoreMessage[];
  temperature: number;
  maxTokens: number;
  duration: number;
  promptTokens: number;
  completionTokens: number;
  timestamp: string;
}

export interface StoredInteraction {
  id: number;
  model: string;
  messages: string;
  temperature: number;
  maxTokens: number;
  duration: number;
  promptTokens: number;
  completionTokens: number;
  timestamp: string;
}

export function isStoredInteraction(obj: unknown): obj is StoredInteraction {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    typeof (obj as StoredInteraction).id === "number" &&
    "model" in obj &&
    typeof (obj as StoredInteraction).model === "string" &&
    "messages" in obj &&
    typeof (obj as StoredInteraction).messages === "string" &&
    "timestamp" in obj &&
    typeof (obj as StoredInteraction).timestamp === "string"
  );
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const createTable = `
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  temperature REAL NOT NULL,
  maxTokens INTEGER NOT NULL,
  messages JSON NOT NULL,
  duration INTEGER NOT NULL,
  promptTokens INTEGER NOT NULL,
  completionTokens INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interactions_model ON interactions(model);
CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_interactions_model_timestamp ON interactions(model, timestamp)`;

export class InteractionStorage {
  private db: Database.Database;
  private insertStmt: Database.Statement;
  private getByIdStmt: Database.Statement;
  private getAllStmt: Database.Statement;
  private getCountStmt: Database.Statement;
  private getByModelStmt: Database.Statement;
  private getByDateRangeStmt: Database.Statement;
  private getModelCountStmt: Database.Statement;
  private getDateRangeCountStmt: Database.Statement;
  private searchStmt: Database.Statement;
  private searchCountStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    // Create the messages table if it doesn't exist
    this.db.exec(createTable);

    this.insertStmt = this.db.prepare(
      "INSERT INTO interactions (model, temperature, maxTokens, messages, duration, promptTokens, completionTokens) VALUES (?, ?, ?, json(?), ?, ?, ?)"
    );

    // Prepare statements for better performance
    this.getByIdStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions WHERE id = ?"
    );

    this.getAllStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    );

    this.getCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM interactions"
    );

    this.getByModelStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions WHERE model = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    );

    this.getByDateRangeStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    );

    this.getModelCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM interactions WHERE model = ?"
    );

    this.getDateRangeCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM interactions WHERE timestamp BETWEEN ? AND ?"
    );

    this.searchStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions WHERE messages LIKE ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    );

    this.searchCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM interactions WHERE messages LIKE ?"
    );

    // Setup cleanup on process exit
    process.on("exit", () => {
      try {
        this.db.close();
      } catch (error) {
        console.error("Error closing database:", error);
      }
    });
  }

  /**
   * Inserts an interaction into the database
   */
  insertInteraction(
    model: string,
    temperature: number,
    maxTokens: number,
    messages: CoreMessage[],
    duration: number,
    promptTokens: number,
    completionTokens: number
  ) {
    try {
      this.insertStmt.run(
        model,
        temperature,
        maxTokens,
        JSON.stringify(messages),
        duration,
        promptTokens,
        completionTokens
      );
    } catch (error) {
      console.error("Error inserting interaction:", error);
      throw error;
    }
  }

  /**
   * Get a single interaction by its ID
   */
  getInteraction(id: number): Interaction | null {
    try {
      const row = this.getByIdStmt.get(id);
      if (!row) return null;

      if (isStoredInteraction(row)) {
        return {
          ...row,
          messages: JSON.parse(row.messages) as CoreMessage[],
        };
      }
      throw new Error("Invalid Interaction");
    } catch (error) {
      console.error("Error getting interaction:", error);
      throw error;
    }
  }

  /**
   * Get all interactions with pagination
   */
  getInteractions(pagination: PaginationParams): PaginatedResult<Interaction> {
    try {
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      const rows = this.getAllStmt.all(pageSize, offset);
      const { count } = this.getCountStmt.get() as { count: number };

      if (Array.isArray(rows) && rows.every(isStoredInteraction)) {
        return {
          data: rows.map((row) => ({
            ...row,
            messages: JSON.parse(row.messages),
          })),
          total: count,
          page,
          pageSize,
          totalPages: Math.ceil(count / pageSize),
        };
      }
      throw new Error("Invalid Interactions");
    } catch (error) {
      console.error("Error getting interactions:", error);
      throw error;
    }
  }

  /**
   * Get interactions for a specific model with pagination
   */
  getInteractionsByModel(
    model: string,
    pagination: PaginationParams,
  ): PaginatedResult<Interaction> {
    try {
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      const rows = this.getByModelStmt.all(model, pageSize, offset);
      const { count } = this.getModelCountStmt.get(model) as { count: number };

      if (Array.isArray(rows) && rows.every(isStoredInteraction)) {
        return {
          data: rows.map((row) => ({
            ...row,
            messages: JSON.parse(row.messages),
          })),
          total: count,
          page,
          pageSize,
          totalPages: Math.ceil(count / pageSize),
        };
      }
      throw new Error("Invalid Interactions");
    } catch (error) {
      console.error("Error getting interactions by model:", error);
      throw error;
    }
  }

  /**
   * Get interactions within a date range with pagination
   */
  getInteractionsByDateRange(
    startDate: Date,
    endDate: Date,
    pagination: PaginationParams,
  ): PaginatedResult<Interaction> {
    try {
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      const rows = this.getByDateRangeStmt.all(
        startDate.toISOString(),
        endDate.toISOString(),
        pageSize,
        offset,
      );

      const { count } = this.getDateRangeCountStmt.get(
        startDate.toISOString(),
        endDate.toISOString()
      ) as { count: number };

      if (Array.isArray(rows) && rows.every(isStoredInteraction)) {
        return {
          data: rows.map((row) => ({
            ...row,
            messages: JSON.parse(row.messages),
          })),
          total: count,
          page,
          pageSize,
          totalPages: Math.ceil(count / pageSize),
        };
      }
      throw new Error("Invalid Interactions");
    } catch (error) {
      console.error("Error getting interactions by date range:", error);
      throw error;
    }
  }

  /**
   * Search insteractions by response content with pagination
   */
  searchInteractions(
    query: string,
    pagination: PaginationParams,
  ): PaginatedResult<Interaction> {
    try {
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      const rows = this.searchStmt.all(`%${query}%`, pageSize, offset);

      if (!(Array.isArray(rows) && rows.every(isStoredInteraction))) {
        throw new Error("Invalid Interactions");
      }

      const { count } = this.searchCountStmt.get(`%${query}%`) as { count: number };

      return {
        data: rows.map((row) => ({
          ...row,
          messages: JSON.parse(row.messages),
        })),
        total: count,
        page,
        pageSize,
        totalPages: Math.ceil(count / pageSize),
      };
    } catch (error) {
      console.error("Error searching interactions:", error);
      throw error;
    }
  }

  /**
   * Get statistics about interaction usage
   */
  getInteractionStats() {
    try {
      const stats = {
        totalMessages: 0,
        messagesByModel: {} as Record<string, number>,
        averageResponseLength: 0,
        messagesByDay: {} as Record<string, number>,
      };

      // Get total messages and average response length
      const basicStats = this.db
        .prepare(
          `SELECT 
            COUNT(*) as total,
            AVG(LENGTH(response)) as avgLength
           FROM interactions`,
        )
        .get() as { total: number; avgLength: number };

      stats.totalMessages = basicStats.total;
      stats.averageResponseLength = Math.round(basicStats.avgLength);

      // Get messages by model
      const modelStats = this.db
        .prepare(
          `SELECT model, COUNT(*) as count
           FROM interactions
           GROUP BY model`,
        )
        .all() as { model: string; count: number }[];

      for (const { model, count } of modelStats) {
        stats.messagesByModel[model] = count;
      }

      // Get messages by day
      const dayStats = this.db
        .prepare(
          `SELECT 
            date(timestamp) as day,
            COUNT(*) as count
           FROM interactions
           GROUP BY date(timestamp)
           ORDER BY day DESC
           LIMIT 30`,
        )
        .all() as { day: string; count: number }[];

      for (const { day, count } of dayStats) {
        stats.messagesByDay[day] = count;
      }

      return stats;
    } catch (error) {
      console.error("Error getting interaction stats:", error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
}
