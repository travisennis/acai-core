import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import simpleGit from "simple-git";
import { z } from "zod";

const CONVENTIONAL_COMMIT_MESSAGE =
  /^(feat|fix|docs|style|refactor|perf|test|chore)(\(\w+\))?!?: .+/;

function validateConventionalCommit(message: string): boolean {
  return CONVENTIONAL_COMMIT_MESSAGE.test(message);
}

interface GitOptions {
  workingDir: string;
}

const validateGitRepo = (workingDir: string): void => {
  try {
    const stats = fs.statSync(workingDir);
    if (!stats.isDirectory()) {
      throw new Error(`Error: ${workingDir} is not a directory`);
    }
  } catch (error) {
    throw new Error(`Error accessing directory ${workingDir}:`, {
      cause: error,
    });
  }

  const gitDir = path.join(workingDir, ".git");

  try {
    const stats = fs.statSync(gitDir);
    if (!stats.isDirectory()) {
      throw new Error(`Not a git repository: ${workingDir}`);
    }
  } catch (error) {
    console.error(`Unknown error: ${(error as Error).message}`);
    throw new Error(`Not a git repository: ${workingDir}`, { cause: error });
  }
};

function sanitizePath(workingDir: string, userPath: string): string {
  const normalizedPath = path.isAbsolute(userPath)
    ? path.normalize(userPath)
    : path.normalize(path.join(workingDir, userPath));

  const resolvedPath = path.resolve(normalizedPath);

  if (!resolvedPath.startsWith(workingDir)) {
    throw new Error(
      `Path is outside the working directory: ${resolvedPath} is not in ${workingDir}`,
    );
  }

  return resolvedPath;
}

export const createGitTools = async ({ workingDir }: GitOptions) => {
  return {
    gitNewBranch: tool({
      description: "A tool to create a new git branch and switch to it.",
      parameters: z.object({
        path: z.string().describe("The path to the git repo."),
        name: z.string().describe("The name of the git branch."),
      }),
      execute: async ({ path, name }) => {
        try {
          validateGitRepo(workingDir);
          const baseDir = sanitizePath(workingDir, path);
          const git = simpleGit({ baseDir });

          // Check if there are any changes to commit
          const status = await git.status();
          if (status.files.length > 0) {
            return "Repo is not clean.";
          }

          await git.checkoutLocalBranch(name);
          return `Branch created successfully: ${name}`;
        } catch (error) {
          return `Error creating branch: ${(error as Error).message}`;
        }
      },
    }),
    gitCommit: tool({
      description:
        "Commits a new git changeset for the given files with the provided commit message. It will stage the files given if they aren't already staged. The commit message should adhere to the Conventional Commits standard.",
      parameters: z.object({
        path: z.string(),
        message: z.string().describe("The commit message."),
        files: z
          .string()
          .describe(
            "A command-separated list of files to include in this commit.",
          ),
      }),
      execute: async ({ path, message, files }) => {
        try {
          validateGitRepo(workingDir);
          const baseDir = sanitizePath(workingDir, path);
          const git = simpleGit({ baseDir });

          // Check if there are any changes to commit
          const status = await git.status();
          if (status.files.length === 0) {
            return "No changes to commit.";
          }

          // Check if no message is provided or the provided message doesn't conform to Conventional Commits
          if (!(message && validateConventionalCommit(message))) {
            return "Invalid commit message. Doesn't conform to Conventional Commits";
          }

          if (!files || files.trim() === "") {
            return "No files provided.";
          }

          const fileArr = files
            .split(",")
            .map((file) => file.trim())
            .map((file) => sanitizePath(workingDir, file));

          // Add the changes and commit
          await git.add(fileArr);
          const commitResult = await git.commit(message);
          return `Commit created successfully: ${commitResult.commit} - ${message}`;
        } catch (error) {
          return `Error creating commit: ${(error as Error).message}`;
        }
      },
    }),

    gitStatus: tool({
      description: "Get the status of the git repo at the given path.",
      parameters: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        try {
          validateGitRepo(workingDir);
          const baseDir = sanitizePath(workingDir, path);
          const git = simpleGit({ baseDir });

          // Check if there are any changes to commit
          const status = await git.status();
          if (status.files.length === 0) {
            return "No changes found.";
          }

          return `Status:\n ${JSON.stringify(status, undefined, 2)}`;
        } catch (error) {
          return `Error getting status: ${(error as Error).message}`;
        }
      },
    }),

    gitLog: tool({
      description: "Gets the log of the git repo at the given path.",
      parameters: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        try {
          validateGitRepo(workingDir);
          const baseDir = sanitizePath(workingDir, path);
          const git = simpleGit({ baseDir });

          const log = await git.log();

          return `Log:\n ${JSON.stringify(log, undefined, 2)}`;
        } catch (error) {
          return `Error getting log: ${(error as Error).message}`;
        }
      },
    }),

    gitShow: tool({
      description: "Shows the contents of a commit",
      parameters: z.object({
        path: z.string(),
        revision: z.string(),
      }),
      execute: async ({ path, revision }) => {
        try {
          validateGitRepo(workingDir);
          const baseDir = sanitizePath(workingDir, path);
          const git = simpleGit({ baseDir });

          const show = await git.show(revision);

          return `Show:\n ${JSON.stringify(show, undefined, 2)}`;
        } catch (error) {
          return `Error getting show: ${(error as Error).message}`;
        }
      },
    }),

    gitDiff: tool({
      description: "Shows differences between branches or commits",
      parameters: z.object({
        path: z.string(),
        target: z.string(),
      }),
      execute: async ({ path, target }) => {
        try {
          validateGitRepo(workingDir);
          const baseDir = sanitizePath(workingDir, path);
          const git = simpleGit({ baseDir });
          const diff = await git.diff([target]);
          return diff || "No changes detected.";
        } catch (error) {
          return `Error getting git diff: ${(error as Error).message}`;
        }
      },
    }),

    gitDiffUnstaged: tool({
      description:
        "Shows changes in the working directory that are not yet staged",
      parameters: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        try {
          validateGitRepo(workingDir);
          const baseDir = sanitizePath(workingDir, path);
          const git = simpleGit({ baseDir });
          const diff = await git.diff();
          return diff || "No changes detected.";
        } catch (error) {
          return `Error getting git diff: ${(error as Error).message}`;
        }
      },
    }),

    gitDiffStaged: tool({
      description: "Shows changes that are staged for commit.",
      parameters: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        try {
          validateGitRepo(workingDir);
          const baseDir = sanitizePath(workingDir, path);
          const git = simpleGit({ baseDir });
          const diff = await git.diff(["--cached"]);
          return diff || "No changes detected.";
        } catch (error) {
          return `Error getting git diff: ${(error as Error).message}`;
        }
      },
    }),
  };
};
