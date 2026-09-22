/**
 * Fills a fresh Supabase project with demo data so every screen has something to show.
 * Safe to run more than once.   Run: npm run seed
 *
 * Creates: 6 charities, an admin, a test subscriber, and 24 demo players with active
 * subscriptions and five scores each (so a draw has real winners).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Using NEXT_PUBLIC_SUPABASE_URL:", JSON.stringify(url));
console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!serviceKey, serviceKey ? `(length ${serviceKey.length})` : "");

if (!url || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env. " +
      "Open .env and make sure both lines are set with no quotes, e.g. NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co",
  );
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.warn(
    "Warning: NEXT_PUBLIC_SUPABASE_URL doesn't look like a normal Supabase project URL " +
      "(expected something like https://abcdefgh.supabase.co). Double-check it against " +
      "Project Settings > API in your Supabase dashboard.",
  );
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const ADMIN = { email: "admin@digitalheroes.test", password: "Admin@12345", name: "Admin" };
const TESTER = { email: "user@digitalheroes.test", password: "User@12345", name: "Test Player" };

const CHARITIES = [
  { name: "Bright Slates Foundation", tagline: "Books, uniforms and a seat in class for children who'd otherwise miss school.", description: "Bright Slates funds school supplies and after-school tutoring in under-resourced districts. Every rupee goes to classrooms, and supporters get a yearly report showing where it was spent.", featured: true, events: [{ title: "Charity golf day", date: "2026-11-08", location: "Bengaluru" }, { title: "Back-to-school drive", date: "2026-12-02", location: "Mysuru" }] },
  { name: "Green Roots Trust", tagline: "Planting native trees and restoring village commons.", description: "Green Roots works with local communities to plant and look after native trees. Each planting is tracked and revisited so saplings survive.", featured: true, events: [{ title: "Community planting weekend", date: "2026-10-18", location: "Coorg" }] },
  { name: "Open Doors Shelter", tagline: "A safe bed, a hot meal and a route back to stable housing.", description: "Open Doors runs emergency shelter and job-readiness programmes for people who've lost their homes.", featured: true, events: [] },
  { name: "Clear Water Collective", tagline: "Clean drinking water for rural schools and clinics.", description: "The Collective installs and maintains water filters in schools and clinics, and trains local caretakers to keep them running.", featured: false, events: [{ title: "Fundraiser dinner", date: "2026-11-21", location: "Hyderabad" }] },
  { name: "Second Wind Sports for All", tagline: "Adaptive sports so everyone gets to play.", description: "Second Wind provides equipment, coaching and tournaments for players with disabilities, from first swing to first medal.", featured: false, events: [{ title: "Open day and clinic", date: "2026-10-25", location: "Chennai" }] },
  { name: "Paws and Whiskers Rescue", tagline: "Rescue, treatment and homes for street animals.", description: "Paws and Whiskers rescues injured strays, treats them, and finds them homes. Vaccination and neutering camps run every month.", featured: false, events: [{ title: "Adoption day", date: "2026-11-01", location: "Pune" }] },
];

const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const dateDaysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

async function findOrCreateUser(email: string, password: string, meta: Record<string, unknown>) {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`Could not list users: ${listError.message}`);
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (error || !data.user) throw new Error(`Could not create ${email}: ${error?.message ?? "unknown error"}`);
  return data.user.id;
}

async function giveSubscription(userId: string, plan: "monthly" | "yearly") {
  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      { user_id: userId, plan, status: "active", renewal_date: plusDays(25), updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) console.error(`Could not set subscription for ${userId}: ${error.message}`);
}

async function giveScores(userId: string, low: number, high: number) {
  const { count } = await supabase.from("scores").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= 5) return;
  await supabase.from("scores").delete().eq("user_id", userId);
  const used = new Set<number>();
  const rows = [];
  for (let i = 0; i < 5; i++) {
    let score = rand(low, high);
    while (used.has(score)) score = rand(low, high);
    used.add(score);
    rows.push({ user_id: userId, score, played_on: dateDaysAgo(3 + i * 6) });
  }
  const { error } = await supabase.from("scores").insert(rows);
  if (error) console.error(`Could not add scores for ${userId}: ${error.message}`);
}

async function main() {
  // Charities
  const { count, error: countError } = await supabase.from("charities").select("id", { count: "exact", head: true });
  if (countError) {
    console.error("Full error object from Supabase:", JSON.stringify(countError, null, 2));
    throw new Error(
      "Could not read the charities table (see the full error printed above). " +
        "Check that schema.sql and policies.sql both ran in the Supabase SQL Editor, " +
        "and that NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env match that same project.",
    );
  }

  if (!count) {
    const { error: insertError } = await supabase.from("charities").insert(CHARITIES);
    if (insertError) {
      throw new Error(`Could not insert charities: ${insertError.message}`);
    }
  }

  const { data: charities, error: selectError } = await supabase.from("charities").select("id");
  if (selectError) throw new Error(`Could not read charities back: ${selectError.message}`);
  if (!charities || charities.length === 0) {
    throw new Error("Charities table is still empty after inserting. Check the Supabase table editor directly.");
  }
  const pick = () => charities[rand(0, charities.length - 1)].id;

  // Admin
  const adminId = await findOrCreateUser(ADMIN.email, ADMIN.password, { full_name: ADMIN.name, charity_id: pick(), charity_percent: 10 });
  await supabase.from("profiles").update({ role: "admin" }).eq("id", adminId);

  // Test subscriber (active, five scores)
  const testerId = await findOrCreateUser(TESTER.email, TESTER.password, { full_name: TESTER.name, charity_id: pick(), charity_percent: 15 });
  await giveSubscription(testerId, "monthly");
  await giveScores(testerId, 24, 38);

  // Demo players with scores in the typical 20-40 range so a draw can produce winners
  for (let i = 1; i <= 24; i++) {
    const id = await findOrCreateUser(`player${i}@digitalheroes.test`, "Player@12345", {
      full_name: `Demo Player ${i}`,
      charity_id: pick(),
      charity_percent: [10, 10, 15, 20, 25][i % 5],
    });
    await giveSubscription(id, i % 4 === 0 ? "yearly" : "monthly");
    await giveScores(id, 20, 40);
  }

  console.log("\nSeed complete.\n");
  console.log(`Admin:      ${ADMIN.email}  /  ${ADMIN.password}`);
  console.log(`Subscriber: ${TESTER.email}  /  ${TESTER.password}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});