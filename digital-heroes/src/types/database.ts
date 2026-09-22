// Hand-written row types. You can also generate them with:
//   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts

export type Role = "subscriber" | "admin";

export interface CharityEvent {
  title: string;
  date: string;
  location: string;
}

export interface Charity {
  id: string;
  name: string;
  tagline: string;
  description: string;
  image_url: string | null;
  featured: boolean;
  events: CharityEvent[];
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  charity_id: string | null;
  charity_percent: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: "monthly" | "yearly";
  status: "pending" | "active" | "cancelled" | "lapsed" | "expired";
  razorpay_subscription_id: string | null;
  renewal_date: string | null;
  updated_at: string;
}

export interface Score {
  id: string;
  user_id: string;
  score: number;
  played_on: string;
}

export interface Draw {
  id: string;
  month: string;
  mode: "random" | "algorithmic";
  winning_numbers: number[];
  subscriber_count: number;
  pool_base: number;
  jackpot_carryover_in: number;
  jackpot_carryover_out: number;
  published_at: string;
}

export interface DrawEntry {
  id: string;
  draw_id: string;
  user_id: string;
  scores: number[];
  matched_count: number;
}

export interface Winner {
  id: string;
  draw_id: string;
  user_id: string;
  tier: 3 | 4 | 5;
  matched_numbers: number[];
  prize_amount: number;
  proof_path: string | null;
  verification_status: "pending" | "approved" | "rejected";
  payment_status: "pending" | "paid";
  created_at: string;
}

export interface Donation {
  id: string;
  user_id: string | null;
  charity_id: string;
  amount: number;
  razorpay_payment_id: string | null;
  created_at: string;
}
