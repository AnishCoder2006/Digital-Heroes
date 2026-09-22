"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dices, HeartHandshake, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Reports", icon: BarChart3, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/draws", label: "Draws", icon: Dices },
  { href: "/admin/charities", label: "Charities", icon: HeartHandshake },
  { href: "/admin/winners", label: "Winners", icon: Trophy },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-full px-5 py-3 font-semibold transition",
              active ? "bg-violet text-white" : "bg-white text-ink-soft ring-1 ring-ink/5 hover:bg-mist-deep hover:text-ink",
            )}
          >
            <Icon size={18} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
