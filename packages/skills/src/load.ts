import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LoadedSkill, SkillMeta } from "./types.js";

// dist/load.js -> ../skills  (and src/load.ts -> ../skills, same relative shape in dev)
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export function skillDir(id: string): string {
  return join(packageRoot, "skills", id);
}

export function skillPath(id: string): string {
  return join(skillDir(id), "SKILL.md");
}

/** Minimal frontmatter parser: only needs the two required Agent Skills fields, `name` and `description`. */
function parseFrontmatter(raw: string): { name: string; description: string; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("SKILL.md is missing YAML frontmatter (expected a leading `---` block).");
  }
  const [, frontmatter, body] = match;
  const fields: Record<string, string> = {};
  for (const line of (frontmatter ?? "").split(/\r?\n/)) {
    const fieldMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!fieldMatch) continue;
    const [, key, value] = fieldMatch;
    if (!key) continue;
    fields[key] = (value ?? "").trim().replace(/^["']|["']$/g, "");
  }
  if (!fields.name || !fields.description) {
    throw new Error("SKILL.md frontmatter must include both `name` and `description`.");
  }
  return { name: fields.name, description: fields.description, body: (body ?? "").trim() };
}

export function loadSkill(meta: SkillMeta): LoadedSkill {
  const sourcePath = skillPath(meta.id);
  const raw = readFileSync(sourcePath, "utf8");
  const { name, description, body } = parseFrontmatter(raw);
  return { ...meta, name, description, body, raw, sourcePath };
}
