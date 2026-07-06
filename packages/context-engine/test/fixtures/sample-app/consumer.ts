import { Greeter, buildGreeting } from "./greeter.js";

export function runGreeter(): string {
  const greeter = new Greeter();
  return greeter.greet(buildGreeting("Vovy").message);
}
