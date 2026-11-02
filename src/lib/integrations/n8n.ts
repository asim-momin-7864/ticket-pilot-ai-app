import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { OutboxItem } from "@/lib/agent/state";

const TIMEOUT_MS = 10_000;

type Result = { ok: boolean; preview?: boolean; error?: string };

async function post(
  path: string,
  payload: unknown,
  opts: { blockInDemo: boolean },
): Promise<Result> {
  if (opts.blockInDemo && process.env.DEMO_MODE === "true") {
    return { ok: true, preview: true };
  }
  const base = process.env.N8N_BASE_URL;
  const secret = process.env.N8N_SHARED_SECRET;
  if (!base || !secret) return { ok: false, error: "n8n is not configured" };

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shared-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `n8n returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Sends every outbox item through n8n and logs the result in ticket_events.
// It never throws, so a dead n8n cannot break review or escalation.
export async function dispatchOutbox(ticketId: string, outbox: OutboxItem[]) {
  const { data: ticket } = await supabaseAdmin
    .from("tickets")
    .select("ref, subject")
    .eq("id", ticketId)
    .single();
  const ref = ticket?.ref ?? "";
  const subject = ticket?.subject ?? "";
  const link = `${process.env.APP_BASE_URL ?? ""}/admin/tickets/${ticketId}`;

  for (const item of outbox) {
    const isEmail = item.kind === "email";

    const result = isEmail
      ? await post(
          "/webhook/send-email",
          {
            ticketId,
            ref,
            to: String(item.payload.to),
            subject: `Re: [${ref}] ${subject}`,
            body: String(item.payload.body),
          },
          { blockInDemo: true },
        )
      : await post(
          "/webhook/notify-slack",
          { ...item.payload, ref, link },
          { blockInDemo: false },
        );

    const type = result.ok
      ? isEmail
        ? result.preview
          ? "email_preview"
          : "email_sent"
        : "slack_posted"
      : isEmail
        ? "send_failed"
        : "notify_failed";

    await supabaseAdmin.from("ticket_events").insert({
      ticket_id: ticketId,
      type,
      actor: "system",
      payload: result.error ? { error: result.error } : {},
    });
  }
}
