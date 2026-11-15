-- =====================================================================
--  أوشين فود — Supabase schema
--  الصق الملف ده كله في  SQL Editor  واضغط Run  (مرة واحدة)
--  الملف آمن للتشغيل أكتر من مرة
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) الفروع (فروع الشركة: الهرم ... ) — كل فرع له باسورد
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

-- أعمدة الخصومات (آمن للتشغيل أكتر من مرة)
alter table store_prices add column if not exists discount_pct         numeric not null default 0 check (discount_pct >= 0 and discount_pct <= 100);
alter table stores       add column if not exists invoice_discount_pct numeric not null default 0 check (invoice_discount_pct >= 0 and invoice_discount_pct <= 100);
alter table vouchers     add column if not exists invoice_discount_pct numeric not null default 0 check (invoice_discount_pct >= 0 and invoice_discount_pct <= 100);

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

create or replace function my_username() returns text language sql stable security definer set search_path = public as
$$ select username from profiles where id = auth.uid() and active $$;

-- صلاحيات الميزات (perms) تتفحص من السيرفر كمان مش من الواجهة بس
create or replace function has_perm(k text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'superadmin' or perms is null or coalesce((perms->>k)::boolean, false)
                    from profiles where id = auth.uid() and active and role in ('superadmin','admin','user')), false) $$;

-- ---------------------------------------------------------------------
-- 6) دوال RPC
-- ---------------------------------------------------------------------
-- قائمة الفروع لشاشة الدخول (أسماء بس، بدون باسورد)
create or replace function list_branches() returns table (id uuid, name text)
language sql stable security definer set search_path = public as
$$ select id, name from branches where active order by name $$;

-- حماية من تخمين الباسوردات: 5 محاولات غلط = قفل 10 دقايق (لكل IP/يوزر) + تسجيل في السجل
create table if not exists auth_attempts (
  k            text primary key,
  fails        int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);
alter table auth_attempts enable row level security;   -- من غير policies = ممنوع من التطبيق

create or replace function _client_ip() returns text language sql stable set search_path = public as
$$ select coalesce(nullif(split_part(coalesce((nullif(current_setting('request.headers', true), ''))::json ->> 'x-forwarded-for', ''), ',', 1), ''), 'unknown') $$;

create or replace function _throttle_check(p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from auth_attempts where k = p_key and locked_until is not null and locked_until > now()) then
    raise exception 'too_many_attempts';
  end if;
end $$;

