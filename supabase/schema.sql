-- =============================================================================
-- PAFOWA · Pargavi Apartments Foundation Committee Association
-- Supabase schema, row level security and secure RPCs.
--
-- Apply this file once in the Supabase SQL editor (or `supabase db push`).
-- It creates:
--   profiles, apartments, combined_apartments, combined_apartment_members,
--   maintenance_payments, receipts, expenses, announcements,
--   private Storage buckets for vouchers and archived receipts.
--
-- Security model:
--   * Residents sign in with their phone number plus a password issued by the
--     treasurer, and can read/write only their own apartment's payment records.
--     No SMS provider is involved. The phone maps to a reserved
--     `<digits>@residents.pafowa.in` auth account; nothing is ever emailed there.
--   * Committee officers are treasurer, president and secretary. They use the
--     same phone-number login as residents. A sign-in from a new device raises
--     an alarm, and any officer can lock an account instantly.
--   * The treasurer can record/confirm/edit. The president and secretary have
--     read-only oversight.
--   * Sign-ins from a new device raise an in-app security alert for every officer.
--   * Officer accounts can be locked instantly; a locked account fails every
--     RLS helper until the treasurer unlocks it.
--   * Financial rows can never be deleted through the API (no DELETE grants).
--   * Confirmed payments are locked; expense corrections use void flags.
--   * Receipt numbers are issued inside a database function, not in the browser.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Every login is phone-based. Supabase stores a reserved address on the
  -- @residents.pafowa.in domain instead, which is deliberately not repeated here.
  email text unique,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'resident'
    check (role in ('resident', 'treasurer', 'president', 'secretary')),
  security_locked boolean not null default false,
  security_locked_at timestamptz,
  security_locked_reason text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.apartments (
  id uuid primary key default gen_random_uuid(),
  block text not null,
  unit_number text not null,
  display_label text not null default '',
  resident_name text not null default '',
  contact_phone text not null default '',
  occupancy_status text not null default 'owner'
    check (occupancy_status in ('owner', 'tenant', 'vacant')),
  maintenance_amount numeric(12, 2) not null default 0 check (maintenance_amount >= 0),
  user_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (block, unit_number)
);

create table if not exists public.combined_apartments (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  maintenance_amount numeric(12, 2) not null default 0 check (maintenance_amount >= 0),
  notes text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.combined_apartment_members (
  combined_id uuid not null references public.combined_apartments(id) on delete cascade,
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (combined_id, apartment_id)
);

create table if not exists public.maintenance_payments (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid references public.apartments(id),
  combined_id uuid references public.combined_apartments(id),
  unit_label text not null,
  resident_name text not null default '',
  maintenance_month date not null,
  amount_due numeric(12, 2) not null default 0 check (amount_due >= 0),
  amount_paid numeric(12, 2) not null check (amount_paid > 0),
  payment_date date not null,
  payment_method text not null check (payment_method in ('cash', 'bank')),
  transaction_id text,
  upi_id text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  notes text,
  receipt_number text,
  rejection_reason text,
  submitted_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_unit_exclusive check (num_nonnulls(apartment_id, combined_id) = 1),
  constraint payments_month_first_day check (extract(day from maintenance_month) = 1),
  constraint payments_bank_reference check (
    payment_method <> 'bank'
    or (transaction_id is not null and length(trim(transaction_id)) > 0)
  )
);

-- Only one live (pending/confirmed) payment is allowed per billing unit + month.
-- Rejected submissions remain for the audit trail.
create unique index if not exists maintenance_payments_unit_month_active_idx
  on public.maintenance_payments (coalesce(apartment_id, combined_id), maintenance_month)
  where status in ('pending', 'confirmed');

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.maintenance_payments(id),
  receipt_number text not null unique,
  apartment_id uuid references public.apartments(id),
  combined_id uuid references public.combined_apartments(id),
  resident_name text not null default '',
  unit_label text not null,
  maintenance_month date not null,
  payment_date date not null,
  amount numeric(12, 2) not null,
  payment_method text not null check (payment_method in ('cash', 'bank')),
  transaction_id text,
  upi_id text,
  status text not null default 'confirmed',
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id) on delete set null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null check (
    category in (
      'Plumbing',
      'Electrical',
      'Water maintenance',
      'Cleaning',
      'Repairs',
      'General expenses',
      'Other'
    )
  ),
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_to text not null,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank')),
  voucher_available boolean not null default false,
  voucher_path text,
  is_void boolean not null default false,
  void_reason text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'general' check (category in ('water', 'electrical', 'general')),
  message text not null,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-year receipt sequence. Kept in a table so numbering restarts each January.
create table if not exists public.receipt_counters (
  year integer primary key,
  last_value integer not null default 0
);

-- -----------------------------------------------------------------------------
-- Upgrade path for databases created before officer security existed.
-- -----------------------------------------------------------------------------
alter table public.profiles alter column email drop not null;
alter table public.profiles drop constraint if exists profiles_email_key;
alter table public.profiles add constraint profiles_email_key unique (email);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('resident', 'treasurer', 'president', 'secretary'));
alter table public.profiles add column if not exists security_locked boolean not null default false;
alter table public.profiles add column if not exists security_locked_at timestamptz;
alter table public.profiles add column if not exists security_locked_reason text;
alter table public.profiles add column if not exists last_login_at timestamptz;

