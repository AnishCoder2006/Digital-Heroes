import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="[&_a]:text-white">
            <Logo />
          </div>
          <p className="mt-4 max-w-sm text-white/70">
            A monthly prize draw where your golf scores do some good. Every subscriber backs a charity they choose.
          </p>
        </div>
        <nav aria-label="Explore" className="flex flex-col gap-2 text-white/80">
          <span className="mb-1 font-display font-bold text-white">Explore</span>
          <Link href="/charities" className="hover:text-marigold">Charities</Link>
          <Link href="/how-it-works" className="hover:text-marigold">How the draw works</Link>
          <Link href="/#pricing" className="hover:text-marigold">Pricing</Link>
        </nav>
        <nav aria-label="Account" className="flex flex-col gap-2 text-white/80">
          <span className="mb-1 font-display font-bold text-white">Your account</span>
          <Link href="/login" className="hover:text-marigold">Log in</Link>
          <Link href="/signup" className="hover:text-marigold">Create an account</Link>
          <Link href="/dashboard" className="hover:text-marigold">Dashboard</Link>
        </nav>
      </div>
      <div className="border-t border-white/10 px-6 py-5 text-center text-sm text-white/50">
        Prototype built for the Digital Heroes selection process. Payments run in Razorpay test mode.
      </div>
    </footer>
  );
}
