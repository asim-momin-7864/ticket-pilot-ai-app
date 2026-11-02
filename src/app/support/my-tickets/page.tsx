import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: "Analyzing",
  PENDING_REVIEW: "Analyzing",
  FAILED: "Analyzing",
  ESCALATED: "Escalated",
  REPLIED: "Replied",
  RESOLVED: "Replied",
};

async function TicketList() {
  await connection();
  const { data: tickets } = await supabaseAdmin
    .from("tickets")
    .select("ref, subject, status, created_at, public_token")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!tickets?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No tickets yet. <Link href="/support/new" className="underline">Raise a ticket</Link>
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {tickets.map((t) => (
        <li key={t.public_token}>
          <Link href={`/support/${t.public_token}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground tabular-nums">{t.ref}</p>
                  <p className="truncate text-lg font-medium">{t.subject}</p>
                </div>
                <Badge variant="outline">{STATUS_LABEL[t.status] ?? t.status}</Badge>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function MyTicketsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">My Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Recent tickets. Open one to see its status and replies. This is a demo with dummy data.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm">Loading...</p>}>
        <TicketList />
      </Suspense>
    </main>
  );
}