-- Every device an officer has signed in from. The first sign-in from a new
-- fingerprint raises an alert for the whole committee.
create table if not exists public.officer_devices (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.profiles(id) on delete cascade,
  device_hash text not null,
  user_agent text not null default '',
  platform text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (officer_id, device_hash)
);

-- Append-only audit trail of logins, device changes, lock/unlock actions.
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (
    event_type in (
      'login', 'new_device', 'locked', 'unlocked', 'alert_acknowledged',
      'login_created', 'password_reset', 'security_note'
    )
  ),
  device_hash text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

-- Keep the check constraint current when this file is re-applied.
alter table public.security_events
  drop constraint if exists security_events_event_type_check;
alter table public.security_events
  add constraint security_events_event_type_check check (
    event_type in (
      'login', 'new_device', 'locked', 'unlocked', 'alert_acknowledged',
      'login_created', 'password_reset', 'security_note'
    )
  );

-- Alarms shown in the red banner to the treasurer, president and secretary.
create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('new_device', 'lockdown')),
  severity text not null default 'warning' check (severity in ('warning', 'critical')),
  title text not null,
  message text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  device_hash text not null default '',
  created_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz
);

create index if not exists apartments_user_id_idx on public.apartments (user_id);
create index if not exists apartments_active_idx on public.apartments (is_active);
create index if not exists combined_members_apartment_idx
  on public.combined_apartment_members (apartment_id);
create index if not exists combined_members_combined_idx
  on public.combined_apartment_members (combined_id);
create index if not exists payments_month_idx on public.maintenance_payments (maintenance_month);
create index if not exists payments_apartment_idx on public.maintenance_payments (apartment_id);
create index if not exists payments_combined_idx on public.maintenance_payments (combined_id);
create index if not exists payments_status_idx on public.maintenance_payments (status);
create index if not exists payments_created_idx on public.maintenance_payments (created_at desc);
create index if not exists receipts_payment_idx on public.receipts (payment_id);
create index if not exists expenses_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_category_idx on public.expenses (category);
create index if not exists announcements_published_idx on public.announcements (published_at desc);
create index if not exists officer_devices_officer_idx on public.officer_devices (officer_id);
create index if not exists security_events_created_idx on public.security_events (created_at desc);
create index if not exists security_alerts_open_idx
  on public.security_alerts (created_at desc)
  where acknowledged_at is null;

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
-- These must be created after the tables above: PostgreSQL validates SQL
-- function bodies at creation time.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normalises a phone number to +91XXXXXXXXXX. Returns null when the input
-- cannot be a phone number. Mirrors normalisePhone() in src/lib/security.js.
create or replace function public.normalise_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(v_digits) = 10 then
    v_digits := '91' || v_digits;
  elsif length(v_digits) = 11 and left(v_digits, 1) = '0' then
    v_digits := '91' || right(v_digits, 10);
  end if;
  if v_digits !~ '^[1-9][0-9]{7,14}$' then
    return null;
  end if;
  return '+' || v_digits;
end;
$$;

-- The reserved Supabase Auth email for a resident phone number. It is only an
-- account key: no message is ever sent to it.
create or replace function public.resident_login_email(p_phone text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when public.normalise_phone(p_phone) is null then null
    else replace(public.normalise_phone(p_phone), '+', '') || '@residents.pafowa.in'
  end;
$$;

-- Role check that ignores the lock flag. Used only by the security RPCs so a
-- locked treasurer can still unlock their own account.
create or replace function public.officer_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('treasurer', 'president', 'secretary')
  );
$$;

-- Any unlocked committee officer. This is the read gate used by most policies:
-- president and secretary get full read access.
create or replace function public.is_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('treasurer', 'president', 'secretary')
      and not p.security_locked
  );
$$;

-- Write access is restricted to the treasurer.
create or replace function public.is_treasurer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'treasurer'
      and not p.security_locked
  );
$$;

create or replace function public.resident_apartment_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.apartments
  where user_id = auth.uid()
    and is_active;
$$;

create or replace function public.resident_combined_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct m.combined_id
  from public.combined_apartment_members m
  join public.combined_apartments g on g.id = m.combined_id
  where g.is_active
    and m.apartment_id in (
      select id from public.apartments where user_id = auth.uid() and is_active
    );
$$;

