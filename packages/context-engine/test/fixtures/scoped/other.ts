import { Box, alpha } from "./shapes.js";

/** Same name as `shapes.ts`'s exported `estimate`, different scope, different signature. */
function estimate(text: string): number {
  return text.length;
}

export function run(): number {
  // A function-body local. An overview of this file must not list it as a symbol.
  const localOnly = "x";
  alpha.probe();
  new Box().open();
  return estimate(localOnly);
}
