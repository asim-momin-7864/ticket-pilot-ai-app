import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildGraph } from "./graph";
import { normalize } from "./normalize";
import { dispatchOutbox } from "@/lib/integrations/n8n";

type Db = typeof supabaseAdmin;

async function setStatus(
  db: Db,
  ticketId: string,
  status: string,
  eventType: string,
  payload: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  await db
    .from("tickets")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", ticketId);
  await db
    .from("ticket_events")
    .insert({ ticket_id: ticketId, type: eventType, actor: "system", payload });
}

export async function runTicket(t: {
  id: string;
  customerEmail: string;
  subject: string;
  body: string;
}) {
  const db = supabaseAdmin;
  const started = Date.now();

  try {
    await setStatus(db, t.id, "PROCESSING", "run_started", {
      model: process.env.LLM_MODEL ?? null,
    });

    const { text } = normalize(t.body);
    const v = await buildGraph({ db }).invoke({
      ticketId: t.id,
      customerEmail: t.customerEmail,
      subject: t.subject,
      rawText: t.body,
      text,
      route: null,
      escalationReason: null,
      classification: null,
      docs: [],
      draft: null,
    });

    const c = v.classification;
    const classFields = c
      ? {
          intent: c.intent,
          department: c.department,
          priority: c.priority,
          confidence: c.confidence,
        }
      : {};
    const latency_ms = Date.now() - started;

    if (v.route === "ESCALATE") {
      if (v.escalationReason === "no_kb_coverage") {
        await db.from("ticket_events").insert({
          ticket_id: t.id,
          type: "kb_gap",
          actor: "system",
          payload: {
            query: `${t.subject}\n${text}`.slice(0, 300),
            intent: c?.intent ?? null,
          },
        });
      }
      await setStatus(
        db,
        t.id,
        "ESCALATED",
        "escalated",
        { reason: v.escalationReason, outbox: v.outbox, latency_ms },
        { ...classFields, escalation_reason: v.escalationReason },
      );
      await dispatchOutbox(t.id, v.outbox);
      return;
    }

    if (!v.draft) throw new Error("graph finished without a draft");

    await db.from("ticket_messages").insert({
      ticket_id: t.id,
      author_type: "ai_draft",
      body: v.draft.body,
      status: "draft",
      sources: (v.docs ?? []).map((d) => ({
        id: d.id,
        title: d.article_title,
        section: d.heading,
      })),
    });
    await setStatus(
      db,
      t.id,
      "PENDING_REVIEW",
      "draft_ready",
      {
        confidence: v.draft.confidence,
        citations: v.draft.citations,
        latency_ms,
      },
      classFields,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("runTicket failed:", message);
    await setStatus(db, t.id, "FAILED", "run_failed", {
      error: message.slice(0, 300),
      latency_ms: Date.now() - started,
    });
  }
}
