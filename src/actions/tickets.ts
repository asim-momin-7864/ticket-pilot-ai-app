"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runTicket } from "@/lib/agent/run-ticket";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(100).optional(),
});

export type TicketFormState = {
  error?: string;
};

export async function createTicketAction(
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: "Please check the form: all fields are required.",
    };
  }
  const { name, email, subject, message, website } = parsed.data;

  // honeypot: bots fill the hidden field, so pretend it worked
  if (website) redirect("/support/new");

  const db = supabaseAdmin;

  // per-email limit: 5 tickets per hour
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("customer_email", email)
    .gte("created_at", since);
  if ((count ?? 0) >= 5) {
    return { error: "Too many tickets. Please try again later." };
  }

  const { data: ticket, error } = await db
    .from("tickets")
    .insert({ customer_name: name, customer_email: email, subject })
    .select("id, ref, public_token")
    .single();
  if (error || !ticket) {
    console.error("create ticket failed:", error?.message);
    return {
      error: "Could not create your ticket. Please try again.",
    };
  }

  await db.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_type: "customer",
    body: message,
  });
  await db.from("ticket_events").insert({
    ticket_id: ticket.id,
    type: "created",
    actor: "customer",
    payload: { channel: "web" },
  });

  after(() =>
    runTicket({ id: ticket.id, customerEmail: email, subject, body: message }),
  );

  redirect(`/support/${ticket.public_token}`);
}
