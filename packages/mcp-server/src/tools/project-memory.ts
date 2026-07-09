import {
  MEMORY_TYPES,
  type MemoryType,
  listMemory,
  recallMemory,
  recordMemory,
} from "../memory/store.js";

export type ProjectMemoryAction = "record" | "recall" | "list";

export interface ProjectMemoryInput {
  action: ProjectMemoryAction;
  cwd?: string;
  type?: string;
  title?: string;
  body?: string;
  tags?: string[];
  query?: string;
}

/**
 * One consolidated tool, same shape (and same token-cost reasoning) as `search_codebase`.
 * Storage is plain markdown under `.vovy/memory/`, committed to git — see
 * `../memory/store.ts` for why that is the whole backend.
 */
export async function projectMemory(input: ProjectMemoryInput) {
  const root = input.cwd ?? process.cwd();

  switch (input.action) {
    case "record": {
      if (!input.type || !MEMORY_TYPES.includes(input.type as MemoryType)) {
        throw new Error(
          `\`type\` is required for action "record" — one of ${MEMORY_TYPES.join(", ")}.`,
        );
      }
      if (!input.title || !input.body) {
        throw new Error('`title` and `body` are required for action "record".');
      }
      return recordMemory(root, {
        type: input.type as MemoryType,
        title: input.title,
        body: input.body,
        tags: input.tags,
      });
    }
    case "recall": {
      if (!input.query) {
        throw new Error('`query` is required for action "recall".');
      }
      return recallMemory(root, input.query);
    }
    case "list": {
      // Titles only — a founder's project can accumulate hundreds of entries, and
      // returning every body would spend the tokens recall exists to save.
      return listMemory(root).map(({ type, title, date, tags, file }) => ({
        type,
        title,
        date,
        tags,
        file,
      }));
    }
    default: {
      const exhaustiveCheck: never = input.action;
      throw new Error(`Unknown project_memory action "${exhaustiveCheck}".`);
    }
  }
}
