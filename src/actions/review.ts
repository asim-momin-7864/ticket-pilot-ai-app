"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/require-staff";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildEscalationOutbox } from "@/lib/agent/escalation";
import { runTicket } from "@/lib/agent/run-ticket";
import { dispatchOutbox } from "@/lib/integrations/n8n";

const schema = z.object({
  ticketId: z.string().uuid(),
  action: z.enum(["approve", "edit", "escalate"]),
  text: z.string().max(5000).optional(),
});

export type ReviewState = { ok: boolean; error?: string };

export async function reviewTicketAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const staff = await requireStaff();
  const actor = staff.email ?? "staff";

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { ticketId, action, text } = parsed.data;

  if (action === "edit" && !text?.trim()) {
    return { ok: false, error: "The edited reply is empty." };
  }

  const db = supabaseAdmin;
  const now = () => new Date().toISOString();

  const { data: ticket } = await db
    .from("tickets")
    .select("customer_email, subject, intent, department, priority, confidence")
    .eq("id", ticketId)
    .single();
  if (!ticket) return { ok: false, error: "Ticket not found." };

  if (action === "escalate") {
    const { data: first } = await db
      .from("ticket_messages")
      .select("body")
      .eq("ticket_id", ticketId)
      .eq("author_type", "customer")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const { data: claimed } = await db
      .from("tickets")
      .update({
        status: "ESCALATED",
        escalation_reason: "reviewer_escalated",
        updated_at: now(),
      })
      .eq("id", ticketId)
      .eq("status", "PENDING_REVIEW")
      .select("id");
    if (!claimed?.length) {
      return { ok: false, error: "This ticket is not waiting for review." };
    }

    const outbox = buildEscalationOutbox({
      ticketId,
      customerEmail: ticket.customer_email,
      subject: ticket.subject,
      text: first?.body ?? "",
      classification:
        ticket.department && ticket.priority
          ? {
              department: ticket.department,
              priority: ticket.priority,
              intent: ticket.intent ?? "OTHER",
              confidence: ticket.confidence ?? 0,
            }
          : null,
      reason: "reviewer_escalated",
    });
    await db.from("ticket_events").insert({
      ticket_id: ticketId,
      type: "escalated",
      actor,
      payload: { reason: "reviewer_escalated", outbox },
    });
    after(() => dispatchOutbox(ticketId, outbox));
  } else {
    const { data: draft } = await db
      .from("ticket_messages")
      .select("id, body")
      .eq("ticket_id", ticketId)
      .eq("author_type", "ai_draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!draft) return { ok: false, error: "No draft found for this ticket." };

    const body = action === "edit" ? text!.trim() : draft.body;

    // claim first so a double click cannot reply twice
    const { data: claimed } = await db
      .from("tickets")
      .update({ status: "REPLIED", updated_at: now() })
      .eq("id", ticketId)
      .eq("status", "PENDING_REVIEW")
      .select("id");
    if (!claimed?.length) {
      return { ok: false, error: "This ticket is not waiting for review." };
    }

    const { error } = await db.from("ticket_messages").insert({
      ticket_id: ticketId,
      author_type: "staff",
      body,
      status: "sent",
    });
    if (error) {
      await db
        .from("tickets")
        .update({ status: "PENDING_REVIEW", updated_at: now() })
        .eq("id", ticketId);
      return { ok: false, error: "Could not save the reply. Try again." };
    }

    await db.from("ticket_events").insert({
      ticket_id: ticketId,
      type: action === "edit" ? "edited" : "approved",
      actor,
      payload: { draft_message_id: draft.id },
    });
    after(() =>
      dispatchOutbox(ticketId, [
        {
          kind: "email",
          payload: { to: ticket.customer_email, ticketId, body },
        },
      ]),
    );
  }

  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/tickets/${ticketId}`);
  return { ok: true };
}

export async function rerunTicketAction(
  ticketId: string,
): Promise<ReviewState> {
  const staff = await requireStaff();
  if (!z.string().uuid().safeParse(ticketId).success) {
    return { ok: false, error: "Invalid ticket." };
  }
  const db = supabaseAdmin;

  const { data: claimed } = await db
    .from("tickets")
    .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("status", "FAILED")
    .select("customer_email, subject");
  if (!claimed?.length) {
    return { ok: false, error: "Only FAILED tickets can be re-run." };
  }

  const { data: first } = await db
    .from("ticket_messages")
    .select("body")
    .eq("ticket_id", ticketId)
    .eq("author_type", "customer")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  await db.from("ticket_events").insert({
    ticket_id: ticketId,
    type: "rerun_requested",
    actor: staff.email ?? "staff",
    payload: {},
  });

  after(() =>
    runTicket({
      id: ticketId,
      customerEmail: claimed[0].customer_email,
      subject: claimed[0].subject,
      body: first?.body ?? "",
    }),
  );

  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/tickets/${ticketId}`);
  return { ok: true };
}
