"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NumberBall, TIER_STYLE } from "@/components/ui";

const SAMPLE = [24, 28, 31, 33, 36];
// The demo walks through every prize tier so a visitor sees what each one feels like.
const OUTCOMES = [3, 4, 5, 0];

function makeDraw(matches: number): number[] {
  const mine = [...SAMPLE].sort(() => Math.random() - 0.5).slice(0, matches);
  const others: number[] = [];
  while (mine.length + others.length < 5) {
    const n = 1 + Math.floor(Math.random() * 45);
    if (!SAMPLE.includes(n) && !others.includes(n)) others.push(n);
  }
  return [...mine, ...others].sort((a, b) => a - b);
}

function DrawTicket() {
  const [drawn, setDrawn] = useState<number[] | null>(null);
  const [roll, setRoll] = useState(0);
  const [rolling, setRolling] = useState(false);

  const matches = drawn ? drawn.filter((n) => SAMPLE.includes(n)).length : 0;
  const tier = matches >= 3 ? (matches as 3 | 4 | 5) : null;

  function rollDraw() {
    setRolling(true);
    setDrawn(null);
    setTimeout(() => {
      setDrawn(makeDraw(OUTCOMES[roll % OUTCOMES.length]));
      setRoll((r) => r + 1);
      setRolling(false);
    }, 650);
  }

  return (
    <div className="relative mx-auto w-full max-w-md lg:rotate-[2deg]">
      <div className="relative rounded-blob bg-white p-6 shadow-lift ring-1 ring-ink/5 sm:p-8">
        {/* ticket notches */}
        <span className="absolute -left-3 top-[54%] h-6 w-6 rounded-full bg-mist" aria-hidden="true" />
        <span className="absolute -right-3 top-[54%] h-6 w-6 rounded-full bg-mist" aria-hidden="true" />

        <p className="font-display text-lg font-bold">Your five scores</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE.map((s) => (
            <NumberBall key={s} n={s} tone={drawn?.includes(s) ? "sun" : "plain"} />
          ))}
        </div>

        <div className="my-6 border-t-2 border-dashed border-ink/15" />

        <p className="font-display text-lg font-bold">This month&apos;s draw</p>
        <div className="mt-3 flex min-h-[3rem] flex-wrap gap-2" aria-live="polite">
          <AnimatePresence mode="popLayout">
            {drawn
              ? drawn.map((n, i) => (
                  <motion.span
                    key={`${roll}-${n}`}
                    initial={{ scale: 0, rotate: -120, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 16, delay: i * 0.1 }}
                  >
                    <NumberBall n={n} tone={SAMPLE.includes(n) ? "sun" : "ink"} />
                  </motion.span>
                ))
              : Array.from({ length: 5 }).map((_, i) => (
                  <motion.span key={`empty-${i}`} animate={rolling ? { y: [0, -8, 0] } : {}} transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.07 }}>
                    <NumberBall n="?" tone="ghost" />
                  </motion.span>
                ))}
          </AnimatePresence>
        </div>

        <div className="mt-5 min-h-[3.5rem]">
          {drawn && (
            <motion.p
              key={roll}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className={`rounded-2xl px-4 py-3 font-semibold ${tier ? TIER_STYLE[tier].bg : "bg-mist-deep"}`}
            >
              {tier === 5 && "Five matches. You take the jackpot share."}
              {tier === 4 && "Four matches. You share the 35% tier."}
              {tier === 3 && "Three matches. You share the 25% tier."}
              {!tier && "No match this time. Your scores stay in for next month."}
            </motion.p>
          )}
        </div>

        <button onClick={rollDraw} disabled={rolling} className="btn-dark mt-4 w-full">
          {rolling ? "Drawing…" : drawn ? "Roll again" : "Roll a demo draw"}
        </button>
        <p className="mt-3 text-center text-sm text-ink-faint">Demo with sample scores. Real draws are random or weighted.</p>
      </div>
    </div>
  );
}

export function Hero() {
  const line = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 18 } } };

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-24 top-10 h-[26rem] w-[26rem] rounded-full bg-marigold sm:h-[34rem] sm:w-[34rem]" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-rose" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.12 }}>
          <h1 className="text-5xl font-extrabold leading-[0.95] sm:text-7xl">
            <motion.span variants={line} className="block">
              Play your round.
            </motion.span>
            <motion.span variants={line} className="mt-1 block text-violet">
              Someone else
            </motion.span>
            <motion.span variants={line} className="mt-1 block text-violet">
              gets a win.
            </motion.span>
          </h1>
          <motion.p variants={line} className="mt-8 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Log your last five golf scores and you&apos;re in a monthly prize draw. At least 10% of your subscription goes to a
            charity you choose.
          </motion.p>
          <motion.div variants={line} className="mt-9 flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary px-8 py-4 text-lg">
              Start giving
            </Link>
            <Link href="/how-it-works" className="btn-ghost px-8 py-4 text-lg">
              See how the draw works
            </Link>
          </motion.div>
          <motion.p variants={line} className="mt-5 text-sm text-ink-soft">
            Monthly or yearly. Cancel any time.
          </motion.p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 40, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.55, type: "spring", stiffness: 90, damping: 16 }}>
          <DrawTicket />
        </motion.div>
      </div>
    </section>
  );
}
