-- Digital Heroes schema. Run this first, then policies.sql.
create extension if not exists "pgcrypto";

-- Charities ---------------------------------------------------------------
create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text not null default '',
  description text not null default '',
  image_url text,
  featured boolean not null default false,
  events jsonb not null default '[]'::jsonb,   -- [{ "title": "...", "date": "2026-11-02", "location": "..." }]
  created_at timestamptz not null default now()
);

-- Profiles (one per auth user) ---------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'subscriber' check (role in ('subscriber', 'admin')),
  charity_id uuid references public.charities(id) on delete set null,
  charity_percent int not null default 10 check (charity_percent between 10 and 50),
  created_at timestamptz not null default now()
);

-- Subscriptions (one row per user; Razorpay webhook keeps it current) -------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'cancelled', 'lapsed', 'expired')),
  razorpay_subscription_id text unique,
  renewal_date timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Scores: max one per user per date, range 1-45 -----------------------------
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score int not null check (score between 1 and 45),
  played_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, played_on)
);
create index scores_user_date_idx on public.scores (user_id, played_on desc);

-- Draws ----------------------------------------------------------------------
create table public.draws (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,                       -- first day of the month
  mode text not null check (mode in ('random', 'algorithmic')),
  winning_numbers int[] not null,
  status text not null default 'published' check (status in ('published')),
  subscriber_count int not null default 0,
  pool_base numeric(12,2) not null default 0,       -- this month's pool from subscriptions
  jackpot_carryover_in numeric(12,2) not null default 0,
  jackpot_carryover_out numeric(12,2) not null default 0,
  published_at timestamptz not null default now()
);

-- Snapshot of who was entered into a draw and with which scores --------------
create table public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scores int[] not null,
  matched_count int not null default 0,
  unique (draw_id, user_id)
);

-- Winners ----------------------------------------------------------------------
create table public.winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier int not null check (tier in (3, 4, 5)),
  matched_numbers int[] not null,
  prize_amount numeric(12,2) not null,
  proof_path text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  unique (draw_id, user_id)
);

-- Independent donations (not tied to gameplay) ---------------------------------
create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  charity_id uuid not null references public.charities(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  razorpay_payment_id text unique,
  created_at timestamptz not null default now()
);

-- New auth user -> profile row (reads signup metadata) ---------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, charity_id, charity_percent)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'charity_id', '')::uuid,
    coalesce(nullif(new.raw_user_meta_data->>'charity_percent', '')::int, 10)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Private bucket for winner proof screenshots ------------------------------------
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;
