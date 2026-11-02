import Link from "next/link";
import { connection } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export const instant = false;

const OPEN = ["PROCESSING", "PENDING_REVIEW", "ESCALATED", "FAILED"];

const OUTCOME_LABEL: Record<string, string> = {
  approved: "Approved as is",
  edited: "Edited, then approved",
  escalated: "Escalated by reviewer",
};

export default async function AdminHome() {
  await connection();
  await requireStaff();
  const supabase = await createClient();

  const count = (statuses: string[]) =>
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("status", statuses);

  const [open, review, escalated, replied, byDept, outcomes] =
    await Promise.all([
      count(OPEN),
      count(["PENDING_REVIEW"]),
      count(["ESCALATED"]),
      count(["REPLIED", "RESOLVED"]),
      supabase
        .from("dashboard_by_department")
        .select("department, total, open")
        .order("total", { ascending: false }),
      supabase
        .from("dashboard_review_outcomes")
        .select("outcome, total")
        .order("total", { ascending: false }),
    ]);

  const kpis = [
    {
      label: "Open tickets",
      value: open.count ?? 0,
      href: "/admin/inbox?tab=review",
      borderClass: "border-l-4 border-l-info",
      textClass: "text-info",
    },
    {
      label: "Pending review",
      value: review.count ?? 0,
      href: "/admin/inbox?tab=review",
      borderClass: "border-l-4 border-l-warning",
      textClass: "text-warning",
    },
    {
      label: "Escalated",
      value: escalated.count ?? 0,
      href: "/admin/inbox?tab=escalated",
      borderClass: "border-l-4 border-l-destructive",
      textClass: "text-destructive",
    },
    {
      label: "Replied",
      value: replied.count ?? 0,
      href: "/admin/inbox?tab=replied",
      borderClass: "border-l-4 border-l-success",
      textClass: "text-success",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="group block focus:outline-none">
            <Card className={`transition-colors hover:border-primary/50 ${k.borderClass}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {k.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-semibold tracking-tight ${k.textClass}`}>{k.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tickets by department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(byDept.data ?? []).map((d) => (
                    <TableRow key={d.department}>
                      <TableCell className="font-medium">{d.department}</TableCell>
                      <TableCell>{d.total}</TableCell>
                      <TableCell>{d.open}</TableCell>
                    </TableRow>
                  ))}
                  {!byDept.data?.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        No tickets yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI review outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(outcomes.data ?? []).map((o) => (
                    <TableRow key={o.outcome}>
                      <TableCell className="font-medium">
                        {OUTCOME_LABEL[o.outcome] ?? o.outcome}
                      </TableCell>
                      <TableCell>{o.total}</TableCell>
                    </TableRow>
                  ))}
                  {!outcomes.data?.length && (
                    <TableRow>
                      <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                        No reviews yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
