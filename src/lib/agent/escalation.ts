import type { Classification } from "./schemas";
import type { OutboxItem } from "./state";

const HOLDING_MESSAGE =
  "Thanks for contacting Orbitly. Our customer-care team will contact you about this request. " +
  "We have passed your message to them.\n\nOrbitly Support";

export function buildEscalationOutbox(input: {
  ticketId: string;
  customerEmail: string;
  subject: string;
  text: string;
  classification: Pick<
    Classification,
    "department" | "priority" | "intent" | "confidence"
  > | null;
  reason: string | null;
}): OutboxItem[] {
  const c = input.classification;
  return [
    {
      kind: "email",
      payload: {
        to: input.customerEmail,
        ticketId: input.ticketId,
        body: HOLDING_MESSAGE,
      },
    },
    {
      kind: "slack",
      payload: {
        ticketId: input.ticketId,
        department: c?.department ?? "customer_care",
        priority: c?.priority ?? "normal",
        reason: input.reason,
        summary: [
          `Subject: ${input.subject}`,
          `Intent: ${c?.intent ?? "unknown"} (confidence ${c?.confidence ?? 0})`,
          `Reason: ${input.reason}`,
          `Message: ${input.text.slice(0, 200)}`,
        ].join("\n"),
      },
    },
  ];
}
