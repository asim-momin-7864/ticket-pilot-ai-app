"use client";

import { useActionState } from "react";
import { createTicketAction, type TicketFormState } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initial: TicketFormState = {};

export function TicketForm() {
  const [state, formAction, pending] = useActionState(createTicketAction, initial);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Raise a ticket</CardTitle>
        <CardDescription>
          Tell us what you need. Our team will review and reply.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={80} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required maxLength={120} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required minLength={3} maxLength={120} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              required
              minLength={10}
              maxLength={2000}
              rows={6}
            />
          </div>

          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Sending..." : "Raise Ticket"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
