-- Migration: 20261124_01_charity_contributions_and_ledger.sql
-- Description: Charity contributions table and append-only tamper-evident hash-linked ledger
-- Semester 5: Digital Heroes Workstream 1

create extension if not exists "pgcrypto";

-- 1. Charity Contributions ----------------------------------------------------
-- Stores charity portions of verified subscription payments.
-- Unique constraint on razorpay_payment_id prevents double-crediting.
create table if not exists public.charity_contributions (
  id uuid primary key default gen_random_uuid(),
  razorpay_payment_id text not null unique,
  razorpay_order_id text,
  charity_id uuid not null references public.charities(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default date_trunc('milliseconds', now())
);

create index if not exists charity_contributions_user_idx on public.charity_contributions(user_id);
create index if not exists charity_contributions_charity_idx on public.charity_contributions(charity_id);
create index if not exists charity_contributions_created_idx on public.charity_contributions(created_at desc);

-- 2. Append-Only Tamper-Evident Ledger -----------------------------------------
-- Sequential hash chain where each entry includes the SHA-256 hash of its
-- canonical representation and points to prev_hash.
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  sequence_number bigint not null unique,
  contribution_id uuid not null unique references public.charity_contributions(id) on delete restrict,
  user_id_hash text not null,
  charity_id uuid not null references public.charities(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  prev_hash text not null,
  entry_hash text not null,
  created_at timestamptz not null default date_trunc('milliseconds', now())
);

create index if not exists ledger_entries_seq_idx on public.ledger_entries(sequence_number asc);

-- 3. Immutability Triggers (Append-Only Enforcement) --------------------------
create or replace function public.block_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only: updates and deletes are prohibited';
end;
$$;

drop trigger if exists trg_block_ledger_mutation on public.ledger_entries;
create trigger trg_block_ledger_mutation
  before update or delete on public.ledger_entries
  for each row execute function public.block_ledger_mutation();

create or replace function public.block_contribution_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'charity_contributions is immutable: updates and deletes are prohibited';
end;
$$;

drop trigger if exists trg_block_contribution_mutation on public.charity_contributions;
create trigger trg_block_contribution_mutation
  before update or delete on public.charity_contributions
  for each row execute function public.block_contribution_mutation();

-- 4. Atomic Insertion Function with Row Locking -------------------------------
-- Writes contribution and ledger entry in a single atomic transaction,
-- acquiring an advisory lock and locking the latest ledger row.
create or replace function public.record_charity_contribution_and_ledger(
  p_payment_id text,
  p_order_id text,
  p_charity_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_user_id_hash text,
  p_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_contrib_id uuid;
  v_created_at timestamptz;
  v_created_at_iso text;
  v_last_seq bigint;
  v_last_entry_hash text;
  v_new_seq bigint;
  v_prev_hash text;
  v_canonical text;
  v_entry_hash text;
  v_ledger_id uuid;
begin
  -- Enforce serial transaction order across concurrent payments
  perform pg_advisory_xact_lock(hashtext('ledger_append_lock'));

  -- 1. Idempotency: return existing contribution if payment ID was already processed
  select c.id as contribution_id, l.id as ledger_id, l.sequence_number, l.entry_hash
  into v_existing
  from public.charity_contributions c
  left join public.ledger_entries l on l.contribution_id = c.id
  where c.razorpay_payment_id = p_payment_id;

  if v_existing.contribution_id is not null then
    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'contribution_id', v_existing.contribution_id,
      'ledger_id', v_existing.ledger_id,
      'sequence_number', v_existing.sequence_number,
      'entry_hash', v_existing.entry_hash
    );
  end if;

  -- 2. Lock latest ledger entry and determine previous hash
  select sequence_number, entry_hash
  into v_last_seq, v_last_entry_hash
  from public.ledger_entries
  order by sequence_number desc
  limit 1
  for update;

  if v_last_seq is null then
    v_new_seq := 1;
    v_prev_hash := repeat('0', 64);
  else
    v_new_seq := v_last_seq + 1;
    v_prev_hash := v_last_entry_hash;
  end if;

  -- 3. Standardize timestamp
  v_created_at := coalesce(p_created_at, date_trunc('milliseconds', now()));
  v_created_at_iso := to_char(v_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  -- 4. Insert into charity_contributions
  insert into public.charity_contributions (
    razorpay_payment_id,
    razorpay_order_id,
    charity_id,
    user_id,
    amount,
    created_at
  ) values (
    p_payment_id,
    p_order_id,
    p_charity_id,
    p_user_id,
    p_amount,
    v_created_at
  ) returning id into v_contrib_id;

  -- 5. Construct canonical representation and hash
  -- Format: seq|contrib_id|user_id_hash|charity_id|amount_2dec|created_at_iso|prev_hash
  v_canonical := v_new_seq || '|' ||
                 v_contrib_id::text || '|' ||
                 p_user_id_hash || '|' ||
                 p_charity_id::text || '|' ||
                 to_char(p_amount, 'FM999999990.00') || '|' ||
                 v_created_at_iso || '|' ||
                 v_prev_hash;

  v_entry_hash := encode(digest(v_canonical, 'sha256'), 'hex');

  -- 6. Insert into ledger_entries
  insert into public.ledger_entries (
    sequence_number,
    contribution_id,
    user_id_hash,
    charity_id,
    amount,
    prev_hash,
    entry_hash,
    created_at
  ) values (
    v_new_seq,
    v_contrib_id,
    p_user_id_hash,
    p_charity_id,
    p_amount,
    v_prev_hash,
    v_entry_hash,
    v_created_at
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'contribution_id', v_contrib_id,
    'ledger_id', v_ledger_id,
    'sequence_number', v_new_seq,
    'entry_hash', v_entry_hash,
    'prev_hash', v_prev_hash
  );
end;
$$;

-- 5. Ledger Verification Function ---------------------------------------------
-- Iterates through the ledger chain in sequence and detects any tampering,
-- hash mismatch, or broken chain link.
create or replace function public.verify_ledger()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_expected_prev text := repeat('0', 64);
  v_expected_seq bigint := 1;
  v_canonical text;
  v_computed_hash text;
  v_created_at_iso text;
begin
  for v_row in (
    select l.*, c.created_at as contrib_created_at
    from public.ledger_entries l
    join public.charity_contributions c on c.id = l.contribution_id
    order by l.sequence_number asc
  ) loop
    -- Check sequence continuity
    if v_row.sequence_number != v_expected_seq then
      return jsonb_build_object(
        'ok', false,
        'reason', 'sequence_gap',
        'broken_sequence', v_row.sequence_number,
        'expected_sequence', v_expected_seq
      );
    end if;

    -- Check previous hash pointer
    if v_row.prev_hash != v_expected_prev then
      return jsonb_build_object(
        'ok', false,
        'reason', 'prev_hash_mismatch',
        'broken_sequence', v_row.sequence_number,
        'expected_prev_hash', v_expected_prev,
        'actual_prev_hash', v_row.prev_hash
      );
    end if;

    -- Recompute SHA-256 hash over canonical fields
    v_created_at_iso := to_char(v_row.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_canonical := v_row.sequence_number || '|' ||
                   v_row.contribution_id::text || '|' ||
                   v_row.user_id_hash || '|' ||
                   v_row.charity_id::text || '|' ||
                   to_char(v_row.amount, 'FM999999990.00') || '|' ||
                   v_created_at_iso || '|' ||
                   v_row.prev_hash;
    v_computed_hash := encode(digest(v_canonical, 'sha256'), 'hex');

    if v_row.entry_hash != v_computed_hash then
      return jsonb_build_object(
        'ok', false,
        'reason', 'entry_hash_tampered',
        'broken_sequence', v_row.sequence_number,
        'expected_entry_hash', v_computed_hash,
        'actual_entry_hash', v_row.entry_hash
      );
    end if;

    v_expected_prev := v_row.entry_hash;
    v_expected_seq := v_expected_seq + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'entries_verified', v_expected_seq - 1
  );
end;
$$;

-- 6. Row Level Security Policies ----------------------------------------------
alter table public.charity_contributions enable row level security;
alter table public.ledger_entries enable row level security;

-- Charity contributions: users can read their own rows; admins and auditors can read all.
drop policy if exists "contributions read own or privileged" on public.charity_contributions;
create policy "contributions read own or privileged" on public.charity_contributions
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'auditor')
    )
  );

-- Ledger entries: public read for transparent auditing (user_id is anonymized via salted hash).
drop policy if exists "ledger read public" on public.ledger_entries;
create policy "ledger read public" on public.ledger_entries
  for select using (true);

-- No INSERT, UPDATE, or DELETE policies exist for anon/authenticated roles.
-- Writes only occur via service-role key or security definer stored procedure.
