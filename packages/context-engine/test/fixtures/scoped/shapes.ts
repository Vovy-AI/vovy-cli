export interface Adapter {
  probe(): boolean;
  label: string;
}

export const alpha: Adapter = {
  probe() {
    return true;
  },
  label: "a",
};

export const beta: Adapter = {
  probe: () => false,
  label: "b",
};

export class Box {
  open(): void {}
}

/** Shares a name with an unrelated local function in `other.ts` — the case a name-matching
 * engine cannot tell apart and a type-aware one can. */
export function estimate(count: number): number {
  return count * 2;
}

export function tally(n: number): number {
  return n;
}

/** `tally` is exposed through an object-literal property — the impact walk must continue
 * through `compute`, not dead-end at "<module>". */
export const helpers = { compute: tally };
