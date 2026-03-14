create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  project_url_secret_id uuid;
  anon_key_secret_id uuid;
begin
  select id
  into project_url_secret_id
  from vault.decrypted_secrets
  where name = 'admin_inbox_project_url'
  limit 1;

  if project_url_secret_id is null then
    perform vault.create_secret(
      'https://mzapuczjijqjzdcujetx.supabase.co',
      'admin_inbox_project_url',
      'Supabase project URL for admin inbox notification emails'
    );
  else
    perform vault.update_secret(
      project_url_secret_id,
      'https://mzapuczjijqjzdcujetx.supabase.co',
      'admin_inbox_project_url',
      'Supabase project URL for admin inbox notification emails'
    );
  end if;

  select id
  into anon_key_secret_id
  from vault.decrypted_secrets
  where name = 'admin_inbox_anon_key'
  limit 1;

  if anon_key_secret_id is null then
    perform vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YXB1Y3pqaWpxanpkY3VqZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDkzMjcsImV4cCI6MjA3NzUyNTMyN30.r0DCKvVY5fgDOMj4dv46tOIcsHmeFzV1-M88-LC3eWA',
      'admin_inbox_anon_key',
      'Anon key used by pg_net to invoke the send-admin-notification Edge Function'
    );
  else
    perform vault.update_secret(
      anon_key_secret_id,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YXB1Y3pqaWpxanpkY3VqZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDkzMjcsImV4cCI6MjA3NzUyNTMyN30.r0DCKvVY5fgDOMj4dv46tOIcsHmeFzV1-M88-LC3eWA',
      'admin_inbox_anon_key',
      'Anon key used by pg_net to invoke the send-admin-notification Edge Function'
    );
  end if;
end;
$$;

create table if not exists public.admin_inbox_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  source_table text not null,
  source_id uuid not null,
  source_type text not null check (
    source_type = any (
      array[
        'bug_report'::text,
        'safety_report'::text,
        'express_promotion'::text,
        'flight_reviewer_application'::text,
        'roc_a_examiner_application'::text,
        'flight_hour_claim'::text
      ]
    )
  ),
  title text not null,
  body text not null,
  link_path text not null,
  is_read boolean not null default false,
  read_at timestamp with time zone,
  email_status text not null default 'pending' check (
    email_status = any (array['pending'::text, 'sent'::text, 'failed'::text])
  ),
  email_error text,
  emailed_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create unique index if not exists admin_inbox_notifications_dedupe_idx
  on public.admin_inbox_notifications (recipient_email, source_table, source_id, source_type);

create index if not exists admin_inbox_notifications_recipient_read_idx
  on public.admin_inbox_notifications (lower(recipient_email), is_read, created_at desc);

alter table public.admin_inbox_notifications enable row level security;

