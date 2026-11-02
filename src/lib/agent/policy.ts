import type { Classification, GateResult } from "./schemas";
import { RISKY_INTENTS } from "@/lib/constants";

export { RISKY_INTENTS };
export const MIN_CONFIDENCE = 0.5;

const ACCOUNT_SPECIFIC =
  /\b(my (invoice|order|payment|subscription|account balance)|i was charged|charged twice|my card)\b/i;
const WANTS_HUMAN =
  /\b(talk to (a )?(human|person|agent)|speak to (a )?(human|person|agent)|real person|human agent)\b/i;

export function policyGate(c: Classification, text: string): GateResult {
  if (RISKY_INTENTS.includes(c.intent)) {
    return { route: "ESCALATE", reason: `risky_intent:${c.intent}` };
  }
  if (ACCOUNT_SPECIFIC.test(text)) {
    return { route: "ESCALATE", reason: "account_specific" };
  }
  if (WANTS_HUMAN.test(text)) {
    return { route: "ESCALATE", reason: "asked_for_human" };
  }
  if (c.confidence < MIN_CONFIDENCE) {
    return { route: "ESCALATE", reason: "low_confidence" };
  }
  return { route: "ANSWER", reason: null };
}

// runs after retrieval
export function coverageGate(relevantDocs: number): GateResult {
  return relevantDocs > 0
    ? { route: "ANSWER", reason: null }
    : { route: "ESCALATE", reason: "no_kb_coverage" };
}
