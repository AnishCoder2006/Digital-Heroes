import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // non-admins are sent back to their dashboard
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <p className="mb-6 font-display text-lg font-semibold text-ink-soft">Admin console</p>
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <AdminNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
