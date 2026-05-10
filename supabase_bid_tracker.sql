create table if not exists public.bid_tracker (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  trade text not null check (trade in ('Site Preparation','Foundation','Framing')),
  company text,
  contact_name text,
  email text,
  phone text,
  website text,
  email_sent_date date,
  follow_up_date date,
  site_visit_needed boolean not null default false,
  site_visit_date date,
  quote_received boolean not null default false,
  quote_amount numeric(12,2),
  turnkey boolean not null default false,
  labor_included boolean not null default false,
  materials_included boolean not null default false,
  equipment_included boolean not null default false,
  cleanup_included boolean not null default false,
  permits_included boolean not null default false,
  inspections_included boolean not null default false,
  missing_scope_items text,
  status text not null default 'Not Contacted' check (
    status in (
      'Not Contacted',
      'Email Sent',
      'Followed Up',
      'Site Visit Scheduled',
      'Quote Received',
      'Need Clarification',
      'Shortlisted',
      'Selected',
      'Rejected',
      'Contract Signed'
    )
  ),
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bid_tracker_project_id_idx on public.bid_tracker(project_id);
create index if not exists bid_tracker_trade_idx on public.bid_tracker(trade);
create index if not exists bid_tracker_status_idx on public.bid_tracker(status);
create index if not exists bid_tracker_follow_up_date_idx on public.bid_tracker(follow_up_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_bid_tracker_updated_at on public.bid_tracker;
create trigger set_bid_tracker_updated_at
before update on public.bid_tracker
for each row
execute function public.set_updated_at();

alter table public.bid_tracker enable row level security;

drop policy if exists "Authenticated users can read bid tracker" on public.bid_tracker;
create policy "Authenticated users can read bid tracker"
on public.bid_tracker
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert bid tracker" on public.bid_tracker;
create policy "Authenticated users can insert bid tracker"
on public.bid_tracker
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update bid tracker" on public.bid_tracker;
create policy "Authenticated users can update bid tracker"
on public.bid_tracker
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete bid tracker" on public.bid_tracker;
create policy "Authenticated users can delete bid tracker"
on public.bid_tracker
for delete
to authenticated
using (true);
