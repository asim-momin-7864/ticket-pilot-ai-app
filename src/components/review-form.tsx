"use client";

import { useActionState } from "react";
import { reviewTicketAction, type ReviewState } from "@/actions/review";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initial: ReviewState = { ok: false };

export function ReviewForm({
  ticketId,
  draft,
}: {
  ticketId: string;
  draft: string;
}) {
  const [state, action, pending] = useActionState(reviewTicketAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea
        name="text"
        defaultValue={draft}
        rows={12}
        className="min-h-[220px]"
      />
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="action"
          value="approve"
          disabled={pending}
          className="bg-success text-success-foreground hover:bg-success/90"
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="action"
          value="edit"
          variant="default"
          disabled={pending}
        >
          Edit and approve
        </Button>
        <Button
          type="submit"
          name="action"
          value="escalate"
          variant="destructive"
          disabled={pending}
        >
          Escalate
        </Button>
      </div>
      {pending && <p className="text-sm text-muted-foreground">Working...</p>}
    </form>
  );
}
