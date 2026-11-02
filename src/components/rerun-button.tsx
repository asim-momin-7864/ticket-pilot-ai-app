"use client";

import { useState, useTransition } from "react";
import { rerunTicketAction } from "@/actions/review";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RerunButton({ ticketId }: { ticketId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await rerunTicketAction(ticketId);
            setError(res.ok ? null : (res.error ?? "Failed."));
          })
        }
      >
        {pending ? "Starting..." : "Re-run"}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
