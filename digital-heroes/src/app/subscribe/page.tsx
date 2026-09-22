import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { PlanPicker } from "@/components/PlanPicker";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSubscription, needsPayment } from "@/lib/subscription";
import { formatDate } from "@/lib/utils";
import type { PlanKey } from "@/lib/config";

export const metadata: Metadata = { title: "Choose a plan" };

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const sp = await searchParams;
  const { user, profile } = await requireUser();
  const supabase = await createClient();
  const sub = await getSubscription(supabase, user.id);
  const { data: charity } = profile.charity_id
    ? await supabase.from("charities").select("name").eq("id", profile.charity_id).maybeSingle()
    : { data: null };

  if (!needsPayment(sub) && sub) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <PageTitle title="You're already subscribed">
          Your {sub.plan} plan is paid until {formatDate(sub.renewal_date)}. You can renew during its last 7 days.
        </PageTitle>
        <Link href="/dashboard" className="btn-primary">Go to your dashboard</Link>
      </div>
    );
  }

  const initial: PlanKey = sp.plan === "yearly" ? "yearly" : "monthly";
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <PageTitle title="Choose your plan">
        {profile.full_name ? `${profile.full_name.split(" ")[0]}, one` : "One"} last step. Pick how you want to pay and you&apos;ll be in
        this month&apos;s draw as soon as you&apos;ve logged five scores.
      </PageTitle>
      <PlanPicker initial={initial} charityName={charity?.name ?? "your charity"} percent={profile.charity_percent} />
    </div>
  );
}