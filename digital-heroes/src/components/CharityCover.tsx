import { cn } from "@/lib/utils";

const PALETTES = [
  { bg: "bg-violet", a: "bg-marigold", b: "bg-rose", text: "text-white/25" },
  { bg: "bg-rose", a: "bg-violet-soft", b: "bg-marigold", text: "text-ink/15" },
  { bg: "bg-mint", a: "bg-marigold", b: "bg-violet", text: "text-ink/15" },
  { bg: "bg-marigold", a: "bg-rose", b: "bg-violet", text: "text-ink/15" },
];

/** Cover art for a charity: their photo if they have one, otherwise a generated colour block. */
export function CharityCover({ name, imageUrl, className }: { name: string; imageUrl?: string | null; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={cn("h-full w-full object-cover", className)} />;
  }
  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  const p = PALETTES[hash % PALETTES.length];
  return (
    <div className={cn("relative h-full w-full overflow-hidden", p.bg, className)} aria-hidden="true">
      <div className={cn("absolute -right-8 -top-8 h-40 w-40 rounded-full", p.a)} />
      <div className={cn("absolute -bottom-6 left-10 h-24 w-24 rounded-full", p.b)} />
      <span className={cn("absolute bottom-2 right-5 font-display text-8xl font-extrabold leading-none", p.text)}>
        {name.charAt(0)}
      </span>
    </div>
  );
}
