import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getProfile } from "@/lib/auth";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Digital Heroes: play your round, someone else wins", template: "%s | Digital Heroes" },
  description:
    "Log your golf scores, join a monthly prize draw and send a share of your subscription to a charity you choose.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const user = profile ? { name: profile.full_name, role: profile.role } : null;

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <SiteHeader user={user} />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
