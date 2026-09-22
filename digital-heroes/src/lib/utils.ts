import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "-";

export const formatMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** First day of a month as YYYY-MM-01 (input is "YYYY-MM" or a Date). */
export function monthStart(input?: string | Date): string {
  if (typeof input === "string" && /^\d{4}-\d{2}$/.test(input)) return `${input}-01`;
  const d = input instanceof Date ? input : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function nextMonthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export type ActionResult = { ok: boolean; message: string };
