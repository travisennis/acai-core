import fs from "node:fs/promises";
import { tool } from "ai";
import { z } from "zod";

interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

interface KnowledgeGraphOptions {
  path: string;
}

class KnowledgeGraphManager {
  private memoryFilePath: string;

  constructor(options: KnowledgeGraphOptions) {
    this.memoryFilePath = options.path;
  }

  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.memoryFilePath, "utf-8");
      const lines = data.split("\n").filter((line) => line.trim() !== "");
      return lines.reduce(
        (graph: KnowledgeGraph, line) => {
          const item = JSON.parse(line);
          if (item.type === "entity") graph.entities.push(item as Entity);
          if (item.type === "relation") graph.relations.push(item as Relation);
          return graph;
        },
        { entities: [], relations: [] },
      );
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map((e) => JSON.stringify({ type: "entity", ...e })),
      ...graph.relations.map((r) => JSON.stringify({ type: "relation", ...r })),
    ];
    await fs.writeFile(this.memoryFilePath, lines.join("\n"));
  }

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const newEntities = entities.filter(
      (e) =>
        !graph.entities.some(
          (existingEntity) => existingEntity.name === e.name,
        ),
    );
    graph.entities.push(...newEntities);
    await this.saveGraph(graph);
    return newEntities;
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const graph = await this.loadGraph();
    const newRelations = relations.filter(
      (r) =>
        !graph.relations.some(
          (existingRelation) =>
            existingRelation.from === r.from &&
            existingRelation.to === r.to &&
            existingRelation.relationType === r.relationType,
        ),
    );
    graph.relations.push(...newRelations);
    await this.saveGraph(graph);
    return newRelations;
  }

  async addObservations(
    observations: { entityName: string; contents: string[] }[],
  ): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const results = observations.map((o) => {
      const entity = graph.entities.find((e) => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      const newObservations = o.contents.filter(
        (content) => !entity.observations.includes(content),
      );
      entity.observations.push(...newObservations);
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    await this.saveGraph(graph);
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.entities = graph.entities.filter(
      (e) => !entityNames.includes(e.name),
    );
    graph.relations = graph.relations.filter(
      (r) => !(entityNames.includes(r.from) || entityNames.includes(r.to)),
    );
    await this.saveGraph(graph);
  }

  async deleteObservations(
    deletions: { entityName: string; observations: string[] }[],
  ): Promise<void> {
    const graph = await this.loadGraph();
    for (const d of deletions) {
      const entity = graph.entities.find((e) => e.name === d.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(
          (o) => !d.observations.includes(o),
        );
      }
    }
    await this.saveGraph(graph);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.relations = graph.relations.filter(
      (r) =>
        !relations.some(
          (delRelation) =>
            r.from === delRelation.from &&
            r.to === delRelation.to &&
            r.relationType === delRelation.relationType,
        ),
    );
    await this.saveGraph(graph);
  }

  readGraph(): Promise<KnowledgeGraph> {
    return this.loadGraph();
  }

  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const filteredEntities = graph.entities.filter(
      (e) =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.entityType.toLowerCase().includes(query.toLowerCase()) ||
        e.observations.some((o) =>
          o.toLowerCase().includes(query.toLowerCase()),
        ),
    );
    const filteredEntityNames = new Set(filteredEntities.map((e) => e.name));
    const filteredRelations = graph.relations.filter(
      (r) => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to),
    );
    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const filteredEntities = graph.entities.filter((e) =>
      names.includes(e.name),
    );
    const filteredEntityNames = new Set(filteredEntities.map((e) => e.name));
    const filteredRelations = graph.relations.filter(
      (r) => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to),
    );
    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }
}

