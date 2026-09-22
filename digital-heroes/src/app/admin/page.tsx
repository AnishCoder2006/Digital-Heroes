import { PageTitle } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUpcomingPool } from "@/lib/pool";
import { hasAccess } from "@/lib/subscription";
import { feeBreakdown } from "@/lib/charity";
import { inr, inr2 } from "@/lib/config";
import type { Charity, Draw, Profile, Subscription, Winner } from "@/types/database";

export const dynamic = "force-dynamic";

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone: string }) {
  return (
    <div className={`rounded-panel p-6 ${tone}`}>
      <p className="font-semibold opacity-80">{label}</p>
      <p className="mt-1 font-display text-4xl font-extrabold">{value}</p>
      {note && <p className="mt-1 text-sm opacity-80">{note}</p>}
    </div>
  );
}

export default async function AdminReportsPage() {
  const admin = createAdminClient();
  const [profilesRes, subsRes, charitiesRes, donationsRes, drawsRes, winnersRes, pool] = await Promise.all([
    admin.from("profiles").select("id, charity_id, charity_percent"),
    admin.from("subscriptions").select("*"),
    admin.from("charities").select("id, name"),
    admin.from("donations").select("charity_id, amount"),
    admin.from("draws").select("*").order("month", { ascending: false }),
    admin.from("winners").select("*"),
    getUpcomingPool(),
  ]);

  const profiles = (profilesRes.data ?? []) as Pick<Profile, "id" | "charity_id" | "charity_percent">[];
  const subs = (subsRes.data ?? []) as Subscription[];
  const charities = (charitiesRes.data ?? []) as Pick<Charity, "id" | "name">[];
  const draws = (drawsRes.data ?? []) as Draw[];
  const winners = (winnersRes.data ?? []) as Winner[];
  const donations = (donationsRes.data ?? []) as { charity_id: string; amount: number }[];

  const activeSubs = subs.filter(hasAccess);
  const profileOf = new Map(profiles.map((p) => [p.id, p]));

  // Monthly charity income implied by current subscriptions, plus one-off donations.
  const perCharity = new Map<string, { monthly: number; donated: number }>();
  for (const s of activeSubs) {
    const p = profileOf.get(s.user_id);
    if (!p?.charity_id) continue;
    const row = perCharity.get(p.charity_id) ?? { monthly: 0, donated: 0 };
    row.monthly += feeBreakdown(s.plan, p.charity_percent).charity;
    perCharity.set(p.charity_id, row);
  }
  for (const d of donations) {
    const row = perCharity.get(d.charity_id) ?? { monthly: 0, donated: 0 };
    row.donated += Number(d.amount);
    perCharity.set(d.charity_id, row);
  }
  const charityRows = charities
    .map((c) => ({ name: c.name, ...(perCharity.get(c.id) ?? { monthly: 0, donated: 0 }) }))
    .sort((a, b) => b.monthly + b.donated - (a.monthly + a.donated));
  const totalMonthlyCharity = charityRows.reduce((s, r) => s + r.monthly, 0);
  const totalDonated = charityRows.reduce((s, r) => s + r.donated, 0);

  const totalPrizes = winners.reduce((s, w) => s + Number(w.prize_amount), 0);
  const totalPaid = winners.filter((w) => w.payment_status === "paid").reduce((s, w) => s + Number(w.prize_amount), 0);
  const currentJackpot = pool.base * 0.4 + pool.carryover;

  return (
    <div className="space-y-8">
      <PageTitle title="Reports">A live view of users, prize money and charity contributions.</PageTitle>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total users" value={String(profiles.length)} note={`${activeSubs.length} with an active plan`} tone="bg-violet text-white" />
        <Stat label="Prize pool this month" value={inr(pool.base + pool.carryover)} note={`Jackpot ${inr(currentJackpot)}`} tone="bg-marigold" />
        <Stat label="Charity per month" value={inr(totalMonthlyCharity)} note={`Plus ${inr(totalDonated)} in donations`} tone="bg-rose" />
        <Stat label="Prizes paid out" value={inr2(totalPaid)} note={`${inr2(totalPrizes)} won in total`} tone="bg-mint" />
      </div>

      <section className="panel">
        <h2 className="text-xl font-bold">Charity contribution totals</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left">
            <thead className="text-sm text-ink-soft">
              <tr><th className="py-2 pr-4 font-semibold">Charity</th><th className="py-2 pr-4 font-semibold">Per month (subscriptions)</th><th className="py-2 font-semibold">One-off donations</th></tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {charityRows.map((r) => (
                <tr key={r.name}><td className="py-3 pr-4 font-semibold">{r.name}</td><td className="py-3 pr-4">{inr2(r.monthly)}</td><td className="py-3">{inr2(r.donated)}</td></tr>
              ))}
              {charityRows.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-ink-soft">No charities yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="text-xl font-bold">Draw statistics</h2>
        {draws.length === 0 ? (
          <p className="mt-3 text-ink-soft">No draws published yet. Run one from the Draws page.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="text-sm text-ink-soft">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Month</th><th className="py-2 pr-4 font-semibold">Mode</th><th className="py-2 pr-4 font-semibold">Entries</th>
                  <th className="py-2 pr-4 font-semibold">Winners</th><th className="py-2 pr-4 font-semibold">Pool</th><th className="py-2 font-semibold">Rolled over</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {draws.map((d) => (
                  <tr key={d.id}>
                    <td className="py-3 pr-4 font-semibold">{new Date(d.month).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</td>
                    <td className="py-3 pr-4 capitalize">{d.mode}</td>
                    <td className="py-3 pr-4">{d.subscriber_count}</td>
                    <td className="py-3 pr-4">{winners.filter((w) => w.draw_id === d.id).length}</td>
                    <td className="py-3 pr-4">{inr2(Number(d.pool_base) + Number(d.jackpot_carryover_in))}</td>
                    <td className="py-3">{inr2(Number(d.jackpot_carryover_out))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
