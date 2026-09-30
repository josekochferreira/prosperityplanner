-- Prosperity Planner: core schema for ingested financial data.
-- RLS is enabled with no policies: only the service-role key (server-side agents)
-- can read/write. Add owner_id + per-user policies before exposing to a browser client.

create table accounts (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  source_id   text not null,
  name        text not null,
  bank        text,
  currency    text,
  balance     numeric(18,2),
  raw         jsonb not null,
  synced_at   timestamptz not null default now(),
  unique (source, source_id)
);

create table transactions (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,
  source_id   text not null,
  account_source_id text,
  account_name text,
  date        date not null,
  description text,
  type        text not null,          -- income | expense | transfer | refund | ...
  amount      numeric(18,2) not null, -- signed, as reported by the source
  tags        text[] not null default '{}',
  is_pending  boolean not null default false,
  raw         jsonb not null,
  synced_at   timestamptz not null default now(),
  unique (source, source_id)
);
create index transactions_date_idx on transactions (date);

create table agent_runs (
  id            uuid primary key default gen_random_uuid(),
  agent         text not null,
  status        text not null default 'running' check (status in ('running','succeeded','failed')),
  params        jsonb not null default '{}',
  rows_fetched  integer,
  rows_upserted integer,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

alter table accounts     enable row level security;
alter table transactions enable row level security;
alter table agent_runs   enable row level security;

-- Income vs. expenses per month. Transfers, investments etc. are excluded;
-- pending/future-dated rows are excluded to match cashflow.py defaults.
create view cashflow_monthly with (security_invoker = true) as
select
  date_trunc('month', date)::date as month,
  sum(abs(amount)) filter (where type in ('income','refund')) as income,
  sum(abs(amount)) filter (where type = 'expense')            as expense,
  coalesce(sum(abs(amount)) filter (where type in ('income','refund')), 0)
    - coalesce(sum(abs(amount)) filter (where type = 'expense'), 0) as net
from transactions
where type in ('income','refund','expense') and not is_pending
group by 1
order by 1;