export const createKnowledgeGraphTools = (options: KnowledgeGraphOptions) => {
  const manager = new KnowledgeGraphManager(options);

  return {
    createEntities: tool({
      description: "Create multiple new entities in the knowledge graph",
      parameters: z.object({
        entities: z.array(
          z.object({
            name: z.string().describe("The name of the entity"),
            entityType: z.string().describe("The type of the entity"),
            observations: z
              .array(z.string())
              .describe(
                "An array of observation contents associated with the entity",
              ),
          }),
        ),
      }),
      execute: async ({ entities }) => {
        try {
          const result = await manager.createEntities(entities);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error creating entities: ${(error as Error).message}`;
        }
      },
    }),

    createRelations: tool({
      description:
        "Create multiple new relations between entities in the knowledge graph",
      parameters: z.object({
        relations: z.array(
          z.object({
            from: z
              .string()
              .describe("The name of the entity where the relation starts"),
            to: z
              .string()
              .describe("The name of the entity where the relation ends"),
            relationType: z.string().describe("The type of the relation"),
          }),
        ),
      }),
      execute: async ({ relations }) => {
        try {
          const result = await manager.createRelations(relations);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error creating relations: ${(error as Error).message}`;
        }
      },
    }),

    addObservations: tool({
      description:
        "Add new observations to existing entities in the knowledge graph",
      parameters: z.object({
        observations: z.array(
          z.object({
            entityName: z
              .string()
              .describe("The name of the entity to add the observations to"),
            contents: z
              .array(z.string())
              .describe("An array of observation contents to add"),
          }),
        ),
      }),
      execute: async ({ observations }) => {
        try {
          const result = await manager.addObservations(observations);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error adding observations: ${(error as Error).message}`;
        }
      },
    }),

    deleteEntities: tool({
      description:
        "Delete multiple entities and their associated relations from the knowledge graph",
      parameters: z.object({
        entityNames: z
          .array(z.string())
          .describe("An array of entity names to delete"),
      }),
      execute: async ({ entityNames }) => {
        try {
          await manager.deleteEntities(entityNames);
          return "Entities deleted successfully";
        } catch (error) {
          return `Error deleting entities: ${(error as Error).message}`;
        }
      },
    }),

    deleteObservations: tool({
      description:
        "Delete specific observations from entities in the knowledge graph",
      parameters: z.object({
        deletions: z.array(
          z.object({
            entityName: z
              .string()
              .describe("The name of the entity containing the observations"),
            observations: z
              .array(z.string())
              .describe("An array of observations to delete"),
          }),
        ),
      }),
      execute: async ({ deletions }) => {
        try {
          await manager.deleteObservations(deletions);
          return "Observations deleted successfully";
        } catch (error) {
          return `Error deleting observations: ${(error as Error).message}`;
        }
      },
    }),

    deleteRelations: tool({
      description: "Delete multiple relations from the knowledge graph",
      parameters: z.object({
        relations: z.array(
          z.object({
            from: z
              .string()
              .describe("The name of the entity where the relation starts"),
            to: z
              .string()
              .describe("The name of the entity where the relation ends"),
            relationType: z.string().describe("The type of the relation"),
          }),
        ),
      }),
      execute: async ({ relations }) => {
        try {
          await manager.deleteRelations(relations);
          return "Relations deleted successfully";
        } catch (error) {
          return `Error deleting relations: ${(error as Error).message}`;
        }
      },
    }),

    readGraph: tool({
      description: "Read the entire knowledge graph",
      parameters: z.object({}),
      execute: async () => {
        try {
          const result = await manager.readGraph();
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error reading graph: ${(error as Error).message}`;
        }
      },
    }),

    searchNodes: tool({
      description: "Search for nodes in the knowledge graph based on a query",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "The search query to match against entity names, types, and observation content",
          ),
      }),
      execute: async ({ query }) => {
        try {
          const result = await manager.searchNodes(query);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error searching nodes: ${(error as Error).message}`;
        }
      },
    }),

    openNodes: tool({
      description: "Open specific nodes in the knowledge graph by their names",
      parameters: z.object({
        names: z
          .array(z.string())
          .describe("An array of entity names to retrieve"),
      }),
      execute: async ({ names }) => {
        try {
          const result = await manager.openNodes(names);
          return JSON.stringify(result, null, 2);
        } catch (error) {
          return `Error opening nodes: ${(error as Error).message}`;
        }
      },
    }),
  };
};