create or replace function _throttle_fail(p_key text, p_branch uuid, p_what text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into auth_attempts(k, fails, updated_at) values (p_key, 1, now())
  on conflict (k) do update set
    fails = case when auth_attempts.updated_at < now() - interval '15 minutes' then 1 else auth_attempts.fails + 1 end,
    updated_at = now()
  returning fails into n;
  if n >= 5 then update auth_attempts set locked_until = now() + interval '10 minutes' where k = p_key; end if;
  insert into activity(branch_id, username, action, details)
  values ((select id from branches where id = p_branch), coalesce(my_username(), 'anon'), p_what, 'محاولة رقم ' || n);
end $$;

create or replace function _throttle_ok(p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin delete from auth_attempts where k = p_key; end $$;

revoke execute on function _client_ip(), _throttle_check(text), _throttle_fail(text, uuid, text), _throttle_ok(text) from public, anon, authenticated;

-- التحقق من باسورد الفرع
create or replace function check_branch_password(p_branch uuid, p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text; k text;
begin
  k := 'branch:' || coalesce(p_branch::text, '') || ':' || _client_ip();
  perform _throttle_check(k);
  select password_hash into h from branch_secrets where branch_id = p_branch;
  if h is not null and h = crypt(p_password, h) then perform _throttle_ok(k); return true; end if;
  perform _throttle_fail(k, p_branch, 'باسورد فرع غلط');
  return false;
end $$;

-- تحديد / تغيير باسورد الفرع (سوبر أدمن فقط)
create or replace function set_branch_password(p_branch uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_super() then raise exception 'not allowed'; end if;
  if length(coalesce(p_password,'')) < 6 then raise exception 'password too short (min 6)'; end if;
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
language plpgsql security definer set search_path = public, extensions as $$
declare h text; k text;
begin
  if my_role() is null then return false; end if;
  k := 'del:' || auth.uid()::text;
  perform _throttle_check(k);
  select value #>> '{}' into h from settings where key = 'delete_password';
  if h is not null and h = crypt(p, h) then perform _throttle_ok(k); return true; end if;
  perform _throttle_fail(k, my_branch(), 'كلمة سر حذف غلط');
  return false;
end $$;

create or replace function set_delete_password(p text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_super() then raise exception 'not allowed'; end if;
  if length(coalesce(p,'')) < 6 then raise exception 'password too short (min 6)'; end if;
  insert into settings(key, value) values ('delete_password', to_jsonb(crypt(p, gen_salt('bf'))))
  on conflict (key) do update set value = excluded.value;
end $$;

-- موافقة الخصم العالي: باسورد أي أدمن / سوبر أدمن
create or replace function verify_admin_password(p text) returns boolean
language plpgsql security definer set search_path = public, auth, extensions as $$
declare k text; ok boolean;
begin
  if my_role() is null then return false; end if;
  k := 'adm:' || auth.uid()::text;
  perform _throttle_check(k);
  select exists (
    select 1 from profiles pr join auth.users u on u.id = pr.id
    where pr.role in ('admin','superadmin') and pr.active
      and u.encrypted_password = crypt(p, u.encrypted_password)
  ) into ok;
  if ok then perform _throttle_ok(k); return true; end if;
  perform _throttle_fail(k, my_branch(), 'باسورد أدمن غلط (موافقة خصم)');
  return false;
end $$;

-- تغيير باسورد يوزر (سوبر أدمن فقط)
create or replace function admin_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not is_super() then raise exception 'not allowed'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'password too short (min 8)'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
  delete from auth.sessions where user_id = p_user;   -- اطرد الجلسات القديمة بعد تغيير الباسورد
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

-- ما حدش غير المسجّلين يقدر ينده الدوال دي (الدخول بيحتاج list_branches و check_branch_password بس)
revoke execute on function set_branch_password(uuid, text), next_number(uuid, text), check_delete_password(text),
  set_delete_password(text), verify_admin_password(text), admin_set_password(uuid, text), admin_delete_user(uuid)
  from public, anon;

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
create policy branches_sel on branches for select to authenticated using (my_role() is not null);
create policy branches_all on branches for all    to authenticated using (is_super()) with check (is_super());

-- المستخدمين
create policy profiles_sel on profiles for select to authenticated
  using (id = auth.uid() or is_super() or (my_role() = 'admin' and branch_id = my_branch()));
create policy profiles_all on profiles for all to authenticated using (is_super()) with check (is_super());

-- بيانات عامة: قراءة للكل (المسجلين) — الكتابة حسب الدور
create policy products_sel on products for select to authenticated using (my_role() is not null);
create policy products_wr  on products for all    to authenticated using (is_admin_up()) with check (is_admin_up());

create policy stores_sel on stores for select to authenticated using (my_role() is not null);
create policy stores_ins on stores for insert to authenticated with check (is_staff());
create policy stores_upd on stores for update to authenticated using (is_admin_up()) with check (is_admin_up());
create policy stores_del on stores for delete to authenticated using (is_super());

create policy sbr_sel on store_branches for select to authenticated using (my_role() is not null);
create policy sbr_ins on store_branches for insert to authenticated with check (is_staff());
create policy sbr_upd on store_branches for update to authenticated using (is_admin_up()) with check (is_admin_up());
create policy sbr_del on store_branches for delete to authenticated using (is_super());

-- أسعار المتاجر: السوبر أدمن بس هو اللي يحددها
create policy sprice_sel on store_prices for select to authenticated using (my_role() is not null);
create policy sprice_wr  on store_prices for all    to authenticated using (is_super()) with check (is_super());

create policy sup_sel on supervisors for select to authenticated using (my_role() is not null);
create policy sup_ins on supervisors for insert to authenticated with check (is_staff());
create policy sup_upd on supervisors for update to authenticated using (is_admin_up()) with check (is_admin_up());
create policy sup_del on supervisors for delete to authenticated using (is_admin_up());

-- الإعدادات (كلمة سر الحذف مش بتتقرا من التطبيق)
create policy settings_sel on settings for select to authenticated using (my_role() is not null and (key <> 'delete_password' or is_super()));
create policy settings_wr  on settings for all    to authenticated using (is_super()) with check (is_super());

-- جداول الفرع
create policy reps_sel on reps for select to authenticated using (can_branch(branch_id));
create policy reps_wr  on reps for all    to authenticated using (can_branch(branch_id) and is_admin_up()) with check (can_branch(branch_id) and is_admin_up());

create policy open_sel on opening_stock for select to authenticated using (can_branch(branch_id) and my_role() <> 'rep');
create policy open_wr  on opening_stock for all    to authenticated using (can_branch(branch_id) and is_admin_up()) with check (can_branch(branch_id) and is_admin_up());

create policy vouchers_sel on vouchers for select to authenticated
  using (can_branch(branch_id) and (my_role() <> 'rep' or rep_id = my_rep()));
create policy vouchers_ins on vouchers for insert to authenticated with check (can_branch(branch_id) and is_staff() and has_perm('voucher'));
create policy vouchers_upd on vouchers for update to authenticated using (can_branch(branch_id) and is_admin_up()) with check (can_branch(branch_id) and is_admin_up());
create policy vouchers_del on vouchers for delete to authenticated using (can_branch(branch_id) and is_admin_up());

create policy returns_sel on returns for select to authenticated using (can_branch(branch_id) and my_role() <> 'rep');
create policy returns_ins on returns for insert to authenticated with check (can_branch(branch_id) and is_staff() and (has_perm('returns') or has_perm('receive')));
create policy returns_del on returns for delete to authenticated using (can_branch(branch_id) and is_admin_up());

create policy incoming_sel on incoming for select to authenticated using (can_branch(branch_id) and my_role() <> 'rep');
create policy incoming_ins on incoming for insert to authenticated with check (can_branch(branch_id) and is_staff() and has_perm('incoming'));
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
create policy act_ins on activity for insert to authenticated
  with check (my_role() is not null and username = my_username() and (branch_id is null or can_branch(branch_id)));

create policy counters_none on counters for select to authenticated using (false);

-- ---------------------------------------------------------------------
-- 7.5) مراجعة الأذون من السيرفر: السعر من قاعدة البيانات + الإجمالي بيتحسب هنا
--      (علشان محدش يعدّل السعر أو الإجمالي من خارج التطبيق)
-- ---------------------------------------------------------------------
create or replace function vouchers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare it jsonb; q numeric; pr numeric; d numeric; t numeric := 0; expected numeric; prod record; inv numeric;
begin
  if auth.uid() is null then return new; end if;      -- service_role (سكربت النقل) بيعدّي
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 then raise exception 'voucher has no items'; end if;
  inv := coalesce(new.invoice_discount_pct, 0);
  if inv < 0 or inv > 100 then raise exception 'invalid invoice discount'; end if;
  if tg_op = 'INSERT' and abs(inv - coalesce((select invoice_discount_pct from stores where id = new.store_id), 0)) > 0.005 then
    raise exception 'invoice discount mismatch';
  end if;
  for it in select value from jsonb_array_elements(new.items) loop
    q  := coalesce((it->>'qty')::numeric, 0);
    pr := coalesce((it->>'price')::numeric, 0);
    d  := coalesce((it->>'discountPct')::numeric, 0);
    if q <= 0 or pr < 0 or d < 0 or d > 1 then raise exception 'invalid voucher line'; end if;
    if tg_op = 'INSERT' then
      select id, base_price into prod from products where code = it->>'code';
      if not found then raise exception 'unknown product %', it->>'code'; end if;
      expected := coalesce((select price from store_prices where store_id = new.store_id and product_id = prod.id), prod.base_price);
      if abs(pr - expected) > 0.005 then raise exception 'price mismatch for %', it->>'code'; end if;
    end if;
    t := t + q * pr * (1 - d);
  end loop;
  new.total := round(t * (1 - inv / 100), 2);
  return new;
end $$;
drop trigger if exists vouchers_guard_trg on vouchers;
create trigger vouchers_guard_trg before insert or update on vouchers for each row execute function vouchers_guard();

-- خصم الفاتورة على المتجر: السوبر أدمن بس هو اللي يغيّره
create or replace function stores_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.invoice_discount_pct := 0; return new; end if;
  if new.invoice_discount_pct is distinct from old.invoice_discount_pct and not is_super() then
    raise exception 'only superadmin can change invoice discount';
  end if;
  return new;
end $$;
drop trigger if exists stores_guard_trg on stores;
create trigger stores_guard_trg before insert or update on stores for each row execute function stores_guard();

-- حد لحجم صور الأصناف (الصور الجديدة فقط)
do $$ begin
  alter table products add constraint products_image_size check (image_url is null or length(image_url) < 600000) not valid;
exception when duplicate_object then null; end $$;

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
