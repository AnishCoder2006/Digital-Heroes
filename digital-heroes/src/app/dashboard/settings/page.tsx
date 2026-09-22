import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { DonateForm } from "@/components/dashboard/DonateForm";
import { CancelButton } from "@/components/dashboard/CancelButton";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { formatDate } from "@/lib/utils";
import type { Charity } from "@/types/database";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await requireUser();
  const supabase = await createClient();
  const [sub, { data }] = await Promise.all([
    getSubscription(supabase, user.id),
    supabase.from("charities").select("*").order("featured", { ascending: false }).order("name"),
  ]);
  const charities = (data ?? []) as Charity[];

  return (
    <div className="space-y-6">
      <PageTitle title="Settings">Update your details, change your charity, or make a one-off donation.</PageTitle>

      <section className="panel">
        <h2 className="mb-6 text-xl font-bold">Profile and charity</h2>
        <ProfileForm charities={charities} fullName={profile.full_name} charityId={profile.charity_id} percent={profile.charity_percent} plan={sub?.plan ?? "monthly"} />
      </section>

      <section id="donate" className="panel scroll-mt-28">
        <h2 className="text-xl font-bold">Make a donation</h2>
        <p className="mb-6 mt-1 text-ink-soft">Give extra to a charity, on top of your subscription. It doesn&apos;t affect the draw.</p>
        <DonateForm charities={charities} defaultCharityId={profile.charity_id} />
      </section>

      <section className="panel">
        <h2 className="text-xl font-bold">Subscription</h2>
        {sub?.status === "active" ? (
          <>
            <p className="mb-5 mt-1 text-ink-soft">Your {sub.plan} plan is paid until {formatDate(sub.renewal_date)}. If you cancel, you keep access until then. You can renew from the plans page in the last 7 days.</p>
            <CancelButton />
          </>
        ) : (
          <p className="mt-1 text-ink-soft">
            {sub?.status === "cancelled" ? `Your plan ends on ${formatDate(sub.renewal_date)}. ` : "You don't have an active plan. "}
            <Link href="/subscribe" className="font-semibold text-violet hover:underline">See plans</Link>
          </p>
        )}
      </section>
    </div>
  );
}
