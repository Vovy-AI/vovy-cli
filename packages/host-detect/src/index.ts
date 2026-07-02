export {
  ADAPTERS,
  claudeCodeAdapter,
  clineAdapter,
  codexAdapter,
  cursorAdapter,
  getAdapter,
  windsurfAdapter,
} from "./adapters/index.js";
export { removeCodexMcpEntry } from "./adapters/codex.js";
export { removeJsonMcpEntry } from "./json-mcp-config.js";
export type { DetectEnv, HostAdapter, McpServerEntry, SkillScope } from "./types.js";
export { VERIFIED_ADAPTER_IDS } from "./types.js";
export type {
  WriteAction,
  WriteMcpConfigOptions,
  WriteResult,
  WriteSkillOptions,
} from "./write.js";
export { writeMcpConfig, writeSkillFile } from "./write.js";
