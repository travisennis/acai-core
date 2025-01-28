import Database from "better-sqlite3";

export interface ModelMessage {
  id: number;
  model: string;
  prompt: any;
  response: string;
  timestamp: string;
}

export function isModelMessage(obj: unknown): obj is ModelMessage {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    typeof (obj as ModelMessage).id === "number" &&
    "model" in obj &&
    typeof (obj as ModelMessage).model === "string" &&
    "prompt" in obj &&
    "response" in obj &&
    typeof (obj as ModelMessage).response === "string" &&
    "timestamp" in obj &&
    typeof (obj as ModelMessage).timestamp === "string"
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

export class MessageStorage {
  private db: Database.Database;
  private getMessageByIdStmt: Database.Statement;
  private getAllMessagesStmt: Database.Statement;
  private getMessageCountStmt: Database.Statement;
  private getMessagesByModelStmt: Database.Statement;
  private getMessagesByDateRangeStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    // Prepare statements for better performance
    this.getMessageByIdStmt = this.db.prepare(
      "SELECT id, model, prompt, response, datetime(timestamp, 'localtime') as timestamp FROM model_messages WHERE id = ?",
    );

    this.getAllMessagesStmt = this.db.prepare(
      "SELECT id, model, prompt, response, datetime(timestamp, 'localtime') as timestamp FROM model_messages ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    );

    this.getMessageCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM model_messages",
    );

    this.getMessagesByModelStmt = this.db.prepare(
      "SELECT id, model, prompt, response, datetime(timestamp, 'localtime') as timestamp FROM model_messages WHERE model = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    );

    this.getMessagesByDateRangeStmt = this.db.prepare(
      "SELECT id, model, prompt, response, datetime(timestamp, 'localtime') as timestamp FROM model_messages WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
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
   * Get a single message by its ID
   */
  getMessage(id: number): ModelMessage | null {
    try {
      const row = this.getMessageByIdStmt.get(id);
      if (!row) return null;

      if (isModelMessage(row)) {
        return {
          ...row,
          prompt: JSON.parse(row.prompt),
        };
      }
      throw new Error("Invalid ModelMessage");
    } catch (error) {
      console.error("Error getting message:", error);
      throw error;
    }
  }

  /**
   * Get all messages with pagination
   */
  getMessages(pagination: PaginationParams): PaginatedResult<ModelMessage> {
    try {
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      const rows = this.getAllMessagesStmt.all(pageSize, offset);
      const { count } = this.getMessageCountStmt.get() as { count: number };

      if (Array.isArray(rows) && rows.every(isModelMessage)) {
        return {
          data: rows.map((row) => ({
            ...row,
            prompt: JSON.parse(row.prompt),
          })),
          total: count,
          page,
          pageSize,
          totalPages: Math.ceil(count / pageSize),
        };
      }
      throw new Error("Invalid ModelMessages");
    } catch (error) {
      console.error("Error getting messages:", error);
      throw error;
    }
  }

  /**
   * Get messages for a specific model with pagination
   */
  getMessagesByModel(
    model: string,
    pagination: PaginationParams,
  ): PaginatedResult<ModelMessage> {
    try {
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      const rows = this.getMessagesByModelStmt.all(model, pageSize, offset);
      const { count } = this.db
        .prepare("SELECT COUNT(*) as count FROM model_messages WHERE model = ?")
        .get(model) as { count: number };

      if (Array.isArray(rows) && rows.every(isModelMessage)) {
        return {
          data: rows.map((row) => ({
            ...row,
            prompt: JSON.parse(row.prompt),
          })),
          total: count,
          page,
          pageSize,
          totalPages: Math.ceil(count / pageSize),
        };
      }
      throw new Error("Invalid ModelMessages");
    } catch (error) {
      console.error("Error getting messages by model:", error);
      throw error;
    }
  }

  /**
   * Get messages within a date range with pagination
   */
  getMessagesByDateRange(
    startDate: Date,
    endDate: Date,
    pagination: PaginationParams,
  ): PaginatedResult<ModelMessage> {
    try {
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      const rows = this.getMessagesByDateRangeStmt.all(
        startDate.toISOString(),
        endDate.toISOString(),
        pageSize,
        offset,
      ) as any[];

      const { count } = this.db
        .prepare(
          "SELECT COUNT(*) as count FROM model_messages WHERE timestamp BETWEEN ? AND ?",
        )
        .get(startDate.toISOString(), endDate.toISOString()) as {
        count: number;
      };

      return {
        data: rows.map((row) => ({
          ...row,
          prompt: JSON.parse(row.prompt),
        })),
        total: count,
        page,
        pageSize,
        totalPages: Math.ceil(count / pageSize),
      };
    } catch (error) {
      console.error("Error getting messages by date range:", error);
      throw error;
    }
  }

  /**
   * Search messages by response content with pagination
   */
  searchMessages(
    query: string,
    pagination: PaginationParams,
  ): PaginatedResult<ModelMessage> {
    try {
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      const rows = this.db
        .prepare(
          `SELECT id, model, prompt, response, datetime(timestamp, 'localtime') as timestamp 
           FROM model_messages 
           WHERE response LIKE ? 
           ORDER BY timestamp DESC 
           LIMIT ? OFFSET ?`,
        )
        .all(`%${query}%`, pageSize, offset) as any[];

      const { count } = this.db
        .prepare(
          "SELECT COUNT(*) as count FROM model_messages WHERE response LIKE ?",
        )
        .get(`%${query}%`) as { count: number };

      return {
        data: rows.map((row) => ({
          ...row,
          prompt: JSON.parse(row.prompt),
        })),
        total: count,
        page,
        pageSize,
        totalPages: Math.ceil(count / pageSize),
      };
    } catch (error) {
      console.error("Error searching messages:", error);
      throw error;
    }
  }

  /**
   * Get statistics about message usage
   */
  getMessageStats() {
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
           FROM model_messages`,
        )
        .get() as { total: number; avgLength: number };

      stats.totalMessages = basicStats.total;
      stats.averageResponseLength = Math.round(basicStats.avgLength);

      // Get messages by model
      const modelStats = this.db
        .prepare(
          `SELECT model, COUNT(*) as count
           FROM model_messages
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
           FROM model_messages
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
      console.error("Error getting message stats:", error);
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