create or replace function public.owns_unit(
  p_apartment_id uuid,
  p_combined_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_apartment_id is not null then exists (
      select 1
      from public.apartments a
      where a.id = p_apartment_id
        and a.user_id = p_user_id
        and a.is_active
    )
    when p_combined_id is not null then exists (
      select 1
      from public.combined_apartment_members m
      join public.combined_apartments g on g.id = m.combined_id
      join public.apartments a on a.id = m.apartment_id
      where m.combined_id = p_combined_id
        and g.is_active
        and a.is_active
        and a.user_id = p_user_id
    )
    else false
  end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    case
      when coalesce(new.email, '') like '%@residents.pafowa.in' then null
      else nullif(coalesce(new.email, ''), '')
    end,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Member'),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone, ''),
    'resident'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Everyone may edit their name, but never their role, login email or login
-- phone. The phone is the sign-in identifier for every account. The lock flag
-- and login timestamp are written only by the security RPCs.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_treasurer() then
    if new.role is distinct from old.role then
      raise exception 'You cannot change your own role.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Ask the treasurer to change your login email.';
    end if;
  end if;

  if new.phone is distinct from old.phone then
    raise exception 'Login phone numbers are changed by the committee.';
  end if;

  if (
    new.security_locked is distinct from old.security_locked
    or new.security_locked_at is distinct from old.security_locked_at
    or new.security_locked_reason is distinct from old.security_locked_reason
    or new.last_login_at is distinct from old.last_login_at
  ) and coalesce(current_setting('pafowa.security_rpc', true), '') <> 'on' then
    raise exception 'Security fields can only be changed by the security functions.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- A confirmed payment is a permanent financial record.
create or replace function public.guard_payment_update()
returns trigger
language plpgsql
as $$
begin
  if new.apartment_id is distinct from old.apartment_id
    or new.combined_id is distinct from old.combined_id
    or new.maintenance_month is distinct from old.maintenance_month
    or new.amount_due is distinct from old.amount_due
    or new.amount_paid is distinct from old.amount_paid
    or new.payment_date is distinct from old.payment_date
    or new.payment_method is distinct from old.payment_method
    or new.submitted_by is distinct from old.submitted_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Core payment details cannot be changed after submission.';
  end if;

  if old.status = 'rejected' and new.status = 'pending' then
    raise exception 'Rejected payments cannot be reopened. Ask the resident to submit a new payment.';
  end if;

  if old.status = 'confirmed' and (
    new.status is distinct from old.status
    or new.transaction_id is distinct from old.transaction_id
    or new.upi_id is distinct from old.upi_id
    or new.receipt_number is distinct from old.receipt_number
    or new.confirmed_by is distinct from old.confirmed_by
    or new.confirmed_at is distinct from old.confirmed_at
  ) then
    raise exception 'Confirmed payments are locked and cannot be changed.';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_guard_update on public.maintenance_payments;
create trigger payments_guard_update
  before update on public.maintenance_payments
  for each row execute function public.guard_payment_update();

-- Combine units atomically and keep active memberships mutually exclusive.
create or replace function public.guard_combined_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_group_count integer;
begin
  select count(*)
    into active_group_count
  from public.combined_apartment_members m
  join public.combined_apartments g on g.id = m.combined_id
  where m.apartment_id = new.apartment_id
    and g.is_active
    and g.id <> new.combined_id;

  if active_group_count > 0 then
    raise exception 'This apartment is already part of another active combined unit.';
  end if;

  return new;
end;
$$;

drop trigger if exists combined_members_guard on public.combined_apartment_members;
create trigger combined_members_guard
  before insert or update on public.combined_apartment_members
  for each row execute function public.guard_combined_member();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists apartments_set_updated_at on public.apartments;
create trigger apartments_set_updated_at
  before update on public.apartments
  for each row execute function public.set_updated_at();

drop trigger if exists combined_set_updated_at on public.combined_apartments;
create trigger combined_set_updated_at
  before update on public.combined_apartments
  for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.maintenance_payments;
create trigger payments_set_updated_at
  before update on public.maintenance_payments
  for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.apartments enable row level security;
alter table public.combined_apartments enable row level security;
alter table public.combined_apartment_members enable row level security;
alter table public.maintenance_payments enable row level security;
alter table public.receipts enable row level security;
alter table public.expenses enable row level security;
alter table public.announcements enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.officer_devices enable row level security;
alter table public.security_events enable row level security;
alter table public.security_alerts enable row level security;

-- profiles --------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_officer());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'resident');

-- Column grants (see below) mean this policy can only ever change name/phone.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- apartments ------------------------------------------------------------------
drop policy if exists apartments_select on public.apartments;
create policy apartments_select on public.apartments
  for select to authenticated
  using (public.is_officer() or id in (select * from public.resident_apartment_ids()));

drop policy if exists apartments_insert on public.apartments;
create policy apartments_insert on public.apartments
  for insert to authenticated
  with check (public.is_treasurer());

drop policy if exists apartments_update on public.apartments;
create policy apartments_update on public.apartments
  for update to authenticated
  using (public.is_treasurer())
  with check (public.is_treasurer());

-- combined apartments ---------------------------------------------------------
drop policy if exists combined_select on public.combined_apartments;
create policy combined_select on public.combined_apartments
  for select to authenticated
  using (
    public.is_officer()
    or (is_active and id in (select * from public.resident_combined_ids()))
  );

drop policy if exists combined_members_select on public.combined_apartment_members;
create policy combined_members_select on public.combined_apartment_members
  for select to authenticated
  using (
    public.is_officer()
    or apartment_id in (select * from public.resident_apartment_ids())
    or combined_id in (select * from public.resident_combined_ids())
  );

-- payments --------------------------------------------------------------------
drop policy if exists payments_select on public.maintenance_payments;
create policy payments_select on public.maintenance_payments
  for select to authenticated
  using (
    public.is_officer()
    or submitted_by = auth.uid()
    or apartment_id in (select * from public.resident_apartment_ids())
    or combined_id in (select * from public.resident_combined_ids())
  );

