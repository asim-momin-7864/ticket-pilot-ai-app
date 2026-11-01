import { z } from "zod";
import { DEPARTMENTS, SERVICES } from "@/lib/constants";

export const INTENTS = [
  "HOW_TO",
  "ERROR",
  "BILLING_QUESTION",
  "REFUND",
  "CANCELLATION",
  "PERSONAL_DATA",
  "BUG_REPORT",
  "SECURITY",
  "LEGAL",
  "OTHER",
] as const;

export const classificationSchema = z.object({
  intent: z.enum(INTENTS),
  department: z.enum(DEPARTMENTS),
  service: z.enum(SERVICES),
  priority: z.enum(["low", "medium", "high"]),
  isServiceIssue: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type Classification = z.infer<typeof classificationSchema>;
export type Route = "ANSWER" | "ESCALATE" | "SPAM";
export type GateResult = {
  route: "ANSWER" | "ESCALATE";
  reason: string | null;
};
