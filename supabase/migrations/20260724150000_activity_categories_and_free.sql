-- Activity categories refresh: remap values, clear subtypes, add is_free

alter table public.events
  add column if not exists is_free boolean not null default false;

-- Remap legacy category array values to the new set
update public.events
set category = (
  select coalesce(array_agg(distinct mapped), '{}')
  from (
    select case c
      when 'camp' then 'camp'
      when 'class' then 'classes_lessons'
      when 'event' then 'events_experiences'
      when 'sport' then 'sports_teams'
      when 'general_interest' then 'community'
      when 'camps' then 'camp'
      when 'classes_lessons' then 'classes_lessons'
      when 'childcare_enrichment' then 'childcare_enrichment'
      when 'community' then 'community'
      when 'events_experiences' then 'events_experiences'
      when 'sports_teams' then 'sports_teams'
      else null
    end as mapped
    from unnest(coalesce(category, '{}')) as c
  ) s
  where mapped is not null
);

-- Subtypes/subcategories no longer used
update public.events set subcategory = '{}';

-- Backfill free flag from cost text
update public.events
set is_free = true
where is_free = false
  and (
    lower(trim(coalesce(cost, ''))) in ('free', 'no cost', '$0', '$0.00')
    or lower(coalesce(cost, '')) like '%free%'
  );

alter table public.saved_filters
  add column if not exists free_only boolean not null default false;

-- Keep subcategory column for compatibility but stop relying on it
update public.saved_filters
set category = case category
  when 'class' then 'classes_lessons'
  when 'event' then 'events_experiences'
  when 'sport' then 'sports_teams'
  when 'general_interest' then 'community'
  else category
end
where category is not null;

update public.saved_filters set subcategory = null;

grant select, insert, update, delete on public.events to authenticated;
grant all on table public.events to service_role;
