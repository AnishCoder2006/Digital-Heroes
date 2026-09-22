import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";

/** Colour per prize tier, used everywhere a tier is shown. */
export const TIER_STYLE = {
  5: { bg: "bg-marigold", soft: "bg-marigold-soft", name: "Jackpot", share: "40%" },
  4: { bg: "bg-mint", soft: "bg-mint-soft", name: "Four matches", share: "35%" },
  3: { bg: "bg-rose", soft: "bg-rose-soft", name: "Three matches", share: "25%" },
} as const;

export function NumberBall({
  n,
  tone = "plain",
  size = "md",
}: {
  n: number | string;
  tone?: "plain" | "sun" | "mint" | "rose" | "ink" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const tones = {
    plain: "bg-white text-ink ring-1 ring-ink/10",
    sun: "bg-marigold text-ink",
    mint: "bg-mint text-ink",
    rose: "bg-rose text-ink",
    ink: "bg-ink text-white",
    ghost: "border-2 border-dashed border-ink/20 bg-transparent text-ink-faint",
  };
  const sizes = { sm: "h-9 w-9 text-sm", md: "h-12 w-12 text-lg", lg: "h-16 w-16 text-2xl sm:h-[4.5rem] sm:w-[4.5rem]" };
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-display font-bold", tones[tone], sizes[size])}>
      {n}
    </span>
  );
}

export function Notice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={cn(
        "rounded-2xl px-4 py-3 text-sm font-medium",
        result.ok ? "bg-mint-soft text-ink" : "bg-rose-soft text-ink",
      )}
    >
      {result.message}
    </p>
  );
}

export function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="rounded-panel border-2 border-dashed border-ink/15 bg-white/50 p-8 text-center sm:p-12">
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">{body}</p>
      {href && cta && (
        <Link href={href} className="btn-primary mt-6">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function Paywall({ what }: { what: string }) {
  return (
    <EmptyState
      title={`Subscribe to unlock ${what}`}
      body="Your account is free to browse. An active subscription lets you log scores, enter the monthly draw and back your charity."
      href="/subscribe"
      cta="See plans"
    />
  );
}

export function StatusPill({ tone, children }: { tone: "good" | "warn" | "bad" | "neutral"; children: React.ReactNode }) {
  const tones = {
    good: "bg-mint-soft text-ink",
    warn: "bg-marigold-soft text-ink",
    bad: "bg-rose-soft text-ink",
    neutral: "bg-mist-deep text-ink-soft",
  };
  return <span className={cn("badge", tones[tone])}>{children}</span>;
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 max-w-2xl text-ink-soft">{children}</p>}
    </div>
  );
}
