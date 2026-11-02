import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { RefreshButton } from "./refresh-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STEPS = ["Received", "Analyzing", "Escalated", "Replied"];
const STEP_BY_STATUS: Record<string, number> = {
  PROCESSING: 1,
  PENDING_REVIEW: 1,
  FAILED: 1,
  ESCALATED: 2,
  REPLIED: 3,
  RESOLVED: 3,
};

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: "Analyzing",
  PENDING_REVIEW: "Analyzing",
  FAILED: "Analyzing",
  ESCALATED: "Escalated",
  REPLIED: "Replied",
  RESOLVED: "Replied",
};

function getStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" {
  switch (status) {
    case "PENDING_REVIEW":
      return "warning";
    case "ESCALATED":
    case "FAILED":
      return "destructive";
    case "REPLIED":
    case "RESOLVED":
      return "success";
    case "PROCESSING":
      return "info";
    default:
      return "outline";
  }
}

async function Status({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!z.string().uuid().safeParse(token).success) notFound();

  const { data: ticket } = await supabaseAdmin
    .from("tickets")
    .select("id, ref, subject, status")
    .eq("public_token", token)
    .maybeSingle();
  if (!ticket) notFound();

  const { data: messages } = await supabaseAdmin
    .from("ticket_messages")
    .select("id, author_type, body, created_at")
    .eq("ticket_id", ticket.id)
    .eq("status", "sent")
    .order("created_at");

  const step = STEP_BY_STATUS[ticket.status] ?? 1;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/support/my-tickets"
          className="inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to My Tickets
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-mono text-muted-foreground tabular-nums">
              {ticket.ref}
            </span>
            <Badge variant={getStatusBadgeVariant(ticket.status)}>
              {STATUS_LABEL[ticket.status] ?? ticket.status}
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
            {ticket.subject}
          </h1>
        </div>
        <div className="shrink-0">
          <RefreshButton />
        </div>
      </header>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STEPS.map((label, i) => {
          let stepStyle = "bg-muted text-muted-foreground border-transparent";
          if (i < step) {
            stepStyle = "bg-primary text-primary-foreground border-primary";
          } else if (i === step) {
            stepStyle = "bg-info/15 text-info border-info/40 font-semibold";
          }
          return (
            <li
              key={label}
              className={`rounded-lg px-3 py-3 text-center text-sm font-medium border ${stepStyle}`}
            >
              {label}
            </li>
          );
        })}
      </ol>

      {ticket.status === "ESCALATED" && (
        <Alert className="border-warning/40 bg-warning/10 text-foreground p-4 text-sm leading-relaxed">
          <AlertDescription>
            <strong className="text-warning font-medium">Escalated:</strong> Our customer-care team
            is actively reviewing your request and will contact you directly.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Conversation</h2>
        <div className="space-y-4">
          {(messages ?? []).map((m) => {
            const isCustomer = m.author_type === "customer";
            return (
              <Card
                key={m.id}
                className={
                  isCustomer
                    ? "bg-muted/50 border-border p-5 sm:p-6"
                    : "bg-primary/5 border-primary/20 p-5 sm:p-6"
                }
              >
                <CardContent className="p-0">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {isCustomer ? "You" : "Orbitly Support"}
                  </p>
                  <p className="text-base leading-7 whitespace-pre-wrap">{m.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function StatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
        <Status params={params} />
      </Suspense>
    </main>
  );
}