drop policy if exists payments_insert on public.maintenance_payments;
create policy payments_insert on public.maintenance_payments
  for insert to authenticated
  with check (
    (
      public.is_treasurer()
      and status = 'pending'
    )
    or (
      status = 'pending'
      and submitted_by = auth.uid()
      and receipt_number is null
      and confirmed_by is null
      and confirmed_at is null
      and public.owns_unit(apartment_id, combined_id, auth.uid())
    )
  );

-- Updates are for rejections only. Confirmation must go through confirm_payment(),
-- which is the only code allowed to set status = 'confirmed' and issue a receipt.
drop policy if exists payments_update on public.maintenance_payments;
create policy payments_update on public.maintenance_payments
  for update to authenticated
  using (public.is_treasurer() and status <> 'confirmed')
  with check (public.is_treasurer() and status <> 'confirmed');

-- receipts --------------------------------------------------------------------
create or replace function public.can_view_payment(p_payment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maintenance_payments p
    where p.id = p_payment_id
      and (
        public.is_officer()
        or p.submitted_by = auth.uid()
        or p.apartment_id in (select * from public.resident_apartment_ids())
        or p.combined_id in (select * from public.resident_combined_ids())
      )
  );
$$;

drop policy if exists receipts_select on public.receipts;
create policy receipts_select on public.receipts
  for select to authenticated
  using (public.is_officer() or public.can_view_payment(payment_id));

drop policy if exists receipts_archive_update on public.receipts;
create policy receipts_archive_update on public.receipts
  for update to authenticated
  using (public.is_treasurer())
  with check (public.is_treasurer());

-- expenses (officers read, treasurer writes) ----------------------------------
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (public.is_officer());

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (public.is_treasurer());

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update to authenticated
  using (public.is_treasurer())
  with check (public.is_treasurer());

-- announcements ---------------------------------------------------------------
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (public.is_officer() or is_active);

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (public.is_treasurer());

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
  for update to authenticated
  using (public.is_treasurer())
  with check (public.is_treasurer());

-- security (officers read; rows are written by the security RPCs only) --------
drop policy if exists officer_devices_select on public.officer_devices;
create policy officer_devices_select on public.officer_devices
  for select to authenticated
  using (public.is_officer());

drop policy if exists security_events_select on public.security_events;
create policy security_events_select on public.security_events
  for select to authenticated
  using (public.is_officer());

drop policy if exists security_alerts_select on public.security_alerts;
create policy security_alerts_select on public.security_alerts
  for select to authenticated
  using (public.is_officer());

-- -----------------------------------------------------------------------------
-- Privileges: no DELETE on any financial table, for anyone using the API.
-- -----------------------------------------------------------------------------

revoke all on public.profiles from anon, authenticated;
revoke all on public.apartments from anon, authenticated;
revoke all on public.combined_apartments from anon, authenticated;
revoke all on public.combined_apartment_members from anon, authenticated;
revoke all on public.maintenance_payments from anon, authenticated;
revoke all on public.receipts from anon, authenticated;
revoke all on public.expenses from anon, authenticated;
revoke all on public.announcements from anon, authenticated;
revoke all on public.receipt_counters from anon, authenticated;
revoke all on public.officer_devices from anon, authenticated;
revoke all on public.security_events from anon, authenticated;
revoke all on public.security_alerts from anon, authenticated;

-- Column-level grants stop every client from touching role, email, the lock
-- flag or the login timestamp; those change only through security RPCs.
grant select on public.profiles to authenticated;
grant insert (id, email, full_name, phone, role) on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert, update on public.apartments to authenticated;
grant select on public.combined_apartments to authenticated;
grant select on public.combined_apartment_members to authenticated;
grant select, insert, update on public.maintenance_payments to authenticated;
grant select, update on public.receipts to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert, update on public.announcements to authenticated;
grant select on public.officer_devices to authenticated;
grant select on public.security_events to authenticated;
grant select on public.security_alerts to authenticated;

-- -----------------------------------------------------------------------------
-- Receipt numbering + confirmation RPC
-- -----------------------------------------------------------------------------

create or replace function public.next_receipt_number(p_year integer)
returns text
language plpgsql
as $$
declare
  v_next integer;
begin
  insert into public.receipt_counters (year, last_value)
  values (p_year, 1)
  on conflict (year) do update
    set last_value = public.receipt_counters.last_value + 1
  returning last_value into v_next;

  return format('PAFOWA-%s-%s', p_year, lpad(v_next::text, 4, '0'));
end;
$$;

create or replace function public.confirm_payment(p_payment_id uuid)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.maintenance_payments;
  v_receipt public.receipts;
  v_year integer;
  v_number text;
begin
  if not public.is_treasurer() then
    raise exception 'Only the treasurer can confirm payments.';
  end if;

  select * into v_payment
  from public.maintenance_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found.';
  end if;

  if v_payment.status = 'confirmed' then
    select * into v_receipt from public.receipts where payment_id = p_payment_id;
    if found then
      return v_receipt;
    end if;
    raise exception 'This payment is already confirmed.';
  end if;

  if v_payment.status = 'rejected' then
    raise exception 'This payment was rejected. Ask the resident to submit it again.';
  end if;

  v_year := extract(year from now())::integer;
  v_number := public.next_receipt_number(v_year);

  -- The receipt number is written in the same update because confirmed
  -- payments are locked by guard_payment_update() afterwards.
  update public.maintenance_payments
  set status = 'confirmed',
      confirmed_by = auth.uid(),
      confirmed_at = now(),
      receipt_number = v_number,
      updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  insert into public.receipts (
    payment_id,
    receipt_number,
    apartment_id,
    combined_id,
    resident_name,
    unit_label,
    maintenance_month,
    payment_date,
    amount,
    payment_method,
    transaction_id,
    upi_id,
    status,
    issued_at,
    issued_by
  )
  values (
    v_payment.id,
    v_number,
    v_payment.apartment_id,
    v_payment.combined_id,
    v_payment.resident_name,
    v_payment.unit_label,
    v_payment.maintenance_month,
    v_payment.payment_date,
    v_payment.amount_paid,
    v_payment.payment_method,
    v_payment.transaction_id,
    v_payment.upi_id,
    'confirmed',
    now(),
    auth.uid()
  )
  returning * into v_receipt;

  return v_receipt;
