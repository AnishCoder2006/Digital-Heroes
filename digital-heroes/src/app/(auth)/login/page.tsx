import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  // Only allow same-site redirects.
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  if (await getUser()) redirect(next);
  return (
    <AuthShell title="Welcome back" intro="Log in to update your scores and see your draws.">
      <LoginForm next={next} />
    </AuthShell>
  );
}