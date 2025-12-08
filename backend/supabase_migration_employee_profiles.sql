-- Employee profiles table + auth sync for Buzz portal
-- Run in Supabase SQL editor (public schema)

-- Extensions needed for UUIDs, trigram search
create extension if not exists pgcrypto with schema public;
create extension if not exists pg_trgm with schema public;

-- 1) Table definition
create table if not exists public.employee_profiles (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text,
    role text not null default 'employee' check (role in ('employee','editor','admin','owner')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Keep updated_at fresh
create or replace function public.set_employee_profiles_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists trg_employee_profiles_updated_at on public.employee_profiles;
create trigger trg_employee_profiles_updated_at
before update on public.employee_profiles
for each row execute function public.set_employee_profiles_updated_at();

-- 2) Indexes
create index if not exists idx_employee_profiles_email_lower
  on public.employee_profiles (lower(email));

create index if not exists idx_employee_profiles_role
  on public.employee_profiles (role);

-- Optional: trigram search for email lookups (requires pg_trgm)
create index if not exists idx_employee_profiles_email_trgm
  on public.employee_profiles using gin (email gin_trgm_ops);

-- Helper: current actor role from JWT email
create or replace function public.current_employee_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.employee_profiles
  where lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  limit 1;
$$;

-- RLS policies
alter table public.employee_profiles enable row level security;

-- Select: allow authenticated Buzz emails
drop policy if exists employee_profiles_select on public.employee_profiles;
create policy employee_profiles_select on public.employee_profiles
for select using (
  coalesce(auth.jwt()->>'email','') like '%@buzzbuzzin.com'
);

-- Insert: owner only
drop policy if exists employee_profiles_insert on public.employee_profiles;
create policy employee_profiles_insert on public.employee_profiles
for insert with check (
  public.current_employee_role() = 'owner'
);

-- Update: owner can update anything; admin limited to employee/editor rows and target roles
drop policy if exists employee_profiles_update_owner on public.employee_profiles;
create policy employee_profiles_update_owner on public.employee_profiles
for update using (public.current_employee_role() = 'owner');

drop policy if exists employee_profiles_update_admin on public.employee_profiles;
create policy employee_profiles_update_admin on public.employee_profiles
for update using (
  public.current_employee_role() = 'admin'
  and role in ('employee','editor')
)
with check (
  role in ('employee','editor')
);

-- 3) Backfill existing auth users on the domain
insert into public.employee_profiles (email, role)
select lower(u.email), 'employee'
from auth.users u
where u.email is not null
  and lower(u.email) like '%@buzzbuzzin.com'
on conflict (email) do nothing;

-- 4) Auto-sync future auth signups/updates on the domain
create or replace function public.sync_employee_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_email text := lower(coalesce(new.email, ''));
begin
    if normalized_email = '' then
        return null;
    end if;

    if normalized_email like '%@buzzbuzzin.com' then
        insert into public.employee_profiles (email, role)
        values (normalized_email, 'employee')
        on conflict (email) do nothing;
    end if;

    return null;
end;
$$;

drop trigger if exists trg_sync_employee_from_auth on auth.users;
create trigger trg_sync_employee_from_auth
after insert or update of email on auth.users
for each row execute function public.sync_employee_from_auth();

