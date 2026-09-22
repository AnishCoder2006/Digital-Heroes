import { DashNav } from "@/components/dashboard/DashNav";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="mb-6 font-display text-lg font-semibold text-ink-soft">
        Hi {profile?.full_name?.split(" ")[0] || "there"}
      </p>
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <DashNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
