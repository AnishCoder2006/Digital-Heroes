"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Gift, LayoutDashboard, Settings, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/scores", label: "Scores", icon: Target },
  { href: "/dashboard/draws", label: "Draws", icon: CalendarClock },
  { href: "/dashboard/winnings", label: "Winnings", icon: Gift },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-full px-5 py-3 font-semibold transition",
              active ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-ink/5 hover:bg-mist-deep hover:text-ink",
            )}
          >
            <Icon size={18} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
