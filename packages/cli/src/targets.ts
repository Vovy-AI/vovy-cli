import { ADAPTERS, type DetectEnv, type HostAdapter, getAdapter } from "@vovy/host-detect";

/** Resolve which host adapters a command should act on: an explicit `--host` list wins,
 * otherwise fall back to whichever hosts `detect()` finds installed on this machine. */
export function resolveTargets(env: DetectEnv, hosts?: string[]): HostAdapter[] {
  if (hosts?.length) return hosts.map(getAdapter);
  return ADAPTERS.filter((adapter) => adapter.detect(env));
}
