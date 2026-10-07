-- Sharesight portfolio data. Same model as Buxfer tables: owner_id multi-tenancy,
-- agent-only writes (service role), owner read-only via RLS, full API payload kept in raw.
-- Headline columns are best-effort extractions (Sharesight V3 is beta, fields are often
-- omitted), so every one is nullable and raw is the source of truth.

create table sharesight_portfolios (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  source_id   text not null,
  name        text not null,
  currency    text,
  raw         jsonb not null,
  synced_at   timestamptz not null default now(),
  unique (owner_id, source_id)
);

-- One row per portfolio per snapshot date (re-running the same day overwrites it).
create table sharesight_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  portfolio_source_id text not null,
  snapshot_date      date not null,
  period_start       date,
  period_end         date,
  value              numeric(18,2),
  cost_base          numeric(18,2),
  capital_gain       numeric(18,2),
  payout_gain        numeric(18,2),
  currency_gain      numeric(18,2),
  total_gain         numeric(18,2),
  total_gain_percent numeric(12,4),
  raw                jsonb not null,
  synced_at          timestamptz not null default now(),
  unique (owner_id, portfolio_source_id, snapshot_date)
);
create index sharesight_snapshots_owner_date_idx on sharesight_snapshots (owner_id, snapshot_date desc);

-- Holdings as seen on each snapshot date, giving a position history.
create table sharesight_holdings (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  portfolio_source_id text not null,
  snapshot_date      date not null,
  source_id          text not null,
  symbol             text,
  name               text,
  value              numeric(18,2),
  total_gain         numeric(18,2),
  total_gain_percent numeric(12,4),
  raw                jsonb not null,
  synced_at          timestamptz not null default now(),
  unique (owner_id, portfolio_source_id, snapshot_date, source_id)
);
create index sharesight_holdings_owner_date_idx on sharesight_holdings (owner_id, snapshot_date desc);

alter table sharesight_portfolios enable row level security;
alter table sharesight_snapshots  enable row level security;
alter table sharesight_holdings   enable row level security;

create policy "owner can read sharesight portfolios" on sharesight_portfolios for select to authenticated using (owner_id = auth.uid());
create policy "owner can read sharesight snapshots"  on sharesight_snapshots  for select to authenticated using (owner_id = auth.uid());
create policy "owner can read sharesight holdings"   on sharesight_holdings   for select to authenticated using (owner_id = auth.uid());
