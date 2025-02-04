import type { CoreMessage } from "ai";
import Database from "better-sqlite3";

export interface ValidationError extends Error {
  field: string;
  value: any;
}

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
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enable full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS interactions_fts USING fts5(
  messages,
  content='interactions',
  content_rowid='id'
);

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
  private static readonly TEMPERATURE_MIN = 0;
  private static readonly TEMPERATURE_MAX = 2;
  private static readonly MAX_TOKENS_MIN = 1;
  private static readonly MAX_TOKENS_MAX = 32000;

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

    // Create the messages table and other required tables
    this.db.exec(createTable);

    // Initialize schema migrations
    try {
      this.migrateSchema();
    } catch (error) {
      console.error("Failed to run schema migrations:", error);
    }

    // Create trigger for FTS table
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS interactions_ai AFTER INSERT ON interactions BEGIN
        INSERT INTO interactions_fts(rowid, messages) VALUES (new.id, new.messages);
      END;
    `);

    this.insertStmt = this.db.prepare(
      "INSERT INTO interactions (model, temperature, maxTokens, messages, duration, promptTokens, completionTokens) VALUES (?, ?, ?, json(?), ?, ?, ?)",
    );

    // Prepare statements for better performance
    this.getByIdStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions WHERE id = ?",
    );

    this.getAllStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    );

    this.getCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM interactions",
    );

    this.getByModelStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions WHERE model = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    );

    this.getByDateRangeStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    );

    this.getModelCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM interactions WHERE model = ?",
    );

    this.getDateRangeCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM interactions WHERE timestamp BETWEEN ? AND ?",
    );

    this.searchStmt = this.db.prepare(
      "SELECT id, model, temperature, maxTokens, messages, duration, promptTokens, completionTokens, datetime(timestamp, 'localtime') as timestamp FROM interactions WHERE messages LIKE ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    );

    this.searchCountStmt = this.db.prepare(
      "SELECT COUNT(*) as count FROM interactions WHERE messages LIKE ?",
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
    completionTokens: number,
  ) {
    try {
      // Validate input parameters
      this.validateInput(temperature, maxTokens);

      if (!model || typeof model !== "string") {
        throw new Error("Model must be a non-empty string");
      }

      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("Messages must be a non-empty array");
      }
      this.insertStmt.run(
        model,
        temperature,
        maxTokens,
        JSON.stringify(messages),
        duration,
        promptTokens,
        completionTokens,
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
        endDate.toISOString(),
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

      const { count } = this.searchCountStmt.get(`%${query}%`) as {
        count: number;
      };

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
   * Performs database maintenance tasks
   */
  maintenance(): void {
    try {
      // Vacuum the database to reclaim space and optimize
      this.db.exec("VACUUM");

      // Analyze tables for query optimization
      this.db.exec("ANALYZE");

      // Reindex for better query performance
      this.db.exec("REINDEX");
    } catch (error) {
      console.error("Error during maintenance:", error);
      throw error;
    }
  }

  /**
   * Creates a backup of the database
   */
  async backup(backupPath: string): Promise<void> {
    try {
      await this.db.backup(backupPath);
    } catch (error) {
      console.error("Error creating backup:", error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }

  private validateInput(temperature: number, maxTokens: number): void {
    const errors: ValidationError[] = [];

    if (
      temperature < InteractionStorage.TEMPERATURE_MIN ||
      temperature > InteractionStorage.TEMPERATURE_MAX
    ) {
      const error = new Error(
        `Temperature must be between ${InteractionStorage.TEMPERATURE_MIN} and ${InteractionStorage.TEMPERATURE_MAX}`,
      ) as ValidationError;
      error.field = "temperature";
      error.value = temperature;
      errors.push(error);
    }

    if (
      maxTokens < InteractionStorage.MAX_TOKENS_MIN ||
      maxTokens > InteractionStorage.MAX_TOKENS_MAX
    ) {
      const error = new Error(
        `MaxTokens must be between ${InteractionStorage.MAX_TOKENS_MIN} and ${InteractionStorage.MAX_TOKENS_MAX}`,
      ) as ValidationError;
      error.field = "maxTokens";
      error.value = maxTokens;
      errors.push(error);
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Input validation failed");
    }
  }

  /**
   * Performs batch insert of multiple interactions
   */
  batchInsertInteractions(
    interactions: {
      model: string;
      temperature: number;
      maxTokens: number;
      messages: CoreMessage[];
      duration: number;
      promptTokens: number;
      completionTokens: number;
    }[],
  ): void {
    const transaction = this.db.transaction((items) => {
      for (const item of items) {
        this.validateInput(item.temperature, item.maxTokens);
        this.insertStmt.run(
          item.model,
          item.temperature,
          item.maxTokens,
          JSON.stringify(item.messages),
          item.duration,
          item.promptTokens,
          item.completionTokens,
        );
      }
    });

    try {
      transaction(interactions);
    } catch (error) {
      console.error("Error in batch insert:", error);
      throw error;
    }
  }

  /**
   * Performs schema migrations if needed
   */
  private migrateSchema(): void {
    const migrations = [
      {
        version: 1,
        up: `
          -- Add any future schema changes here
          -- Example:
          -- ALTER TABLE interactions ADD COLUMN new_column TEXT;
        `,
      },
    ];

    try {
      const currentVersion = this.db
        .prepare("SELECT MAX(version) as version FROM schema_migrations")
        .get() as { version: number | null };

      const startVersion = (currentVersion?.version || 0) + 1;

      for (const migration of migrations) {
        if (migration.version >= startVersion) {
          this.db.exec(migration.up);
          this.db
            .prepare("INSERT INTO schema_migrations (version) VALUES (?)")
            .run(migration.version);
        }
      }
    } catch (error) {
      console.error("Error during schema migration:", error);
      throw error;
    }
  }

  /**
   * Get interactions with advanced filtering and sorting options
   */
  getInteractionsAdvanced(params: {
    pagination: PaginationParams;
    sortBy?: "timestamp" | "duration" | "promptTokens" | "completionTokens";
    sortOrder?: "ASC" | "DESC";
    filters?: {
      model?: string;
      minTemperature?: number;
      maxTemperature?: number;
      minTokens?: number;
      maxTokens?: number;
      dateRange?: { start: Date; end: Date };
    };
    searchText?: string;
  }): PaginatedResult<Interaction> {
    try {
      const {
        pagination,
        sortBy = "timestamp",
        sortOrder = "DESC",
        filters,
        searchText,
      } = params;
      const { page = 1, pageSize = 10 } = pagination;
      const offset = (page - 1) * pageSize;

      let query = "SELECT i.* FROM interactions i";
      let countQuery = "SELECT COUNT(*) as count FROM interactions i";
      const queryParams: any[] = [];

      // Add full-text search if specified
      if (searchText) {
        query = `${query} JOIN interactions_fts fts ON i.id = fts.rowid`;
        countQuery = `${countQuery} JOIN interactions_fts fts ON i.id = fts.rowid`;
        query += " WHERE fts.messages MATCH ?";
        countQuery += " WHERE fts.messages MATCH ?";
        queryParams.push(searchText);
      }

      // Add filters
      if (filters) {
        const whereConditions: string[] = [];

        if (filters.model) {
          whereConditions.push("model = ?");
          queryParams.push(filters.model);
        }

        if (filters.minTemperature !== undefined) {
          whereConditions.push("temperature >= ?");
          queryParams.push(filters.minTemperature);
        }

        if (filters.maxTemperature !== undefined) {
          whereConditions.push("temperature <= ?");
          queryParams.push(filters.maxTemperature);
        }

        if (filters.minTokens !== undefined) {
          whereConditions.push("maxTokens >= ?");
          queryParams.push(filters.minTokens);
        }

        if (filters.maxTokens !== undefined) {
          whereConditions.push("maxTokens <= ?");
          queryParams.push(filters.maxTokens);
        }

        if (filters.dateRange) {
          whereConditions.push("timestamp BETWEEN ? AND ?");
          queryParams.push(filters.dateRange.start.toISOString());
          queryParams.push(filters.dateRange.end.toISOString());
        }

        if (whereConditions.length > 0) {
          const whereClause = whereConditions.join(" AND ");
          query += searchText ? ` AND ${whereClause}` : ` WHERE ${whereClause}`;
          countQuery += searchText
            ? ` AND ${whereClause}`
            : ` WHERE ${whereClause}`;
        }
      }

      // Add sorting
      query += ` ORDER BY ${sortBy} ${sortOrder}`;

      // Add pagination
      query += " LIMIT ? OFFSET ?";
      const fullQueryParams = [...queryParams, pageSize, offset];

      const rows = this.db.prepare(query).all(...fullQueryParams);
      const { count } = this.db.prepare(countQuery).get(...queryParams) as {
        count: number;
      };

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
      console.error("Error getting interactions with advanced options:", error);
      throw error;
    }
  }
}
