import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#5B4BFF" />
      <circle cx="28" cy="12" r="7" fill="#FFC24B" />
      <path d="M6 27c5-6 12-6 17-2s10 3 13-1a16 16 0 0 1-30 8Z" fill="#FF5C8A" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight">
      <LogoMark />
      <span>Digital Heroes</span>
    </Link>
  );
}
