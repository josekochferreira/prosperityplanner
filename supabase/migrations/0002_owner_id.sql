-- Multi-tenancy: every row belongs to a Supabase Auth user.
-- Agents run server-side with the service-role key and must set owner_id explicitly.
-- Signed-in users get read-only access to their own rows; writes stay agent-only.

alter table accounts     add column owner_id uuid references auth.users (id) on delete cascade;
alter table transactions add column owner_id uuid references auth.users (id) on delete cascade;
alter table agent_runs   add column owner_id uuid references auth.users (id) on delete cascade;

-- Backfill existing rows when there is exactly one user (the single-user case).
do $$
declare sole uuid;
begin
  if (select count(*) from auth.users) = 1 then
    select id into sole from auth.users;
    update accounts     set owner_id = sole where owner_id is null;
    update transactions set owner_id = sole where owner_id is null;
    update agent_runs   set owner_id = sole where owner_id is null;
  end if;
end $$;

-- Fails loudly if any row is still unowned (e.g. data exists but no/many users).
alter table accounts     alter column owner_id set not null;
alter table transactions alter column owner_id set not null;
alter table agent_runs   alter column owner_id set not null;

alter table accounts     drop constraint accounts_source_source_id_key;
alter table transactions drop constraint transactions_source_source_id_key;
alter table accounts     add constraint accounts_owner_source_key     unique (owner_id, source, source_id);
alter table transactions add constraint transactions_owner_source_key unique (owner_id, source, source_id);

drop index transactions_date_idx;
create index transactions_owner_date_idx on transactions (owner_id, date);
create index agent_runs_owner_started_idx on agent_runs (owner_id, started_at desc);

create policy "owner can read accounts"     on accounts     for select to authenticated using (owner_id = auth.uid());
create policy "owner can read transactions" on transactions for select to authenticated using (owner_id = auth.uid());
create policy "owner can read agent runs"   on agent_runs   for select to authenticated using (owner_id = auth.uid());

-- security_invoker means the view applies the caller's RLS; owner_id in the
-- grouping keeps the service-role (RLS-bypassing) path from mixing users.
drop view cashflow_monthly;
create view cashflow_monthly with (security_invoker = true) as
select
  owner_id,
  date_trunc('month', date)::date as month,
  sum(abs(amount)) filter (where type in ('income','refund')) as income,
  sum(abs(amount)) filter (where type = 'expense')            as expense,
  coalesce(sum(abs(amount)) filter (where type in ('income','refund')), 0)
    - coalesce(sum(abs(amount)) filter (where type = 'expense'), 0) as net
from transactions
where type in ('income','refund','expense') and not is_pending
group by 1, 2
order by 1, 2;
