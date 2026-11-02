import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4 py-8 sm:p-6 sm:py-12">
      {/* Hero Block */}
      <div className="rounded-2xl border bg-card p-6 sm:p-10 text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
          TicketPilot AI
        </h1>
        <p className="mx-auto max-w-xl text-sm sm:text-base text-muted-foreground">
          An AI-assisted support desk for Orbitly, a fictional SaaS. An agent
          drafts a cited answer, and a human approves it before anything is
          sent. Risky requests such as refunds go straight to a person.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/support/new"
            className={buttonVariants({ variant: "default" })}
          >
            Raise Ticket
          </Link>
          <Link
            href="/support/my-tickets"
            className={buttonVariants({ variant: "outline" })}
          >
            My Tickets
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">How it works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                1
              </div>
              <CardTitle className="text-base font-medium">
                Raise a ticket
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Submit your request without creating an account. View status and
                replies on My Tickets.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                2
              </div>
              <CardTitle className="text-base font-medium">
                AI drafts a reply
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The agent retrieves knowledge base playbooks and generates a
                proposed cited reply.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                3
              </div>
              <CardTitle className="text-base font-medium">
                A human approves it
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Support staff reviews, edits, or approves drafts before anything
                is sent to the customer.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