end;
$$;

-- -----------------------------------------------------------------------------
-- Combined unit RPCs
-- -----------------------------------------------------------------------------

create or replace function public.create_combined_unit(
  p_name text,
  p_amount numeric,
  p_apartment_ids uuid[],
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_name text;
  v_id uuid;
begin
  if not public.is_treasurer() then
    raise exception 'Only the treasurer can combine apartments.';
  end if;

  v_ids := array(select distinct unnest(coalesce(p_apartment_ids, '{}'::uuid[])));

  if coalesce(array_length(v_ids, 1), 0) < 2 then
    raise exception 'Select at least two apartments to combine.';
  end if;

  if exists (
    select 1
    from unnest(v_ids) selected(id)
    left join public.apartments a on a.id = selected.id
    where a.id is null or not a.is_active
  ) then
    raise exception 'Some selected apartments were not found or are inactive.';
  end if;

  if exists (
    select 1
    from public.combined_apartment_members m
    join public.combined_apartments g on g.id = m.combined_id
    where g.is_active and m.apartment_id = any (v_ids)
  ) then
    raise exception 'One of these apartments is already part of an active combined unit.';
  end if;

  select coalesce(
      nullif(trim(p_name), ''),
      string_agg(
        coalesce(nullif(a.display_label, ''), a.block || a.unit_number),
        ' + '
        order by a.block, a.unit_number
      )
    )
    into v_name
  from public.apartments a
  where a.id = any (v_ids);

  insert into public.combined_apartments (name, maintenance_amount, notes, is_active, created_by)
  values (v_name, coalesce(p_amount, 0), coalesce(trim(p_notes), ''), true, auth.uid())
  returning id into v_id;

  insert into public.combined_apartment_members (combined_id, apartment_id)
  select v_id, selected.id from unnest(v_ids) selected(id);

  return v_id;
end;
$$;

create or replace function public.update_combined_unit(
  p_combined_id uuid,
  p_name text default null,
  p_amount numeric default null,
  p_apartment_ids uuid[] default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.combined_apartments;
  v_ids uuid[];
begin
  if not public.is_treasurer() then
    raise exception 'Only the treasurer can update combined units.';
  end if;

  select * into v_group
  from public.combined_apartments
  where id = p_combined_id
  for update;

  if not found then
    raise exception 'Combined unit not found.';
  end if;

  if not v_group.is_active then
    raise exception 'This combined unit is no longer active.';
  end if;

  if p_apartment_ids is not null then
    v_ids := array(select distinct unnest(p_apartment_ids));

    if coalesce(array_length(v_ids, 1), 0) < 2 then
      raise exception 'A combined unit needs at least two apartments.';
    end if;

    if exists (
      select 1 from public.maintenance_payments where combined_id = p_combined_id
    ) then
      raise exception 'Members cannot be changed after payments exist. Separate the unit and create a new one.';
    end if;

    if exists (
      select 1
      from unnest(v_ids) selected(id)
      left join public.apartments a on a.id = selected.id
      where a.id is null or not a.is_active
    ) then
      raise exception 'Some selected apartments were not found or are inactive.';
    end if;

    if exists (
      select 1
      from public.combined_apartment_members m
      join public.combined_apartments g on g.id = m.combined_id
      where g.is_active
        and g.id <> p_combined_id
        and m.apartment_id = any (v_ids)
    ) then
      raise exception 'One of these apartments is already part of another active combined unit.';
    end if;

    delete from public.combined_apartment_members where combined_id = p_combined_id;
    insert into public.combined_apartment_members (combined_id, apartment_id)
    select p_combined_id, selected.id from unnest(v_ids) selected(id);
  end if;

  update public.combined_apartments
  set name = coalesce(nullif(trim(p_name), ''), name),
      maintenance_amount = coalesce(p_amount, maintenance_amount),
      notes = coalesce(p_notes, notes),
      updated_at = now()
  where id = p_combined_id;
end;
$$;

create or replace function public.separate_combined_unit(p_combined_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_treasurer() then
    raise exception 'Only the treasurer can separate combined units.';
  end if;

  update public.combined_apartments
  set is_active = false,
      updated_at = now()
  where id = p_combined_id;

  if not found then
    raise exception 'Combined unit not found.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resident logins
-- -----------------------------------------------------------------------------
-- The treasurer sets each resident's phone number and password, so the
-- association never needs an SMS provider. Each phone is stored as a Supabase
-- email account on the reserved @residents.pafowa.in domain; GoTrue only uses
-- that address as an account key and never sends anything to it. The password is
-- hashed with bcrypt exactly as Supabase Auth does.

create or replace function public.admin_create_resident_login(
  p_full_name text,
  p_phone text,
  p_password text,
  p_apartment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_login_email text;
  v_name text;
  v_user_id uuid := gen_random_uuid();
  v_apartment public.apartments;
begin
  if not public.is_treasurer() then
    raise exception 'Only the treasurer can create resident logins.';
  end if;

  v_phone := public.normalise_phone(p_phone);
  if v_phone is null then
    raise exception 'Enter a valid phone number.';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Use a password with at least 8 characters.';
  end if;

  v_login_email := public.resident_login_email(v_phone);
  v_name := coalesce(nullif(trim(p_full_name), ''), 'Resident');

  if p_apartment_id is not null then
    select * into v_apartment from public.apartments where id = p_apartment_id;
    if not found then
      raise exception 'That apartment does not exist.';
    end if;
    if v_apartment.user_id is not null then
      raise exception 'That apartment already has a linked login. Reset its password instead.';
    end if;
  end if;

  if exists (select 1 from public.profiles where phone = v_phone) then
    raise exception 'A login already exists for this phone number. Reset its password instead.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_login_email) then
    raise exception 'A login already exists for this phone number.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_login_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', v_name, 'phone', v_phone),
    '', '', '', ''
  );

  -- Password sign-in only needs the auth.users row. Identity layouts differ
  -- between auth versions, so a failed identity insert must not block the login.
  begin
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_login_email,
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_login_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    );
  exception when others then
    null;
  end;

  if p_apartment_id is not null then
    update public.apartments
    set user_id = v_user_id,
        resident_name = case
          when coalesce(trim(resident_name), '') = '' then v_name
          else resident_name
        end,
        contact_phone = case
          when coalesce(trim(contact_phone), '') = '' then v_phone
          else contact_phone
        end,
        updated_at = now()
    where id = p_apartment_id;
  end if;

  insert into public.security_events (actor_id, event_type, detail)
  values (
    auth.uid(),
    'login_created',
    'Created resident login for ' || v_name || ' (' || v_phone || ')'
  );

  return v_user_id;
end;
$$;

-- Treasurer-only. Works for resident and committee logins alike.
create or replace function public.admin_reset_password(
  p_profile_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_treasurer() then
    raise exception 'Only the treasurer can reset passwords.';
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Use a password with at least 8 characters.';
  end if;

  select * into v_profile from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'That login no longer exists.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = p_profile_id;

  if not found then
    raise exception 'That login no longer exists.';
  end if;

  insert into public.security_events (actor_id, event_type, detail)
  values (
    auth.uid(),
    'password_reset',
    'Changed the app password for ' || v_profile.full_name
      || ' (' || coalesce(nullif(v_profile.phone, ''), 'no phone') || ')'
  );
end;
$$;

-- Remove the pre-publish resident-only helper so re-runs stay clean.
drop function if exists public.admin_reset_resident_password(uuid, text);

-- Treasurer-only. Creates a phone login for a committee member. The first
-- treasurer is bootstrapped from the SQL editor (see below); after that every
-- committee login is created and reset from the Security page.
create or replace function public.admin_create_officer_login(
  p_full_name text,
  p_phone text,
  p_password text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_login_email text;
  v_name text;
  v_user_id uuid := gen_random_uuid();
begin
  if not public.is_treasurer() then
    raise exception 'Only the treasurer can create committee logins.';
  end if;

  if coalesce(p_role, '') not in ('treasurer', 'president', 'secretary') then
    raise exception 'Choose the role treasurer, president or secretary.';
  end if;

  v_phone := public.normalise_phone(p_phone);
  if v_phone is null then
    raise exception 'Enter a valid phone number.';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Use a password with at least 8 characters.';
  end if;

  v_login_email := public.resident_login_email(v_phone);
  v_name := coalesce(nullif(trim(p_full_name), ''), 'Committee member');

  if exists (select 1 from public.profiles where phone = v_phone) then
    raise exception 'A login already exists for this phone number. Reset its password instead.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_login_email) then
    raise exception 'A login already exists for this phone number.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_login_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', v_name, 'phone', v_phone),
    '', '', '', ''
  );

  -- Password sign-in only needs the auth.users row. Identity layouts differ
  -- between auth versions, so a failed identity insert must not block the login.
  begin
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_login_email,
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_login_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    );
  exception when others then
    null;
  end;

  update public.profiles
  set role = p_role,
      full_name = v_name,
      phone = v_phone,
      updated_at = now()
  where id = v_user_id;

  insert into public.security_events (actor_id, event_type, detail)
  values (
    auth.uid(),
    'login_created',
    'Created ' || p_role || ' login for ' || v_name || ' (' || v_phone || ')'
  );

  return v_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Treasurer bootstrap