drop policy if exists "Admins can read their own inbox notifications" on public.admin_inbox_notifications;
create policy "Admins can read their own inbox notifications"
  on public.admin_inbox_notifications
  for select
  to authenticated
  using (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and exists (
      select 1
      from public.employee_profiles employee
      where lower(employee.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and employee.role in ('admin', 'owner')
    )
  );

drop policy if exists "Admins can update their own inbox notifications" on public.admin_inbox_notifications;
create policy "Admins can update their own inbox notifications"
  on public.admin_inbox_notifications
  for update
  to authenticated
  using (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and exists (
      select 1
      from public.employee_profiles employee
      where lower(employee.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and employee.role in ('admin', 'owner')
    )
  )
  with check (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

grant select, update on public.admin_inbox_notifications to authenticated;

create or replace function public.admin_notification_actor_name(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor record;
begin
  select
    call_sign,
    first_name,
    last_name,
    email
  into actor
  from public.profiles
  where id = p_profile_id;

  if actor.call_sign is not null and btrim(actor.call_sign) <> '' then
    return actor.call_sign;
  end if;

  if coalesce(actor.first_name, '') <> '' or coalesce(actor.last_name, '') <> '' then
    return btrim(concat_ws(' ', actor.first_name, actor.last_name));
  end if;

  if actor.email is not null and btrim(actor.email) <> '' then
    return actor.email;
  end if;

  return 'Unknown user';
end;
$$;

create or replace function public.dispatch_admin_notification_emails(p_notification_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  anon_key text;
begin
  if p_notification_ids is null or cardinality(p_notification_ids) = 0 then
    return;
  end if;

  select decrypted_secret
  into project_url
  from vault.decrypted_secrets
  where name = 'admin_inbox_project_url'
  limit 1;

  select decrypted_secret
  into anon_key
  from vault.decrypted_secrets
  where name = 'admin_inbox_anon_key'
  limit 1;

  if coalesce(project_url, '') = '' or coalesce(anon_key, '') = '' then
    raise warning 'Admin inbox email dispatch skipped because Vault secrets are missing';
    return;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send-admin-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('notification_ids', p_notification_ids),
    timeout_milliseconds := 5000
  );
exception
  when others then
    raise warning 'Admin inbox email dispatch failed: %', sqlerrm;
end;
$$;

create or replace function public.create_admin_inbox_notifications(
  p_source_table text,
  p_source_id uuid,
  p_source_type text,
  p_title text,
  p_body text,
  p_link_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_ids uuid[];
begin
  with inserted as (
    insert into public.admin_inbox_notifications (
      recipient_email,
      source_table,
      source_id,
      source_type,
      title,
      body,
      link_path
    )
    select
      lower(employee.email),
      p_source_table,
      p_source_id,
      p_source_type,
      p_title,
      p_body,
      p_link_path
    from public.employee_profiles employee
    where employee.role in ('admin', 'owner')
      and employee.email is not null
      and btrim(employee.email) <> ''
    on conflict (recipient_email, source_table, source_id, source_type) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[])
  into inserted_ids
  from inserted;

  perform public.dispatch_admin_notification_emails(inserted_ids);
end;
$$;

create or replace function public.handle_ticket_report_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_type text;
  inbox_title text;
  inbox_body text;
  reporter_name text;
begin
  source_type := case
    when new.type = 'safety' then 'safety_report'
    else 'bug_report'
  end;

  reporter_name := public.admin_notification_actor_name(new.user_id);

  inbox_title := case
    when new.type = 'safety' then 'New safety report'
    else 'New bug report'
  end;

  inbox_body := reporter_name || ' submitted "' || coalesce(new.title, 'Untitled report') || '".';

  perform public.create_admin_inbox_notifications(
    'ticket_reports',
    new.id,
    source_type,
    inbox_title,
    inbox_body,
    case
      when new.type = 'safety' then '/admin/safety-reports'
      else '/admin/tickets'
    end
  );

  return new;
end;
$$;

drop trigger if exists ticket_reports_admin_inbox_notification on public.ticket_reports;
create trigger ticket_reports_admin_inbox_notification
  after insert on public.ticket_reports
  for each row
  execute function public.handle_ticket_report_admin_notification();

create or replace function public.handle_express_promotion_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter_name text;
begin
  reporter_name := public.admin_notification_actor_name(new.pilot_id);

  perform public.create_admin_inbox_notifications(
    'express_promotion_applications',
    new.id,
    'express_promotion',
    'New express promotion application',
    reporter_name || ' submitted a ' || replace(new.promotion_type, '_', ' ') || ' promotion request.',
    '/admin/express-promotions'
  );

  return new;
end;
$$;

drop trigger if exists express_promotion_admin_inbox_notification on public.express_promotion_applications;
create trigger express_promotion_admin_inbox_notification
  after insert on public.express_promotion_applications
  for each row
  execute function public.handle_express_promotion_admin_notification();

create or replace function public.handle_license_approval_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter_name text;
  source_type text;
  inbox_title text;
  link_path text;
begin
  if new.license_type ilike '%Flight Reviewer%' then
    source_type := 'flight_reviewer_application';
    inbox_title := 'New flight reviewer application';
    link_path := '/admin/flight-reviewer-applications';
  elsif new.license_type ilike '%ROC-A Examiner%' then
    source_type := 'roc_a_examiner_application';
    inbox_title := 'New ROC-A examiner application';
    link_path := '/admin/roc-a-examiner-applications';
  else
    return new;
  end if;

  reporter_name := public.admin_notification_actor_name(new.pilot_id);

  perform public.create_admin_inbox_notifications(
    'license_approval_requests',
    new.id,
    source_type,
    inbox_title,
    reporter_name || ' submitted a new license approval request.',
    link_path
  );

  return new;
end;
$$;

drop trigger if exists license_approval_admin_inbox_notification on public.license_approval_requests;
create trigger license_approval_admin_inbox_notification
  after insert on public.license_approval_requests
  for each row
  execute function public.handle_license_approval_admin_notification();

create or replace function public.handle_flight_hour_claim_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter_name text;
begin
  reporter_name := public.admin_notification_actor_name(new.pilot_id);

  perform public.create_admin_inbox_notifications(
    'flight_hour_claims',
    new.id,
    'flight_hour_claim',
    'New flight hour claim',
    reporter_name || ' submitted a new flight hour claim.',
    '/admin/flight-hour-claims'
  );

  return new;
end;
$$;

drop trigger if exists flight_hour_claim_admin_inbox_notification on public.flight_hour_claims;
create trigger flight_hour_claim_admin_inbox_notification
  after insert on public.flight_hour_claims
  for each row
  execute function public.handle_flight_hour_claim_admin_notification();
