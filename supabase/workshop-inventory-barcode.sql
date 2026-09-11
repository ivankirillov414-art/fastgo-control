-- FastGo workshop inventory barcode + POS extension.
-- Applied to production in three additive migrations on 2026-09-11.

create sequence if not exists public.part_barcode_seq start 1;
create sequence if not exists public.inventory_category_barcode_seq start 1;
create sequence if not exists public.workshop_sale_number_seq start 1;

alter table public.parts add column if not exists barcode text;
alter table public.parts add column if not exists model text;
alter table public.parts add column if not exists unit text not null default 'шт';
alter table public.parts add column if not exists active boolean not null default true;
alter table public.parts add column if not exists primary_photo_path text;

update public.parts set barcode='FGP-'||lpad(nextval('public.part_barcode_seq')::text,8,'0')
where barcode is null or btrim(barcode)='';
alter table public.parts alter column barcode set default ('FGP-'||lpad(nextval('public.part_barcode_seq')::text,8,'0'));
alter table public.parts alter column barcode set not null;
create unique index if not exists parts_barcode_unique on public.parts(barcode);
create index if not exists parts_category_model_idx on public.parts(category,model);

create table if not exists public.inventory_categories(
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 barcode text not null unique default ('FGC-'||lpad(nextval('public.inventory_category_barcode_seq')::text,6,'0')),
 primary_photo_path text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
insert into public.inventory_categories(name)
select distinct btrim(category) from public.parts where nullif(btrim(category),'') is not null
on conflict(name) do nothing;

create table if not exists public.workshop_sales(
 id uuid primary key default gen_random_uuid(),
 sale_number bigint not null unique default nextval('public.workshop_sale_number_seq'),
 request_id uuid not null unique,
 cashier_id uuid not null references public.profiles(id),
 payment_method text not null check(payment_method in ('cash','card','transfer')),
 total numeric(12,2) not null default 0 check(total>=0),
 note text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.workshop_sale_items(
 id uuid primary key default gen_random_uuid(),
 sale_id uuid not null references public.workshop_sales(id) on delete cascade,
 part_id uuid not null references public.parts(id),
 quantity integer not null check(quantity>0),
 unit_price numeric(12,2) not null check(unit_price>=0),
 line_total numeric(12,2) generated always as (quantity*unit_price) stored,
 created_at timestamptz not null default now()
);
alter table public.stock_movements add column if not exists workshop_sale_id uuid references public.workshop_sales(id);
create index if not exists stock_movements_workshop_sale_idx on public.stock_movements(workshop_sale_id);
create index if not exists workshop_sales_created_idx on public.workshop_sales(created_at desc);
create index if not exists workshop_sale_items_sale_idx on public.workshop_sale_items(sale_id);
create index if not exists workshop_sale_items_part_idx on public.workshop_sale_items(part_id);

alter table public.inventory_categories enable row level security;
alter table public.workshop_sales enable row level security;
alter table public.workshop_sale_items enable row level security;
revoke all on public.inventory_categories,public.workshop_sales,public.workshop_sale_items from anon,authenticated;
grant all on public.inventory_categories,public.workshop_sales,public.workshop_sale_items to service_role;
grant usage,select on sequence public.part_barcode_seq,public.inventory_category_barcode_seq,public.workshop_sale_number_seq to service_role;

create or replace function public.workshop_sale(p_actor uuid,p jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare m public.workshop_members;s public.workshop_sales;item jsonb;pr public.parts;req uuid;pid uuid;qty integer;total_amount numeric(12,2):=0;sale_items jsonb:='[]'::jsonb;
begin
 select * into m from public.workshop_members where profile_id=p_actor and active;
 if not found or m.role not in ('owner','admin','receiver','manager') then raise exception 'Нет права проводить продажи' using errcode='42501';end if;
 req:=nullif(p->>'request_id','')::uuid;if req is null then raise exception 'Нет ключа операции';end if;
 perform pg_advisory_xact_lock(hashtextextended(req::text,0));
 select * into s from public.workshop_sales where request_id=req;
 if found then
  select coalesce(jsonb_agg(jsonb_build_object('part_id',i.part_id,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total) order by i.created_at),'[]'::jsonb) into sale_items from public.workshop_sale_items i where i.sale_id=s.id;
  return jsonb_build_object('id',s.id,'sale_number',s.sale_number,'total',s.total,'items',sale_items,'duplicate',true);
 end if;
 if p->>'payment_method' not in ('cash','card','transfer') then raise exception 'Выберите способ оплаты';end if;
 if jsonb_typeof(p->'items')<>'array' or jsonb_array_length(p->'items')<1 then raise exception 'Корзина пуста';end if;
 insert into public.workshop_sales(request_id,cashier_id,payment_method,note) values(req,p_actor,p->>'payment_method',left(coalesce(p->>'note',''),500)) returning * into s;
 for item in select value from jsonb_array_elements(p->'items') loop
  pid:=nullif(item->>'part_id','')::uuid;qty:=coalesce((item->>'quantity')::integer,0);
  if pid is null or qty<1 then raise exception 'Проверьте товар и количество';end if;
  select * into pr from public.parts where id=pid and active for update;
  if not found then raise exception 'Товар не найден или отключён';end if;
  if pr.quantity<qty then raise exception 'Недостаточно товара: % (остаток %)',pr.name,pr.quantity;end if;
  insert into public.workshop_sale_items(sale_id,part_id,quantity,unit_price) values(s.id,pr.id,qty,pr.retail_price);
  insert into public.stock_movements(part_id,movement_type,quantity,actor_id,note,workshop_sale_id) values(pr.id,'issue',qty,p_actor,'Продажа №'||s.sale_number,s.id);
  total_amount:=total_amount+qty*pr.retail_price;
  sale_items:=sale_items||jsonb_build_array(jsonb_build_object('part_id',pr.id,'name',pr.name,'barcode',pr.barcode,'quantity',qty,'unit_price',pr.retail_price,'line_total',qty*pr.retail_price));
 end loop;
 update public.workshop_sales set total=total_amount where id=s.id returning * into s;
 insert into public.workshop_events(kind,record_id,action,actor_id,details) values('sale',s.id,'completed',p_actor,jsonb_build_object('sale_number',s.sale_number,'total',s.total,'payment_method',s.payment_method));
 return jsonb_build_object('id',s.id,'sale_number',s.sale_number,'total',s.total,'items',sale_items,'duplicate',false);
end;$$;
revoke all on function public.workshop_sale(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.workshop_sale(uuid,jsonb) to service_role;
