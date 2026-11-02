import { Annotation } from "@langchain/langgraph";
import type { Classification, Route } from "./schemas";
import type { Doc } from "./retrieve";
import type { Draft } from "./draft";

export type OutboxItem = {
  kind: "email" | "slack";
  payload: Record<string, unknown>;
};

export const TicketState = Annotation.Root({
  ticketId: Annotation<string>(),
  customerEmail: Annotation<string>(),
  subject: Annotation<string>(),
  rawText: Annotation<string>(),
  text: Annotation<string>(),
  route: Annotation<Route | null>(),
  escalationReason: Annotation<string | null>(),
  classification: Annotation<Classification | null>(),
  docs: Annotation<Doc[]>(),
  draft: Annotation<Draft | null>(),
  outbox: Annotation<OutboxItem[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
});
export type TState = typeof TicketState.State;
