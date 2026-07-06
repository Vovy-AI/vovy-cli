export interface Greeting {
  message: string;
}

export function buildGreeting(name: string): Greeting {
  return { message: `hi ${name}` };
}

export class Greeter {
  greet(name: string): string {
    const greeting = buildGreeting(name);
    return greeting.message;
  }
}

export const DEFAULT_NAME = "world";

function internalHelper(): void {
  // not exported — mentions buildGreeting in prose only, this must not count as a
  // reference (a naive grep would match this comment; tree-sitter must not).
}

internalHelper();
