import type { Metadata } from "next";
import { DrawConsole } from "@/components/admin/DrawConsole";
import { NumberBall, PageTitle } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { inr2 } from "@/lib/config";
import { formatMonth } from "@/lib/utils";
import type { Draw } from "@/types/database";

export const metadata: Metadata = { title: "Draws" };
export const dynamic = "force-dynamic";

export default async function AdminDrawsPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("draws").select("*").order("month", { ascending: false });
  const draws = (data ?? []) as Draw[];
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-8">
      <PageTitle title="Draws">Choose the draw logic, simulate the result, then publish it. Nothing is saved until you publish.</PageTitle>
      <DrawConsole defaultMonth={defaultMonth} />

      <section>
        <h2 className="mb-4 text-xl font-bold">Published draws</h2>
        {draws.length === 0 ? (
          <p className="text-ink-soft">No draws published yet.</p>
        ) : (
          <div className="space-y-3">
            {draws.map((d) => (
              <article key={d.id} className="panel flex flex-wrap items-center justify-between gap-4 !p-5">
                <div>
                  <h3 className="font-bold">{formatMonth(d.month)} <span className="ml-2 badge bg-mist-deep text-ink-soft capitalize">{d.mode}</span></h3>
                  <p className="mt-1 text-sm text-ink-soft">{d.subscriber_count} subscribers, pool {inr2(Number(d.pool_base))}, rolled over {inr2(Number(d.jackpot_carryover_out))}</p>
                </div>
                <div className="flex gap-2">{d.winning_numbers.map((n) => <NumberBall key={n} n={n} size="sm" tone="ink" />)}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
