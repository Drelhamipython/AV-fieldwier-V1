-- Optional indexes for Spreadsheet Import Center upserts.
-- Run this in the Supabase SQL editor if you want "Upsert / update existing"
-- to update matching rows instead of falling back to regular inserts.
-- These indexes do not change app login, storage, or security policies.

create unique index if not exists projects_import_unique_idx
  on public.projects (name, address);

create unique index if not exists subcontractors_import_unique_idx
  on public.subcontractors (company, email);

create unique index if not exists bid_tracker_import_unique_idx
  on public.bid_tracker (project_id, trade, company);

create unique index if not exists tasks_import_unique_idx
  on public.tasks (project_id, title, location);

create unique index if not exists daily_logs_import_unique_idx
  on public.daily_logs (project_id, log_date);

create unique index if not exists rfis_import_unique_idx
  on public.rfis (project_id, title);

create unique index if not exists plans_import_unique_idx
  on public.plans (project_id, sheet_no, revision);