-- -----------------------------------------------------------------------------
-- Run this once, for the first treasurer only, in the Supabase SQL editor:
--
--   select public.bootstrap_officer_login(
--     'Asha Rao', '+919840000000', 'StrongPass123', 'treasurer');
--
-- It creates the phone login with that role, or resets the password if the
-- account already exists. The treasurer then creates the president, secretary
-- and resident logins from the app. The SQL editor runs as the project owner,
-- and the execute privilege is revoked from PUBLIC and never granted to
-- authenticated, so app users cannot call it.
create or replace function public.bootstrap_officer_login(
  p_full_name text,
  p_phone text,
  p_password text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_login_email text;
  v_name text;
  v_user_id uuid;
begin
  if coalesce(p_role, '') not in ('treasurer', 'president', 'secretary') then
    raise exception 'Choose the role treasurer, president or secretary.';
  end if;

  v_phone := public.normalise_phone(p_phone);
  if v_phone is null then
    raise exception 'Enter a valid phone number.';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Use a password with at least 8 characters.';
  end if;

  v_login_email := public.resident_login_email(v_phone);
  v_name := coalesce(nullif(trim(p_full_name), ''), 'Committee member');

  select id into v_user_id
  from public.profiles
  where phone = v_phone
  order by created_at
  limit 1;
  if v_user_id is null then
    select id into v_user_id from auth.users where lower(email) = v_login_email;
  end if;

  if v_user_id is not null then
    update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_user_id;

    update public.profiles
    set role = p_role,
        full_name = v_name,
        phone = v_phone,
        updated_at = now()
    where id = v_user_id;

    return v_user_id;
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_login_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', v_name, 'phone', v_phone),
    '', '', '', ''
  );

  -- Password sign-in only needs the auth.users row. Identity layouts differ
  -- between auth versions, so a failed identity insert must not block the login.
  begin
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_login_email,
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_login_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    );
  exception when others then
    null;
  end;

  update public.profiles
  set role = p_role,
      full_name = v_name,
      phone = v_phone,
      updated_at = now()
  where id = v_user_id;

  return v_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Login security RPCs
