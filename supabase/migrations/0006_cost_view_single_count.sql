-- Each expense is counted exactly once, so category rows always add up to the total expense.
-- Category = top-level part of a tag's path ("Casa / Jardim" -> "Casa"). Tag names carry their full path,
-- so this does not depend on the tags table. A transaction whose tags roll up to several different
-- top-level categories has its amount split equally between them; repeated roots count once.

create or replace view cost_by_category_month with (security_invoker = true) as
with expense as (
  select
    owner_id,
    date_trunc('month', date)::date as month,
    abs(amount) as amount,
    coalesce(
      (select array_agg(distinct nullif(trim(split_part(tag, ' / ', 1)), ''))
         from unnest(tags) as tag
        where nullif(trim(split_part(tag, ' / ', 1)), '') is not null),
      array['Uncategorised']
    ) as roots
  from transactions
  where type = 'expense' and not is_pending
)
select
  owner_id,
  month,
  root as category,
  sum(amount / cardinality(roots)) as expense
from expense, unnest(roots) as root
group by 1, 2, 3;
