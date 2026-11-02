"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOutAction } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";

export function SiteHeader({ themeToggle }: { themeToggle?: ReactNode }) {
  const isAdmin = usePathname().startsWith("/admin");

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4 sm:px-6 text-sm">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Link href={isAdmin ? "/admin/inbox" : "/"} className="font-semibold text-primary hover:text-primary/90 transition-colors">
            TicketPilot AI
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-muted-foreground">
            {isAdmin ? (
              <>
                <Link href="/admin/inbox" className="hover:text-foreground transition-colors">
                  Inbox
                </Link>
                <Link href="/admin" className="hover:text-foreground transition-colors">
                  Overview
                </Link>
              </>
            ) : (
              <>
                <Link href="/support/new" className="hover:text-foreground transition-colors">
                  Raise Ticket
                </Link>
                <Link href="/support/my-tickets" className="hover:text-foreground transition-colors">
                  My Tickets
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          ) : (
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Staff login
            </Link>
          )}
          {themeToggle}
        </div>
      </div>
    </header>
  );
}
