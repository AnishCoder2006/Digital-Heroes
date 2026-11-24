-- Migration: 20261124_02_auditor_role_and_encryption.sql
-- Description: Auditor role extension and encrypted searchable donor records
-- Semester 5: Digital Heroes Workstream 2 and Workstream 3

-- 1. Extend profiles.role check to include 'auditor' --------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('subscriber', 'admin', 'auditor'));

-- Helper function for checking auditor/admin privilege
create or replace function public.is_auditor_or_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'auditor')
  );
$$;

-- 2. Encrypted Donor Records Store --------------------------------------------
-- Stores AES-256-GCM encrypted donor details (full name and email).
-- Nonce and ciphertext (with authentication tag) protect confidentiality and integrity.
create table if not exists public.donation_records_enc (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null unique references public.charity_contributions(id) on delete cascade,
  ciphertext text not null,
  nonce text not null,
  created_at timestamptz not null default date_trunc('milliseconds', now())
);

create index if not exists donation_records_enc_contrib_idx
  on public.donation_records_enc(contribution_id);

-- 3. Searchable Keyword Index -------------------------------------------------
-- Stores HMAC tokens computed over lower-cased keywords.
-- Allows exact-keyword lookup by admins/auditors without exposing raw plain words.
create table if not exists public.donation_search_index (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  contribution_id uuid not null references public.charity_contributions(id) on delete cascade,
  created_at timestamptz not null default date_trunc('milliseconds', now()),
  unique (token, contribution_id)
);

create index if not exists donation_search_index_token_idx
  on public.donation_search_index(token);
create index if not exists donation_search_index_contrib_idx
  on public.donation_search_index(contribution_id);

-- 4. Row Level Security Policies ----------------------------------------------
alter table public.donation_records_enc enable row level security;
alter table public.donation_search_index enable row level security;

-- Reading encrypted records & search index is restricted to admins and auditors
drop policy if exists "donation_records_enc read privileged" on public.donation_records_enc;
create policy "donation_records_enc read privileged" on public.donation_records_enc
  for select using (public.is_auditor_or_admin());

drop policy if exists "donation_search_index read privileged" on public.donation_search_index;
create policy "donation_search_index read privileged" on public.donation_search_index
  for select using (public.is_auditor_or_admin());

-- No INSERT, UPDATE, or DELETE policies for anon/authenticated roles.
-- Writes only occur via service-role key or security-definer server operations.
