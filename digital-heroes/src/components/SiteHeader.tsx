"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { signOut } from "@/app/actions/auth";
import type { Role } from "@/types/database";

type HeaderUser = { name: string; role: Role } | null;

const links = [
  { href: "/charities", label: "Charities" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

export function SiteHeader({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-full bg-white/85 px-4 py-2.5 shadow-sm ring-1 ring-ink/5 backdrop-blur-md sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 font-medium text-ink-soft transition hover:bg-mist hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link href={user.role === "admin" ? "/admin" : "/dashboard"} className="btn-ghost btn-sm">
                  {user.role === "admin" ? "Admin" : "Dashboard"}
                </Link>
                <form action={signOut}>
                  <button className="btn btn-sm text-ink-soft hover:text-ink">Log out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-sm text-ink-soft hover:text-ink">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary btn-sm">
                  Start giving
                </Link>
              </>
            )}
          </div>

          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-mist md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden md:hidden"
            >
              <nav className="flex flex-col gap-1 pb-3 pt-4" aria-label="Mobile">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-lg font-semibold hover:bg-mist">
                    {l.label}
                  </Link>
                ))}
                {user ? (
                  <>
                    <Link href={user.role === "admin" ? "/admin" : "/dashboard"} onClick={() => setOpen(false)} className="btn-primary mt-2">
                      {user.role === "admin" ? "Admin" : "Dashboard"}
                    </Link>
                    <form action={signOut}>
                      <button className="btn-ghost mt-2 w-full">Log out</button>
                    </form>
                  </>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost">
                      Log in
                    </Link>
                    <Link href="/signup" onClick={() => setOpen(false)} className="btn-primary">
                      Start giving
                    </Link>
                  </div>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
