import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/require-staff";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "@/components/review-form";
import { RerunButton } from "@/components/rerun-button";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const instant = false;

type Source = { id: string; title: string; section: string };

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

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  await requireStaff();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [t, m, e] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, ref, subject, customer_name, customer_email, status, intent, department, priority, confidence, escalation_reason, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("ticket_messages")
      .select("id, author_type, body, status, sources, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ticket_events")
      .select("type, actor, payload, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const ticket = t.data;
  if (!ticket) notFound();
  const messages = m.data ?? [];
  const events = e.data ?? [];

  const conversation = messages.filter((x) => x.author_type !== "ai_draft");
  const latestDraft = [...messages]
    .reverse()
    .find((x) => x.author_type === "ai_draft");
  const sources = (latestDraft?.sources ?? []) as Source[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/inbox"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to inbox
        </Link>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-muted-foreground tabular-nums">{ticket.ref}</span>
          <Badge variant={getStatusBadgeVariant(ticket.status)}>
            {ticket.status}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight tabular-nums">
          {ticket.subject}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ticket.customer_name} ({ticket.customer_email})
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversation.map((c) => {
                const isCustomer = c.author_type === "customer";
                return (
                  <div
                    key={c.id}
                    className={`rounded-lg border p-3 space-y-1 ${
                      isCustomer
                        ? "bg-muted/50 border-border"
                        : "bg-primary/10 border-primary/30"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        isCustomer ? "text-muted-foreground" : "text-primary"
                      }`}
                    >
                      {c.author_type}
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                );
              })}
              {!conversation.length && (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent trace</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 font-mono text-xs">
                {events.map((ev, i) => {
                  const note = ev.payload?.reason ?? ev.payload?.error;
                  return (
                    <li key={i} className="text-muted-foreground">
                      <span>{ev.created_at.slice(11, 19)}</span> ·{" "}
                      <span className="font-semibold text-foreground">{ev.type}</span>
                      {note ? ` (${String(note)})` : ""}
                    </li>
                  );
                })}
                {!events.length && (
                  <li className="font-sans text-sm text-muted-foreground">No events recorded.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>AI panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {ticket.intent && (
                  <Badge variant="info">
                    {ticket.intent}
                  </Badge>
                )}
                {ticket.department && <Badge variant="secondary">{ticket.department}</Badge>}
                {ticket.priority && (
                  <Badge
                    variant={
                      ticket.priority === "urgent" || ticket.priority === "high"
                        ? "destructive"
                        : ticket.priority === "medium"
                          ? "warning"
                          : "outline"
                    }
                  >
                    {ticket.priority}
                  </Badge>
                )}
                {ticket.confidence != null && (
                  <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                    confidence {ticket.confidence}
                  </Badge>
                )}
              </div>

              {ticket.escalation_reason && (
                <Alert className="border-warning/40 bg-warning/10 text-foreground">
                  <AlertDescription className="text-sm">
                    <strong className="text-warning font-medium">Escalated:</strong>{" "}
                    {ticket.escalation_reason}
                  </AlertDescription>
                </Alert>
              )}

              {sources.length > 0 && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Retrieved Sources</p>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {sources.map((s) => (
                      <li key={s.id}>
                        <span className="font-medium text-foreground">{s.title}</span> / {s.section}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ticket.status === "PENDING_REVIEW" && latestDraft ? (
                <ReviewForm ticketId={ticket.id} draft={latestDraft.body} />
              ) : ticket.status === "FAILED" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    The AI run failed. See the agent trace for the error.
                  </p>
                  <RerunButton ticketId={ticket.id} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No review needed for this ticket.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
