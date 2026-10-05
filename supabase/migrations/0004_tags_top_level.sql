-- Buxfer tag tree, so expenses can be rolled up to their top-level category.
-- Synced by the Buxfer agent (service-role key); signed-in users read their own rows.

create table tags (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  source           text not null,
  source_id        text not null,
  name             text not null,
  parent_source_id text,               -- null for a top-level tag
  raw              jsonb not null,
  synced_at        timestamptz not null default now(),
  unique (owner_id, source, source_id)
);

alter table tags enable row level security;
create policy "owner can read tags" on tags for select to authenticated using (owner_id = auth.uid());

-- Each tag name -> the name of its top-level ancestor.
-- Transactions carry tag names, not ids, so this is keyed by name. A name used
-- under several different roots (e.g. "Other") is ambiguous and maps to itself.
create view tag_roots with (security_invoker = true) as
with recursive walk as (
  select owner_id, source, source_id, name, parent_source_id, name as root, 0 as depth
  from tags
  union all
  select w.owner_id, w.source, w.source_id, w.name, p.parent_source_id, p.name, w.depth + 1
  from walk w
  join tags p on p.owner_id = w.owner_id and p.source = w.source and p.source_id = w.parent_source_id
  where w.depth < 10
),
roots as (
  select owner_id, name, root from walk where parent_source_id is null
)
select owner_id, name, case when count(distinct root) = 1 then min(root) else name end as root
from roots
group by owner_id, name;

grant select on tag_roots to authenticated;

-- Same columns as before, but category is now the top-level category of the first tag.
-- Tags missing from the tree (e.g. not synced yet) are kept as they are.
create or replace view cost_by_category_month with (security_invoker = true) as
select
  t.owner_id,
  date_trunc('month', t.date)::date as month,
  coalesce(r.root, t.tags[1], 'Uncategorised') as category,
  sum(abs(t.amount)) as expense
from transactions t
left join tag_roots r on r.owner_id = t.owner_id and r.name = t.tags[1]
where t.type = 'expense' and not t.is_pending
group by 1, 2, 3;
