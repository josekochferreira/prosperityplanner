-- Expense totals per owner, month and category (first tag; "Uncategorised" if none).
-- Matches cashflow.py: only type = 'expense', pending/future-dated rows excluded.
-- security_invoker: the dashboard reads this as the signed-in user, so RLS applies.
create view cost_by_category_month with (security_invoker = true) as
select
  owner_id,
  date_trunc('month', date)::date as month,
  coalesce(tags[1], 'Uncategorised') as category,
  sum(abs(amount)) as expense
from transactions
where type = 'expense' and not is_pending
group by 1, 2, 3;

grant select on cost_by_category_month to authenticated;
