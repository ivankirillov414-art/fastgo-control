begin;
alter table public.arise_skill_evidence add column if not exists file_path text;
alter table public.arise_skill_evidence add column if not exists file_name text;
alter table public.arise_skill_evidence add column if not exists mime_type text;
alter table public.arise_boss_progress add column if not exists file_path text;
alter table public.arise_boss_progress add column if not exists file_name text;
alter table public.arise_boss_progress add column if not exists mime_type text;
commit;
