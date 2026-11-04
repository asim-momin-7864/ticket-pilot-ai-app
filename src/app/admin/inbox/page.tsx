import Link from "next/link";
import { connection } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const instant = false;

const TABS = {
  review: { label: "Needs review", statuses: ["PENDING_REVIEW"] },
  escalated: { label: "Escalated", statuses: ["ESCALATED"] },
  replied: { label: "Replied", statuses: ["REPLIED", "RESOLVED"] },
  failed: { label: "Failed", statuses: ["FAILED"] },
} as const;
type TabKey = keyof typeof TABS;
const TAB_KEYS = Object.keys(TABS) as TabKey[];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  await requireStaff();
  const { tab } = await searchParams;
  const active: TabKey = tab && tab in TABS ? (tab as TabKey) : "review";

  const supabase = await createClient();
  const count = (k: TabKey) =>
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("status", [...TABS[k].statuses]);

  const [tickets, processing, review, escalated, replied, failed] =
    await Promise.all([
      supabase
        .from("tickets")
        .select(
          "id, ref, subject, customer_name, intent, department, priority, created_at",
        )
        .in("status", [...TABS[active].statuses])
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("tickets")
        .select("id, ref, subject, customer_name, created_at")
        .eq("status", "PROCESSING")
        .order("created_at", { ascending: false })
        .limit(20),
      count("review"),
      count("escalated"),
      count("replied"),
      count("failed"),
    ]);

  const counts: Record<TabKey, number> = {
    review: review.count ?? 0,
    escalated: escalated.count ?? 0,
    replied: replied.count ?? 0,
    failed: failed.count ?? 0,
  };
  const processingList = processing.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inbox</h1>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">
            AI processing tickets ({processingList.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            The AI takes 1 to 2 minutes for each ticket. This page does not auto-refresh — please refresh your browser after 1 to 2 minutes to check for updates.
          </p>
        </div>
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {processingList.map((t) => (
            <Card key={t.id} className="shadow-none border">
              <CardContent className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground font-mono tabular-nums">
                    {t.ref} · {t.customer_name}
                  </p>
                  <p className="truncate font-medium">{t.subject}</p>
                </div>
                <Badge variant="outline">Processing</Badge>
              </CardContent>
            </Card>
          ))}
          {processingList.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tickets are being processed right now.
            </p>
          )}
        </div>
      </section>

      <Separator />

      <div className="space-y-4">
        <nav className="flex flex-wrap gap-2">
          {TAB_KEYS.map((k) => (
            <Link
              key={k}
              href={`/admin/inbox?tab=${k}`}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                k === active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {TABS[k].label} ({counts[k]})
            </Link>
          ))}
        </nav>

        {tickets.error && (
          <p className="text-sm text-destructive">Could not load tickets.</p>
        )}

        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tickets.data ?? []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono tabular-nums">
                      <Link
                        href={`/admin/tickets/${t.id}`}
                        className="font-medium underline"
                      >
                        {t.ref}
                      </Link>
                    </TableCell>
                    <TableCell>{t.subject}</TableCell>
                    <TableCell>{t.customer_name}</TableCell>
                    <TableCell>{t.intent ?? "-"}</TableCell>
                    <TableCell>{t.department ?? "-"}</TableCell>
                    <TableCell>{t.priority ?? "-"}</TableCell>
                    <TableCell>
                      {t.created_at.slice(0, 16).replace("T", " ")}
                    </TableCell>
                  </TableRow>
                ))}
                {!tickets.data?.length && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      Nothing here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
