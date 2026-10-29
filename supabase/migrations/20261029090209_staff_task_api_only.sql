-- Task rows and opaque device credentials are server-owned. All user access goes
-- through the API, which checks active membership and the current assignee.
revoke all on public.workshop_staff_tasks from anon,authenticated;
drop policy workshop_staff_task_read on public.workshop_staff_tasks;
create policy workshop_staff_tasks_no_client_access on public.workshop_staff_tasks for all to anon,authenticated using(false) with check(false);
create policy workshop_task_devices_no_client_access on public.workshop_task_devices for all to anon,authenticated using(false) with check(false);
create index if not exists workshop_staff_tasks_creator on public.workshop_staff_tasks(created_by);
