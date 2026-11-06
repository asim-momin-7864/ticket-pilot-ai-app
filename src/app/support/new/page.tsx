import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketForm } from "@/components/ticket-form";

export const maxDuration = 300;

export default function NewTicketPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TicketForm />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Tips for a faster answer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ul className="list-disc pl-4 space-y-2">
                <li>
                  <strong className="text-foreground font-medium">Include your plan:</strong> mention whether you are on Free, Pro, or Enterprise.
                </li>
                <li>
                  <strong className="text-foreground font-medium">What you tried:</strong> describe the steps you took before running into the issue.
                </li>
                <li>
                  <strong className="text-foreground font-medium">Any error text:</strong> copy and paste exact error codes or warning messages.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-info/30 bg-info/5">
            <CardContent className="p-4 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground font-medium">No account required:</strong> you will be taken directly to your ticket once raised.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
