import { languageModel } from "../providers.ts";
import { roundTripOptimization } from "./rto.ts";

export { bon } from "./bon.ts";
export { cot } from "./cot-reflection.ts";
export { echo } from "./echo.ts";
export { leap } from "./leap.ts";
export { mcts } from "./mcts.ts";
export { moa } from "./moa.ts";
export { plansearch } from "./plansearch.ts";
export { pvg } from "./pvg.ts";
export { reread } from "./reread.ts";
export { roundTripOptimization } from "./rto.ts";
export { selfConsistency } from "./self-consistency.ts";
export { tot } from "./tot.ts";

// Example usage:
async function main() {
  const [text] = await roundTripOptimization({
    model: languageModel("google:flash2"),
    prompt: "The best LLM agent flow is",
  });

  console.log(text);
}

main();
