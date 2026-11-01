import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { connection } from "next/server";

export async function SiteHeader() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isStaff = Boolean(data?.claims);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="text-base font-bold tracking-tight">
          TicketPilot
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {isStaff ? (
            <>
              <Link
                href="/admin"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Inbox
              </Link>
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Staff login
            </Link>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
