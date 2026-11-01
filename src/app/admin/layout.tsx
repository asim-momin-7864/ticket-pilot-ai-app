import { Suspense } from "react";
import { connection } from "next/server";
import { requireStaff } from "@/lib/require-staff";

async function AdminShell({ children }: { children: React.ReactNode }) {
  await connection();
  await requireStaff();
  return <div className="...">{children}</div>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
