create extension if not exists "pgcrypto";

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null,
  location text not null,
  price_per_player integer not null check (price_per_player >= 0),
  active_capacity integer not null check (active_capacity in (12, 18, 20)),
  status text not null check (status in ('open', 'closed', 'finished')) default 'open',
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  position integer not null,
  status text not null check (status in ('confirmed', 'waitlist', 'cancelled', 'replacement')),
  accepted_terms boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists cancellations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  action_type text not null check (action_type in ('cancel', 'cancel_with_replacement', 'replacement')),
  declared_status text not null check (declared_status in ('confirmed', 'waitlist', 'unknown')),
  has_replacement boolean not null default false,
  replacement_name text,
  note text,
  admin_decision text not null check (admin_decision in ('pending', 'waived', 'debt', 'replaced')) default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  amount integer not null check (amount >= 0),
  status text not null check (status in ('pending', 'paid', 'waived')) default 'pending',
  reason text,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  attended boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

insert into matches (id, date, time, location, price_per_player, active_capacity, status)
values ('00000000-0000-0000-0000-000000000001', '2026-06-29', '8:00 p.m.', 'Cancha sintética La 70', 18000, 12, 'open')
on conflict (id) do nothing;

with seed_players(name, pos) as (
  values
    ('Andrés Rojas', 1),
    ('Camilo Pérez', 2),
    ('Santiago Mora', 3),
    ('Felipe Gómez', 4),
    ('Juan Herrera', 5),
    ('Diego Castro', 6),
    ('Nicolás Vega', 7),
    ('Mateo Arias', 8),
    ('Luis Medina', 9),
    ('Carlos Duarte', 10),
    ('Sebastián León', 11),
    ('Tomás Rincón', 12),
    ('Iván Salazar', 13),
    ('Daniel Torres', 14),
    ('Miguel Cárdenas', 15)
),
inserted_players as (
  insert into players (name)
  select name from seed_players
  on conflict do nothing
  returning id, name
)
insert into registrations (match_id, player_id, position, status, accepted_terms)
select
  '00000000-0000-0000-0000-000000000001',
  players.id,
  seed_players.pos,
  case when seed_players.pos <= 12 then 'confirmed' else 'waitlist' end,
  true
from seed_players
join players on players.name = seed_players.name
on conflict do nothing;

-- Production security model
-- Public users use anon access only for safe reads and controlled inserts.
-- Admin operations must go through server-side routes/functions that use the Supabase
-- service_role key on the server only. Never expose service_role in frontend code.

alter table matches enable row level security;
alter table players enable row level security;
alter table registrations enable row level security;
alter table cancellations enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;

alter table matches force row level security;
alter table players force row level security;
alter table registrations force row level security;
alter table cancellations force row level security;
alter table payments force row level security;
alter table attendance force row level security;

drop policy if exists "Public can view active matches" on matches;
drop policy if exists "Public can create players for signup flow" on players;
drop policy if exists "Public can create registrations for active matches" on registrations;
drop policy if exists "Public can create cancellations for active matches" on cancellations;

revoke all on matches from anon, authenticated;
revoke all on players from anon, authenticated;
revoke all on registrations from anon, authenticated;
revoke all on cancellations from anon, authenticated;
revoke all on payments from anon, authenticated;
revoke all on attendance from anon, authenticated;

create policy "Public can view active matches"
on matches
for select
to anon, authenticated
using (status = 'open');

grant select on matches to anon, authenticated;

-- Direct player reads are intentionally not granted, because phone is sensitive.
-- Direct writes to players, registrations, and cancellations are also not granted.
-- Public creation happens through the SECURITY DEFINER functions below so users
-- cannot choose their own position, status, debt decision, or administrative fields.

-- Public read model: expose names and list status, never phone numbers.
drop view if exists public_match_registrations;
create view public_match_registrations as
select
  registrations.id,
  registrations.match_id,
  registrations.position,
  registrations.status,
  registrations.created_at,
  players.name as player_name
from registrations
join players on players.id = registrations.player_id
join matches on matches.id = registrations.match_id
where matches.status = 'open'
  and registrations.status in ('confirmed', 'waitlist');

