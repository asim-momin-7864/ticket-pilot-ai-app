import Link from "next/link";
import { requireStaff } from "@/lib/require-staff";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  processing: { label: "Processing", statuses: ["PROCESSING"] },
  replied: { label: "Replied", statuses: ["REPLIED", "RESOLVED"] },
  failed: { label: "Failed", statuses: ["FAILED"] },
} as const;
type TabKey = keyof typeof TABS;

function getPriorityBadgeVariant(
  priority: string | null,
): "destructive" | "warning" | "outline" | "secondary" {
  switch (priority?.toLowerCase()) {
    case "urgent":
    case "high":
      return "destructive";
    case "medium":
      return "warning";
    case "low":
      return "secondary";
    default:
      return "outline";
  }
}

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
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select(
      "id, ref, subject, customer_name, intent, department, priority, status, created_at",
    )
    .in("status", [...TABS[active].statuses])
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Inbox{" "}
        <span className="text-base font-normal text-muted-foreground">
          · {TABS[active].label} ({tickets?.length ?? 0})
        </span>
      </h1>

      <nav className="flex flex-wrap gap-2">
        {(Object.keys(TABS) as TabKey[]).map((k) => (
          <Link
            key={k}
            href={`/admin/inbox?tab=${k}`}
            className={buttonVariants({
              variant: k === active ? "default" : "outline",
              size: "sm",
            })}
          >
            {TABS[k].label}
            {k === active ? ` (${tickets?.length ?? 0})` : ""}
          </Link>
        ))}
      </nav>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Could not load tickets.</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Ref</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tickets ?? []).map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono tabular-nums">
                    <Link
                      href={`/admin/tickets/${t.id}`}
                      className="font-medium underline hover:text-primary transition-colors"
                    >
                      {t.ref}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/tickets/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.subject}
                    </Link>
                  </TableCell>
                  <TableCell>{t.customer_name}</TableCell>
                  <TableCell>
                    {t.intent ? (
                      <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                        {t.intent}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.department ? (
                      <Badge variant="secondary">{t.department}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.priority ? (
                      <Badge variant={getPriorityBadgeVariant(t.priority)}>
                        {t.priority}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {t.created_at.slice(0, 16).replace("T", " ")}
                  </TableCell>
                </TableRow>
              ))}
              {!tickets?.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nothing here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
