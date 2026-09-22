-- Row Level Security. Run after schema.sql.
-- The service-role key (server only) bypasses RLS; it is used for webhooks and admin actions.

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.charities enable row level security;
alter table public.subscriptions enable row level security;
alter table public.scores enable row level security;
alter table public.draws enable row level security;
alter table public.draw_entries enable row level security;
alter table public.winners enable row level security;
alter table public.donations enable row level security;

-- profiles: read/update your own row, but you can never make yourself admin
create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and (role = 'subscriber' or public.is_admin()));
create policy "profiles admin all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- charities: public directory, admin manages
create policy "charities public read" on public.charities for select using (true);
create policy "charities admin write" on public.charities
  for all using (public.is_admin()) with check (public.is_admin());

-- subscriptions: read your own; writes only via service role (Razorpay webhook)
create policy "subscriptions read own or admin" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

-- scores: full control of your own rows
create policy "scores own" on public.scores
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "scores admin all" on public.scores
  for all using (public.is_admin()) with check (public.is_admin());

-- draws: published results are public
create policy "draws public read" on public.draws for select using (true);

-- draw entries + winners: read your own; writes only via service role
create policy "entries read own or admin" on public.draw_entries
  for select using (user_id = auth.uid() or public.is_admin());
create policy "winners read own or admin" on public.winners
  for select using (user_id = auth.uid() or public.is_admin());

-- donations: read your own
create policy "donations read own or admin" on public.donations
  for select using (user_id = auth.uid() or public.is_admin());
