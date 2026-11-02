import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile) redirect("/");

  return {
    id: claims.sub,
    email: claims.email ?? "unknown",
    role: profile.role as "ADMIN" | "AGENT",
    name: profile.full_name as string | null,
  };
}
