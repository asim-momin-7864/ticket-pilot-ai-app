import { StateGraph, START, END } from "@langchain/langgraph";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TicketState, type TState } from "./state";
import { classify } from "./classify";
import { policyGate, coverageGate } from "./policy";
import { retrieve } from "./retrieve";
import { draftAnswer } from "./draft";
import { buildEscalationOutbox } from "./escalation";

export function buildGraph(deps: { db: SupabaseClient }) {
  const { db } = deps;

  const classifyNode = async (s: TState) => ({
    classification: await classify(s.subject, s.text),
  });

  const gateNode = (s: TState) => {
    const g = policyGate(s.classification!, s.text);
    return { route: g.route, escalationReason: g.reason };
  };

  const retrieveNode = async (s: TState) => {
    const docs = await retrieve(db, `${s.subject}\n${s.text}`);
    const cov = coverageGate(docs.length);
    return cov.route === "ESCALATE"
      ? { docs, route: "ESCALATE" as const, escalationReason: cov.reason }
      : { docs };
  };

  const draftNode = async (s: TState) => {
    const d = await draftAnswer({ text: s.text, docs: s.docs });
    if (!d)
      return { route: "ESCALATE" as const, escalationReason: "draft_failed" };
    if (!d.sufficient)
      return { route: "ESCALATE" as const, escalationReason: "no_kb_coverage" };
    return { draft: d };
  };

  const escalateNode = (s: TState) => ({
    route: "ESCALATE" as const,
    outbox: buildEscalationOutbox({
      ticketId: s.ticketId,
      customerEmail: s.customerEmail,
      subject: s.subject,
      text: s.text,
      classification: s.classification,
      reason: s.escalationReason,
    }),
  });

  return new StateGraph(TicketState)
    .addNode("classify_ticket", classifyNode)
    .addNode("policy_gate", gateNode)
    .addNode("retrieve_docs", retrieveNode)
    .addNode("draft_answer", draftNode)
    .addNode("escalate", escalateNode)
    .addEdge(START, "classify_ticket")
    .addEdge("classify_ticket", "policy_gate")
    .addConditionalEdges("policy_gate", (s) =>
      s.route === "ESCALATE" ? "escalate" : "retrieve_docs",
    )
    .addConditionalEdges("retrieve_docs", (s) =>
      s.route === "ESCALATE" ? "escalate" : "draft_answer",
    )
    .addConditionalEdges("draft_answer", (s) =>
      s.route === "ESCALATE" ? "escalate" : END,
    )
    .addEdge("escalate", END)
    .compile();
}
