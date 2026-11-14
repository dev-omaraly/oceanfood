-- =====================================================================
--  أوشين فود — Supabase schema
--  الصق الملف ده كله في  SQL Editor  واضغط Run  (مرة واحدة)
--  الملف آمن للتشغيل أكتر من مرة
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) الفروع (فروع الشركة: حلوان ... ) — كل فرع له باسورد
-- ---------------------------------------------------------------------
create table if not exists branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
-- الباسورد متخزن مشفّر في جدول منفصل ومحدش يقدر يقراه من التطبيق
create table if not exists branch_secrets (
  branch_id     uuid primary key references branches(id) on delete cascade,
  password_hash text not null
);

-- ---------------------------------------------------------------------
-- 2) المستخدمين (مربوطين بـ Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  role       text not null check (role in ('superadmin','admin','user','rep')),
  title      text not null default '',
  branch_id  uuid references branches(id) on delete set null,   -- null = السوبر أدمن (كل الفروع)
  rep_id     uuid,
  perms      jsonb,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) بيانات عامة مشتركة بين كل الفروع
-- ---------------------------------------------------------------------
create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  category         text not null default '',
  unit             text not null default 'كرتونة',
  units_per_carton int  not null default 4,
  base_price       numeric not null default 0,      -- سعر افتراضي لو التاجر ملوش سعر محدد
  image_url        text,
  sort_no          int not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists stores (                  -- المتجر / التاجر الرئيسي (سعودي، فرجاني ...)
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists store_branches (          -- فروع المتجر
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);
create table if not exists store_prices (            -- سعر الكرتونة لكل متجر × صنف (بينطبق على كل فروع المتجر)
  store_id   uuid not null references stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  price      numeric not null default 0,
  primary key (store_id, product_id)
);
create table if not exists supervisors (             -- المشرف المتعاقد
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid references stores(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key   text primary key,
  value jsonb
);

-- ---------------------------------------------------------------------
-- 4) بيانات كل فرع
-- ---------------------------------------------------------------------
create table if not exists reps (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references branches(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);
do $$ begin
  alter table profiles add constraint profiles_rep_fk foreign key (rep_id) references reps(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists opening_stock (
  branch_id  uuid not null references branches(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty        numeric not null default 0,
  primary key (branch_id, product_id)
);

create table if not exists vouchers (                -- أذون الصرف
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references branches(id) on delete cascade,
  number           text not null,
  date             date not null default current_date,
  rep_id           uuid references reps(id) on delete set null,
  rep_name         text,
  store_id         uuid references stores(id) on delete set null,
  store_branch_id  uuid references store_branches(id) on delete set null,
  merchant_label   text,
  supervisor_name  text,                              -- المشرف المتعاقد
  items            jsonb not null default '[]',
  total            numeric not null default 0,
  created_by       uuid,
  created_by_name  text,
  legacy_id        text,
  created_at       timestamptz not null default now(),
  unique (branch_id, number)
);
create table if not exists returns (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references branches(id) on delete cascade,
  number         text not null,
  date           date not null default current_date,
  rep_name       text,
  merchant_label text,
  voucher_number text,
  items          jsonb not null default '[]',
  qty            numeric not null default 0,
  unload_id      uuid,
  created_by_name text,
  legacy_id      text,
  created_at     timestamptz not null default now(),
  unique (branch_id, number)
);
create table if not exists incoming (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references branches(id) on delete cascade,
  number       text not null,
  date         date not null default current_date,
  supplier     text,
  note         text,
  items        jsonb not null default '[]',
  total_qty    numeric not null default 0,
  created_by_name text,
  legacy_id    text,
  created_at   timestamptz not null default now(),
  unique (branch_id, number)
);
create table if not exists stocktakes (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references branches(id) on delete cascade,
  number     text not null,
  date       date not null default current_date,
  by_name    text,
  note       text,
  items      jsonb not null default '[]',
  shortage   numeric not null default 0,
  surplus    numeric not null default 0,
  legacy_id  text,
  created_at timestamptz not null default now(),
  unique (branch_id, number)
);
create table if not exists rep_deliveries (          -- تسليم المندوب للتاجر (المستلم / المرتجع)
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references branches(id) on delete cascade,
  voucher_id     uuid not null references vouchers(id) on delete cascade,
  voucher_number text,
  rep_id         uuid references reps(id) on delete set null,
  rep_name       text,
  merchant_label text,
  date           date not null default current_date,
  lines          jsonb not null default '[]',
  ret_status     text not null default 'none' check (ret_status in ('none','held','unloaded','received')),
  unload_id      uuid,
  created_by_name text,
  legacy_id      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (voucher_id)
);
create table if not exists unloads (                 -- تفريغ المندوب (بانتظار استلام أمين المخزن)
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references branches(id) on delete cascade,
  rep_id          uuid references reps(id) on delete set null,
  rep_name        text,
  items           jsonb not null default '[]',
  delivery_ids    jsonb not null default '[]',
  voucher_numbers jsonb not null default '[]',
  status          text not null default 'pending' check (status in ('pending','received')),
  received_by     text,
  received_at     timestamptz,
  return_number   text,
  legacy_id       text,
  created_at      timestamptz not null default now()
);
create table if not exists activity (
  id         bigint generated always as identity primary key,
  branch_id  uuid references branches(id) on delete cascade,
  username   text,
  action     text not null,
  details    text,
  created_at timestamptz not null default now()
);
create table if not exists counters (
  branch_id uuid not null references branches(id) on delete cascade,
  kind      text not null,
  last_no   bigint not null default 0,
  primary key (branch_id, kind)
);

create index if not exists vouchers_branch_date_idx on vouchers (branch_id, date desc);
create index if not exists returns_branch_date_idx  on returns  (branch_id, date desc);
create index if not exists incoming_branch_date_idx on incoming (branch_id, date desc);
create index if not exists activity_branch_idx      on activity (branch_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5) دوال مساعدة للصلاحيات (security definer علشان ما يحصلش recursion)
-- ---------------------------------------------------------------------
create or replace function my_role() returns text language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and active $$;

create or replace function my_branch() returns uuid language sql stable security definer set search_path = public as
$$ select branch_id from profiles where id = auth.uid() and active $$;

create or replace function my_rep() returns uuid language sql stable security definer set search_path = public as
$$ select rep_id from profiles where id = auth.uid() and active $$;

create or replace function is_super() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'superadmin' from profiles where id = auth.uid() and active), false) $$;

create or replace function can_branch(b uuid) returns boolean language sql stable security definer set search_path = public as
$$ select is_super() or (b is not null and b = my_branch()) $$;

create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(my_role() in ('superadmin','admin','user'), false) $$;

create or replace function is_admin_up() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(my_role() in ('superadmin','admin'), false) $$;

-- ---------------------------------------------------------------------
-- 6) دوال RPC
-- ---------------------------------------------------------------------
-- قائمة الفروع لشاشة الدخول (أسماء بس، بدون باسورد)
create or replace function list_branches() returns table (id uuid, name text)
language sql stable security definer set search_path = public as
$$ select id, name from branches where active order by name $$;

-- التحقق من باسورد الفرع
create or replace function check_branch_password(p_branch uuid, p_password text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare h text;
begin
  select password_hash into h from branch_secrets where branch_id = p_branch;
  if h is null then return false; end if;
  return h = crypt(p_password, h);
end $$;

-- تحديد / تغيير باسورد الفرع (سوبر أدمن فقط)
create or replace function set_branch_password(p_branch uuid, p_password text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'not allowed'; end if;
  if length(coalesce(p_password,'')) < 3 then raise exception 'password too short'; end if;
  insert into branch_secrets(branch_id, password_hash) values (p_branch, crypt(p_password, gen_salt('bf')))
  on conflict (branch_id) do update set password_hash = excluded.password_hash;
end $$;

-- ترقيم تلقائي لكل فرع (إذن 1001.. / R-1 / IN-1 / ST-1)
create or replace function next_number(p_branch uuid, p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if not can_branch(p_branch) then raise exception 'not allowed'; end if;
  insert into counters(branch_id, kind, last_no)
  values (p_branch, p_kind, case when p_kind = 'voucher' then 1001 else 1 end)
  on conflict (branch_id, kind) do update set last_no = counters.last_no + 1
  returning last_no into n;
  return case p_kind
    when 'voucher'   then n::text
    when 'return'    then 'R-'  || n
    when 'incoming'  then 'IN-' || n
    when 'stocktake' then 'ST-' || n
    else n::text end;
end $$;

-- كلمة سر الحذف
create or replace function check_delete_password(p text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare h text;
begin
  if my_role() is null then return false; end if;
  select value #>> '{}' into h from settings where key = 'delete_password';
  if h is null then return false; end if;
  return h = crypt(p, h);
end $$;

create or replace function set_delete_password(p text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'not allowed'; end if;
  if length(coalesce(p,'')) < 3 then raise exception 'password too short'; end if;
  insert into settings(key, value) values ('delete_password', to_jsonb(crypt(p, gen_salt('bf'))))
  on conflict (key) do update set value = excluded.value;
end $$;

-- موافقة الخصم العالي: باسورد أي أدمن / سوبر أدمن
create or replace function verify_admin_password(p text) returns boolean
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if my_role() is null then return false; end if;
  return exists (
    select 1 from profiles pr join auth.users u on u.id = pr.id
    where pr.role in ('admin','superadmin') and pr.active
      and u.encrypted_password = crypt(p, u.encrypted_password)
  );
end $$;

-- تغيير باسورد يوزر (سوبر أدمن فقط)
create or replace function admin_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_super() then raise exception 'not allowed'; end if;
  if length(coalesce(p_password,'')) < 6 then raise exception 'password too short (min 6)'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- حذف يوزر (سوبر أدمن فقط)
create or replace function admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_super() then raise exception 'not allowed'; end if;
  if p_user = auth.uid() then raise exception 'cannot delete yourself'; end if;
  delete from auth.users where id = p_user;
end $$;

grant execute on function list_branches()                          to anon, authenticated;
grant execute on function check_branch_password(uuid, text)        to anon, authenticated;
grant execute on function set_branch_password(uuid, text)          to authenticated;
grant execute on function next_number(uuid, text)                  to authenticated;
grant execute on function check_delete_password(text)              to authenticated;
grant execute on function set_delete_password(text)                to authenticated;
grant execute on function verify_admin_password(text)              to authenticated;
grant execute on function admin_set_password(uuid, text)           to authenticated;
grant execute on function admin_delete_user(uuid)                  to authenticated;

-- ---------------------------------------------------------------------
-- 7) الصلاحيات (RLS)
-- ---------------------------------------------------------------------
alter table branches        enable row level security;
alter table branch_secrets  enable row level security;   -- من غير policies = ممنوع تمامًا
alter table profiles        enable row level security;
alter table products        enable row level security;
alter table stores          enable row level security;
alter table store_branches  enable row level security;
alter table store_prices    enable row level security;
alter table supervisors     enable row level security;
alter table settings        enable row level security;
alter table reps            enable row level security;
alter table opening_stock   enable row level security;
alter table vouchers        enable row level security;
alter table returns         enable row level security;
alter table incoming        enable row level security;
alter table stocktakes      enable row level security;
alter table rep_deliveries  enable row level security;
alter table unloads         enable row level security;
alter table activity        enable row level security;
alter table counters        enable row level security;

-- امسح أي policies قديمة (علشان إعادة التشغيل تبقى آمنة)
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- الفروع: أي يوزر مسجّل يشوف الأسماء، السوبر أدمن بس يعدّل
create policy branches_sel on branches for select to authenticated using (true);
create policy branches_all on branches for all    to authenticated using (is_super()) with check (is_super());

-- المستخدمين
create policy profiles_sel on profiles for select to authenticated
  using (id = auth.uid() or is_super() or (my_role() = 'admin' and branch_id = my_branch()));
create policy profiles_all on profiles for all to authenticated using (is_super()) with check (is_super());

-- بيانات عامة: قراءة للكل (المسجلين) — الكتابة حسب الدور
create policy products_sel on products for select to authenticated using (true);
create policy products_wr  on products for all    to authenticated using (is_admin_up()) with check (is_admin_up());

create policy stores_sel on stores for select to authenticated using (true);
create policy stores_ins on stores for insert to authenticated with check (is_staff());
create policy stores_upd on stores for update to authenticated using (is_admin_up()) with check (is_admin_up());
create policy stores_del on stores for delete to authenticated using (is_super());

create policy sbr_sel on store_branches for select to authenticated using (true);
create policy sbr_ins on store_branches for insert to authenticated with check (is_staff());
create policy sbr_upd on store_branches for update to authenticated using (is_admin_up()) with check (is_admin_up());
create policy sbr_del on store_branches for delete to authenticated using (is_super());

-- أسعار المتاجر: السوبر أدمن بس هو اللي يحددها
create policy sprice_sel on store_prices for select to authenticated using (true);
create policy sprice_wr  on store_prices for all    to authenticated using (is_super()) with check (is_super());

create policy sup_sel on supervisors for select to authenticated using (true);
create policy sup_ins on supervisors for insert to authenticated with check (is_staff());
create policy sup_upd on supervisors for update to authenticated using (is_admin_up()) with check (is_admin_up());
create policy sup_del on supervisors for delete to authenticated using (is_admin_up());

-- الإعدادات (كلمة سر الحذف مش بتتقرا من التطبيق)
create policy settings_sel on settings for select to authenticated using (key <> 'delete_password' or is_super());
create policy settings_wr  on settings for all    to authenticated using (is_super()) with check (is_super());

-- جداول الفرع
create policy reps_sel on reps for select to authenticated using (can_branch(branch_id));
create policy reps_wr  on reps for all    to authenticated using (can_branch(branch_id) and is_admin_up()) with check (can_branch(branch_id) and is_admin_up());

create policy open_sel on opening_stock for select to authenticated using (can_branch(branch_id) and my_role() <> 'rep');
create policy open_wr  on opening_stock for all    to authenticated using (can_branch(branch_id) and is_admin_up()) with check (can_branch(branch_id) and is_admin_up());

create policy vouchers_sel on vouchers for select to authenticated
  using (can_branch(branch_id) and (my_role() <> 'rep' or rep_id = my_rep()));
create policy vouchers_ins on vouchers for insert to authenticated with check (can_branch(branch_id) and is_staff());
create policy vouchers_upd on vouchers for update to authenticated using (can_branch(branch_id) and is_admin_up()) with check (can_branch(branch_id) and is_admin_up());
create policy vouchers_del on vouchers for delete to authenticated using (can_branch(branch_id) and is_admin_up());

create policy returns_sel on returns for select to authenticated using (can_branch(branch_id) and my_role() <> 'rep');
create policy returns_ins on returns for insert to authenticated with check (can_branch(branch_id) and is_staff());
create policy returns_del on returns for delete to authenticated using (can_branch(branch_id) and is_admin_up());

create policy incoming_sel on incoming for select to authenticated using (can_branch(branch_id) and my_role() <> 'rep');
create policy incoming_ins on incoming for insert to authenticated with check (can_branch(branch_id) and is_staff());
create policy incoming_del on incoming for delete to authenticated using (can_branch(branch_id) and is_admin_up());

create policy stk_sel on stocktakes for select to authenticated using (can_branch(branch_id) and my_role() <> 'rep');
create policy stk_ins on stocktakes for insert to authenticated with check (can_branch(branch_id) and is_super());
create policy stk_del on stocktakes for delete to authenticated using (can_branch(branch_id) and is_super());

create policy rdel_sel on rep_deliveries for select to authenticated
  using (can_branch(branch_id) and (my_role() <> 'rep' or rep_id = my_rep()));
create policy rdel_ins on rep_deliveries for insert to authenticated
  with check (can_branch(branch_id) and (is_staff() or rep_id = my_rep()));
create policy rdel_upd on rep_deliveries for update to authenticated
  using (can_branch(branch_id) and (is_staff() or rep_id = my_rep()))
  with check (can_branch(branch_id) and (is_staff() or rep_id = my_rep()));
create policy rdel_del on rep_deliveries for delete to authenticated using (can_branch(branch_id) and is_admin_up());

create policy unl_sel on unloads for select to authenticated
  using (can_branch(branch_id) and (my_role() <> 'rep' or rep_id = my_rep()));
create policy unl_ins on unloads for insert to authenticated
  with check (can_branch(branch_id) and (is_staff() or rep_id = my_rep()));
create policy unl_upd on unloads for update to authenticated using (can_branch(branch_id) and is_staff()) with check (can_branch(branch_id) and is_staff());

create policy act_sel on activity for select to authenticated using (is_super());
create policy act_ins on activity for insert to authenticated with check (can_branch(branch_id) or branch_id is null);

create policy counters_none on counters for select to authenticated using (false);

-- ---------------------------------------------------------------------
-- 8) Realtime (تحديث لحظي بين الأجهزة)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['vouchers','returns','incoming','rep_deliveries','unloads','stocktakes','products','stores','store_branches','store_prices','supervisors','reps','opening_stock','branches','settings'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; when undefined_object then null; end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9) إعدادات افتراضية
-- ---------------------------------------------------------------------
insert into settings(key, value) values
  ('app_name',            to_jsonb('أوشين فود'::text)),
  ('max_discount_pct',    to_jsonb(15)),
  ('commercial_register', to_jsonb('137779'::text)),
  ('tax_card',            to_jsonb('330-524-186'::text))
on conflict (key) do nothing;
