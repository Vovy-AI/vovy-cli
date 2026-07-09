import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findSecret, listMemory, recallMemory, recordMemory } from "./store.js";

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

function freshRoot(): string {
  root = mkdtempSync(join(tmpdir(), "vovy-memory-"));
  return root;
}

describe("recordMemory / listMemory", () => {
  it("round-trips an entry and regenerates the index", () => {
    const r = freshRoot();
    const result = recordMemory(r, {
      type: "decision",
      title: "TypeScript backend, not external LSP",
      body: "Rejected external language servers: founders don't have them on PATH.",
      tags: ["context-engine"],
    });

    expect(result.action).toBe("created");
    const entries = listMemory(r);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: "decision",
      title: "TypeScript backend, not external LSP",
      tags: ["context-engine"],
    });
    expect(readFileSync(join(r, ".vovy", "memory", "INDEX.md"), "utf8")).toContain(
      "TypeScript backend, not external LSP",
    );
  });

  it("re-recording the same title updates in place instead of duplicating", () => {
    const r = freshRoot();
    recordMemory(r, { type: "mistake", title: "Stale dist", body: "v1" });
    const second = recordMemory(r, { type: "mistake", title: "Stale dist", body: "v2" });

    expect(second.action).toBe("updated");
    expect(listMemory(r)).toHaveLength(1);
    expect(listMemory(r)[0]?.body).toBe("v2");
  });

  it("refuses to record anything that looks like a credential — memory is committed to git", () => {
    const r = freshRoot();
    expect(() =>
      recordMemory(r, {
        type: "decision",
        title: "API setup",
        body: "we used sk-abc123def456ghi789jkl for the integration",
      }),
    ).toThrow(/committed to git/);
    expect(existsSync(join(r, ".vovy"))).toBe(false);
  });
});

describe("findSecret", () => {
  it("catches common credential shapes and ignores prose", () => {
    expect(findSecret("AKIAIOSFODNN7EXAMPLE")).toContain("AWS");
    expect(findSecret("-----BEGIN RSA PRIVATE KEY-----")).toContain("private key");
    expect(findSecret("the Stripe key lives in .env, never commit it")).toBeNull();
  });
});

describe("recallMemory", () => {
  it("ranks title matches above body matches and returns nothing for unrelated queries", () => {
    const r = freshRoot();
    recordMemory(r, {
      type: "constraint",
      title: "No native modules",
      body: "Founders' machines never compile anything — node-gyp failures kill installs.",
    });
    recordMemory(r, {
      type: "mistake",
      title: "Fixture names corrupted benchmark ground truth",
      body: "Naming a native test fixture after a real symbol silently broke the eval.",
    });

    const matches = recallMemory(r, "can we add a native dependency?");
    expect(matches[0]?.title).toBe("No native modules");
    expect(recallMemory(r, "kubernetes ingress")).toEqual([]);
  });
});
