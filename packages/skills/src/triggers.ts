import { SKILL_MANIFEST } from "./manifest.js";
import type { SkillMeta } from "./types.js";

export interface SkillMatch {
  id: string;
  score: number;
  /** Which trigger phrases and keywords fired, so a match can be explained rather than trusted. */
  matched: string[];
}

/**
 * A matched trigger phrase is strong evidence, a matched keyword is weak evidence, and an
 * anti-phrase outweighs both — a founder asking "build me a login page" is asking for
 * `prompt-rescoper`, not `context-scoper`, even though "page" and "login" are code words.
 */
const PHRASE_WEIGHT = 3;
const KEYWORD_WEIGHT = 1;
const ANTI_PHRASE_WEIGHT = -4;

/** Lowercase, collapse whitespace, and strip punctuation that would break a phrase match
 * (`"where's"` and `"wheres"` must behave the same). Padded with spaces so keyword lookups
 * can require whole-word boundaries. */
function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function scoreSkill(skill: SkillMeta, prompt: string): SkillMatch {
  const matched: string[] = [];
  let score = 0;

  for (const phrase of skill.triggers.phrases) {
    if (prompt.includes(` ${normalize(phrase).trim()} `) || prompt.includes(normalize(phrase))) {
      score += PHRASE_WEIGHT;
      matched.push(phrase);
    }
  }

  for (const keyword of skill.triggers.keywords) {
    if (prompt.includes(` ${normalize(keyword).trim()} `)) {
      score += KEYWORD_WEIGHT;
      matched.push(keyword);
    }
  }

  for (const antiPhrase of skill.triggers.antiPhrases ?? []) {
    if (prompt.includes(normalize(antiPhrase))) score += ANTI_PHRASE_WEIGHT;
  }

  return { id: skill.id, score, matched };
}

/**
 * Which skills a founder's raw prompt should load, most relevant first.
 *
 * **This is a deterministic proxy, not the real router.** What actually decides whether a
 * skill fires is the host model reading its SKILL.md `description`. This function scores
 * the same trigger conditions those descriptions encode, which makes them regression-
 * testable (`scripts/eval-skill-routing`) — a description edit that stops separating two
 * skills shows up as a number, not as a surprise in production. Do not read its accuracy
 * as a measurement of how the host model behaves.
 */
export function matchSkills(prompt: string): SkillMatch[] {
  const normalized = normalize(prompt);
  return SKILL_MANIFEST.map((skill) => scoreSkill(skill, normalized))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