revoke all on public_match_registrations from public;
grant select on public_match_registrations to anon, authenticated;

-- Controlled public signup helper. This avoids exposing phone through reads and keeps
-- position/status calculation inside the database.
drop function if exists public_create_registration(text, text, uuid);
create or replace function public_create_registration(
  p_player_name text,
  p_player_phone text default null,
  p_target_match_id uuid default null
)
returns table (
  registration_id uuid,
  result_match_id uuid,
  result_position integer,
  result_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_match matches%rowtype;
  selected_player_id uuid;
  next_position integer;
  calculated_status text;
begin
  if length(btrim(p_player_name)) < 3 then
    raise exception 'Nombre inválido';
  end if;

  select m.*
  into selected_match
  from matches m
  where m.status = 'open'
    and (p_target_match_id is null or m.id = p_target_match_id)
  order by m.date asc
  limit 1;

  if selected_match.id is null then
    raise exception 'No hay partido abierto';
  end if;

  insert into players (name, phone)
  values (btrim(p_player_name), nullif(btrim(coalesce(p_player_phone, '')), ''))
  returning id into selected_player_id;

  select coalesce(max(registrations.position), 0) + 1
  into next_position
  from registrations
  where registrations.match_id = selected_match.id
    and registrations.status <> 'cancelled';

  calculated_status := case
    when next_position <= selected_match.active_capacity then 'confirmed'
    else 'waitlist'
  end;

  insert into registrations (match_id, player_id, position, status, accepted_terms)
  values (selected_match.id, selected_player_id, next_position, calculated_status, true)
  returning registrations.id, registrations.match_id, registrations.position, registrations.status
  into registration_id, result_match_id, result_position, result_status;

  return next;
end;
$$;

revoke all on function public_create_registration(text, text, uuid) from public;
grant execute on function public_create_registration(text, text, uuid) to anon, authenticated;

drop function if exists public_create_cancellation(text, text, text, boolean, text, text, uuid);
create or replace function public_create_cancellation(
  p_player_name text,
  p_action_type text,
  p_declared_status text,
  p_has_replacement boolean default false,
  p_replacement_name text default null,
  p_note text default null,
  p_target_match_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_match_id uuid;
  selected_player_id uuid;
  cancellation_id uuid;
begin
  if length(btrim(p_player_name)) < 3 then
    raise exception 'Nombre inválido';
  end if;

  if p_action_type not in ('cancel', 'cancel_with_replacement', 'replacement') then
    raise exception 'Acción inválida';
  end if;

  if p_declared_status not in ('confirmed', 'waitlist', 'unknown') then
    raise exception 'Estado inválido';
  end if;

  select m.id
  into selected_match_id
  from matches m
  where m.status = 'open'
    and (p_target_match_id is null or m.id = p_target_match_id)
  order by m.date asc
  limit 1;

  if selected_match_id is null then
    raise exception 'No hay partido abierto';
  end if;

  select players.id
  into selected_player_id
  from players
  where lower(players.name) = lower(btrim(p_player_name))
  order by created_at desc
  limit 1;

  if selected_player_id is null then
    insert into players (name)
    values (btrim(p_player_name))
    returning id into selected_player_id;
  end if;

  insert into cancellations (
    match_id,
    player_id,
    action_type,
    declared_status,
    has_replacement,
    replacement_name,
    note,
    admin_decision
  )
  values (
    selected_match_id,
    selected_player_id,
    p_action_type,
    p_declared_status,
    coalesce(p_has_replacement, false),
    nullif(btrim(coalesce(p_replacement_name, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    'pending'
  )
  returning id into cancellation_id;

  return cancellation_id;
end;
$$;

revoke all on function public_create_cancellation(text, text, text, boolean, text, text, uuid) from public;
grant execute on function public_create_cancellation(text, text, text, boolean, text, text, uuid) to anon, authenticated;

-- No anon/authenticated policies are created for payments or attendance.
-- No anon/authenticated update/delete policies are created for administrative fields.
-- Use server-side admin endpoints with SUPABASE_SERVICE_ROLE_KEY stored only in server
-- environment variables to manage payments, attendance, debts, and admin decisions.