-- -----------------------------------------------------------------------------

-- Called once per app session after authentication. Records the device,
-- updates last_login_at and raises an alarm the first time an officer signs in
-- from an unknown device.
create or replace function public.register_login(
  p_device_hash text,
  p_platform text default '',
  p_user_agent text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_device public.officer_devices;
  v_is_officer boolean;
  v_new_device boolean := false;
  v_open_alerts integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before registering a device.';
  end if;

  if coalesce(trim(p_device_hash), '') = '' then
    raise exception 'A device fingerprint is required.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Your profile was not found. Ask the treasurer to check your account.';
  end if;

  if v_profile.security_locked then
    raise exception 'This account is locked. Contact the treasurer.';
  end if;

  v_is_officer := v_profile.role in ('treasurer', 'president', 'secretary');

  perform set_config('pafowa.security_rpc', 'on', true);

  update public.profiles
  set last_login_at = now()
  where id = auth.uid();

  if v_is_officer then
    select * into v_device
    from public.officer_devices
    where officer_id = auth.uid()
      and device_hash = p_device_hash;

    if found then
      update public.officer_devices
      set last_seen_at = now()
      where id = v_device.id;

      insert into public.security_events (actor_id, event_type, device_hash, detail)
      values (auth.uid(), 'login', p_device_hash, 'Known device sign-in');
    else
      v_new_device := true;

      insert into public.officer_devices (officer_id, device_hash, user_agent, platform)
      values (
        auth.uid(),
        p_device_hash,
        left(coalesce(p_user_agent, ''), 400),
        left(coalesce(p_platform, ''), 120)
      );

      insert into public.security_events (actor_id, event_type, device_hash, detail)
      values (
        auth.uid(),
        'new_device',
        p_device_hash,
        'First sign-in as ' || v_profile.role
      );

      insert into public.security_alerts (kind, severity, title, message, actor_id, device_hash)
      values (
        'new_device',
        'warning',
        'New sign-in to the ' || v_profile.role || ' account',
        v_profile.full_name || ' signed in from a device the committee has not seen before. '
          || 'If this was not them, lock the account from the Security page.',
        auth.uid(),
        p_device_hash
      );
    end if;
  end if;

  select count(*) into v_open_alerts
  from public.security_alerts
  where acknowledged_at is null;

  return jsonb_build_object(
    'new_device', v_new_device,
    'role', v_profile.role,
    'open_alerts', v_open_alerts
  );
end;
$$;

create or replace function public.acknowledge_alert(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_officer() then
    raise exception 'Only committee officers can acknowledge alerts.';
  end if;

  update public.security_alerts
  set acknowledged_by = auth.uid(),
      acknowledged_at = now()
  where id = p_alert_id
    and acknowledged_at is null;

  if not found then
    raise exception 'Alert not found or already acknowledged.';
  end if;

  insert into public.security_events (actor_id, event_type, detail)
  values (auth.uid(), 'alert_acknowledged', 'Alert ' || p_alert_id || ' acknowledged');
end;
$$;

create or replace function public.lock_officer(
  p_officer_id uuid,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles;
  v_caller public.profiles;
begin
  if not public.is_officer() then
    raise exception 'Only active committee officers can lock an account.';
  end if;

  select * into v_target from public.profiles where id = p_officer_id;
  if not found or v_target.role not in ('treasurer', 'president', 'secretary') then
    raise exception 'Only committee officer accounts can be locked.';
  end if;

  select * into v_caller from public.profiles where id = auth.uid();

  perform set_config('pafowa.security_rpc', 'on', true);

  update public.profiles
  set security_locked = true,
      security_locked_at = now(),
      security_locked_reason = coalesce(nullif(trim(p_reason), ''), 'Locked by a committee officer.'),
      updated_at = now()
  where id = p_officer_id;

  insert into public.security_events (actor_id, event_type, detail)
  values (
    auth.uid(),
    'locked',
    'Locked ' || v_target.full_name || ' (' || v_target.role || ')'
  );

  insert into public.security_alerts (kind, severity, title, message, actor_id)
  values (
    'lockdown',
    'critical',
    'Officer account locked',
    v_target.full_name || ' (' || v_target.role || ') was locked by '
      || coalesce(v_caller.full_name, 'a committee officer') || '.',
    auth.uid()
  );
end;
$$;

-- The treasurer can unlock any officer, including their own account. Other
-- officers need the treasurer.
create or replace function public.unlock_officer(p_officer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles;
  v_caller public.profiles;
begin
  if not public.officer_session() then
    raise exception 'Sign in as a committee member first.';
  end if;

  select * into v_caller from public.profiles where id = auth.uid();
  if v_caller.role <> 'treasurer' then
    raise exception 'Only the treasurer can unlock an account.';
  end if;

  select * into v_target from public.profiles where id = p_officer_id;
  if not found or v_target.role not in ('treasurer', 'president', 'secretary') then
    raise exception 'Only committee officer accounts can be unlocked.';
  end if;

  if not v_target.security_locked then
    raise exception 'This account is not locked.';
  end if;

  perform set_config('pafowa.security_rpc', 'on', true);

  update public.profiles
  set security_locked = false,
      security_locked_at = null,
      security_locked_reason = null,
      updated_at = now()
  where id = p_officer_id;

  insert into public.security_events (actor_id, event_type, detail)
  values (
    auth.uid(),
    'unlocked',
    'Unlocked ' || v_target.full_name || ' (' || v_target.role || ')'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------

revoke all on function public.set_updated_at() from public;
revoke all on function public.normalise_phone(text) from public;
revoke all on function public.resident_login_email(text) from public;
revoke all on function public.officer_session() from public;
revoke all on function public.is_officer() from public;
revoke all on function public.is_treasurer() from public;
revoke all on function public.resident_apartment_ids() from public;
revoke all on function public.resident_combined_ids() from public;
revoke all on function public.owns_unit(uuid, uuid, uuid) from public;
revoke all on function public.can_view_payment(uuid) from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.guard_profile_update() from public;
revoke all on function public.guard_payment_update() from public;
revoke all on function public.guard_combined_member() from public;
revoke all on function public.next_receipt_number(integer) from public;
revoke all on function public.admin_create_resident_login(text, text, text, uuid) from public;
revoke all on function public.admin_create_officer_login(text, text, text, text) from public;
revoke all on function public.admin_reset_password(uuid, text) from public;
revoke all on function public.bootstrap_officer_login(text, text, text, text) from public;
revoke all on function public.register_login(text, text, text) from public;
revoke all on function public.acknowledge_alert(uuid) from public;
revoke all on function public.lock_officer(uuid, text) from public;
revoke all on function public.unlock_officer(uuid) from public;

grant execute on function public.is_officer() to authenticated;
grant execute on function public.is_treasurer() to authenticated;
grant execute on function public.resident_apartment_ids() to authenticated;
grant execute on function public.resident_combined_ids() to authenticated;
grant execute on function public.owns_unit(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_view_payment(uuid) to authenticated;
grant execute on function public.confirm_payment(uuid) to authenticated;
grant execute on function public.create_combined_unit(text, numeric, uuid[], text) to authenticated;
grant execute on function public.update_combined_unit(uuid, text, numeric, uuid[], text) to authenticated;
grant execute on function public.separate_combined_unit(uuid) to authenticated;
grant execute on function public.admin_create_resident_login(text, text, text, uuid) to authenticated;
grant execute on function public.admin_create_officer_login(text, text, text, text) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
grant execute on function public.register_login(text, text, text) to authenticated;
grant execute on function public.acknowledge_alert(uuid) to authenticated;
grant execute on function public.lock_officer(uuid, text) to authenticated;
grant execute on function public.unlock_officer(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Private Storage buckets
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vouchers',
    'vouchers',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  ),
  (
    'receipts',
    'receipts',
    false,
    5242880,
    array['application/pdf']
  )
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pafowa_vouchers_select on storage.objects;
create policy pafowa_vouchers_select on storage.objects
  for select to authenticated
  using (bucket_id = 'vouchers' and public.is_officer());

drop policy if exists pafowa_vouchers_insert on storage.objects;
create policy pafowa_vouchers_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vouchers' and public.is_treasurer());

drop policy if exists pafowa_vouchers_update on storage.objects;
create policy pafowa_vouchers_update on storage.objects
  for update to authenticated
  using (bucket_id = 'vouchers' and public.is_treasurer())
  with check (bucket_id = 'vouchers' and public.is_treasurer());

drop policy if exists pafowa_receipts_select on storage.objects;
create policy pafowa_receipts_select on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_officer());

drop policy if exists pafowa_receipts_insert on storage.objects;
create policy pafowa_receipts_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_treasurer());

drop policy if exists pafowa_receipts_update on storage.objects;
create policy pafowa_receipts_update on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and public.is_treasurer())
  with check (bucket_id = 'receipts' and public.is_treasurer());
