import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Charity } from "@/types/database";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ charity?: string }> }) {
  const sp = await searchParams;
  if (await getUser()) redirect("/subscribe");
  const { data } = await (await createClient()).from("charities").select("*").order("featured", { ascending: false }).order("name");
  return (
    <AuthShell title="Create your account" intro="Pick your charity now. You'll choose a plan on the next step.">
      <SignupForm charities={(data ?? []) as Charity[]} preselected={sp.charity} />
    </AuthShell>
  );
}