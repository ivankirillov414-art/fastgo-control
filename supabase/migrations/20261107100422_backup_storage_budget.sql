-- Count actual encrypted objects, including partial/orphaned uploads and manual
-- objects in this dedicated bucket. Only the server can call this function.
create or replace function public.workshop_backup_storage_usage() returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $$
 select jsonb_build_object('bytes',coalesce(sum(coalesce((metadata->>'size')::bigint,536870912)),0),'max_bytes',536870912)
 from storage.objects where bucket_id='fastgo-backups'
$$;
revoke all on function public.workshop_backup_storage_usage() from public,anon,authenticated;
grant execute on function public.workshop_backup_storage_usage() to service_role;
