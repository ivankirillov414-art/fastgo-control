begin;
alter table public.workshop_members add column if not exists can_sell boolean not null default false;
alter table public.workshop_members add column if not exists can_edit_catalog boolean not null default false;
update public.workshop_members set can_sell=true,can_edit_catalog=true where profile_id='b91d4ef1-9eb1-43e9-a1f6-748c75904336' and name='Артем' and role='mechanic' and active;
do $permission_patch$
declare definition text;
begin
 select pg_get_functiondef('public.workshop_native_commit(uuid,text,uuid,text,bigint,jsonb,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,
 'if p_action in (''stock_receive'',''sale'',''shift_open'',''shift_close'') and not exists(select 1 from workshop_members where profile_id=p_actor and active and role in (''developer'',''owner'',''seller'')) then raise exception ''Нет доступа к кассе'' using errcode=''42501'';end if;',
 'if p_action=''stock_receive'' and not exists(select 1 from workshop_members where profile_id=p_actor and active and role in (''developer'',''owner'',''seller'')) then raise exception ''Нет доступа к приёмке товара'' using errcode=''42501'';end if;
 if p_action in (''sale'',''shift_open'',''shift_close'') and not exists(select 1 from workshop_members where profile_id=p_actor and active and (role in (''developer'',''owner'',''seller'') or can_sell)) then raise exception ''Нет доступа к кассе'' using errcode=''42501'';end if;
 if p_action=''catalog_save'' and not exists(select 1 from workshop_members where profile_id=p_actor and active and (role in (''developer'',''owner'',''admin'') or can_edit_catalog)) then raise exception ''Нет права редактировать прайс'' using errcode=''42501'';end if;');
 if position('or can_sell' in definition)=0 or position('or can_edit_catalog' in definition)=0 then raise exception 'Unexpected workshop_native_commit definition';end if;
 execute definition;
end $permission_patch$;
commit;
