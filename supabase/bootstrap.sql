-- =====================================================================
--  إنشاء حساب السوبر أدمن (مرة واحدة بعد schema.sql)
--  قبل التشغيل: Authentication ← Users ← Add user ← Create new user
--     Email:    administrator@oceanfood.app
--     Password: (اختار باسورد قوي — 6 أحرف على الأقل)
--     ✔ Auto Confirm User
-- =====================================================================
insert into profiles (id, username, role, title, branch_id)
select id, 'administrator', 'superadmin', 'المدير العام', null
from auth.users where email = 'administrator@oceanfood.app'
on conflict (id) do update set role = 'superadmin', active = true;

select username, role from profiles;   -- لازم يظهر administrator / superadmin
