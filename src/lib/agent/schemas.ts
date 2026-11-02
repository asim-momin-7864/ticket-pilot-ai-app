import { z } from "zod";
import { DEPARTMENTS, INTENTS, PRIORITIES } from "@/lib/constants";

export const classificationSchema = z.object({
  intent: z.enum(INTENTS),
  department: z.enum(DEPARTMENTS),
  priority: z.enum(PRIORITIES),
  confidence: z.number().min(0).max(1),
});

export type Classification = z.infer<typeof classificationSchema>;
export type Route = "ANSWER" | "ESCALATE";
export type GateResult = {
  route: Route;
  reason: string | null;
};
