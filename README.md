# أوشين فود — نظام المخزون والمبيعات (الإصدار 2)

تطبيق ويب + APK، قاعدة البيانات **Supabase**، التشغيل والبناء من **GitHub**.

## الخطوات (مرة واحدة)

### 1) Supabase
1. **SQL Editor** ← New query ← الصق محتوى `supabase/schema.sql` كله ← **Run**.
2. **Authentication ← Sign In / Providers ← Email**: اقفل **Confirm email** (OFF) — علشان إضافة المستخدمين من التطبيق تشتغل.
3. **Authentication ← Users ← Add user ← Create new user**
   - Email: `administrator@oceanfood.app` + باسورد قوي + ✔ **Auto Confirm User**
4. **SQL Editor** ← الصق `supabase/bootstrap.sql` ← Run (بيحوّل الحساب ده لسوبر أدمن).
5. **Project Settings ← API**: انسخ **Project URL** و **anon public key** وحطهم في `www/config.js`.
   (استخدم الـ anon فقط — مفتاح service_role سري ومايتحطش في التطبيق أو GitHub.)

### 2) GitHub
1. اعمل Repository جديد وارفع محتويات الفولدر ده كله.
2. **Settings ← Pages ← Source = GitHub Actions** (ده بينشر نسخة الويب).
3. **Actions**: بعد أول Push هيشتغل `Build APK` — الـ APK هتلاقيه في:
   - **Releases ← أحدث نسخة APK** (تحميل مباشر)، أو
   - **Actions ← آخر تشغيل ← Artifacts ← OceanFood-APK**.
   - كل تعديل تعمله على main بيطلّع APK جديد تلقائيًا.

### 3) نقل البيانات القديمة من Firebase
```bash
npm install
SUPABASE_URL="https://xxxx.supabase.co" \
SUPABASE_SERVICE_KEY="service_role_key" \
node supabase/migrate-firebase-to-supabase.mjs --branch "فرع الهرم" --dry   # تجربة بدون كتابة
node supabase/migrate-firebase-to-supabase.mjs --branch "فرع الهرم"         # النقل الفعلي
```
بينقل: الأصناف، الرصيد الافتتاحي، المناديب، المتاجر وفروعها، الأذون، المرتجعات، الوارد، الجرد، تسليمات وتفريغ المناديب، المستخدمين (بنفس الباسوردات لو 6 أحرف أو أكتر)، وبيكمّل الترقيم من آخر رقم.

### 4) أول استخدام (من التطبيق، بدخول الإدارة)
1. **المزيد ← الفروع**: حدد باسورد لكل فرع.
2. **المزيد ← إعدادات التطبيق**: كلمة سر الحذف، ومراجعة السجل التجاري والبطاقة الضريبية.
3. **المزيد ← المتاجر وأسعارها ← 💰 الأسعار**: حدد سعر الكرتونة لكل متجر.
4. **المزيد ← المستخدمين**: أنشئ يوزرات كل فرع.

## هيكل الدخول
الفرع + باسورد الفرع ← اسم المستخدم + كلمة السر. السوبر أدمن بيدخل من زر "دخول الإدارة" ويقدر يبدّل بين الفروع. كل مستخدم بيشوف بيانات فرعه بس (مفروضة من قاعدة البيانات RLS).

## 🔒 الأمان (تحديث)
- **بعد أي تعديل في `supabase/schema.sql` شغّله كله تاني في SQL Editor** (آمن للتكرار ومابيمسحش بيانات). ده بيصلّح خطأ `gen_salt does not exist` عند تغيير أي باسورد.
- باسورد الفرع / كلمة سر الحذف: 6 أحرف على الأقل. باسورد المستخدم: 8 أحرف على الأقل.
- 5 محاولات غلط على باسورد (فرع / حذف / موافقة خصم) = قفل 10 دقايق + تسجيل في سجل النشاط.
- الإذن بيتراجع من السيرفر: السعر لازم يطابق قاعدة البيانات والإجمالي بيتحسب في السيرفر.
- متغيرات حساسة (service_role / Firebase key) بتتحط في متغيرات بيئة بس — `FIREBASE_API_KEY` بقى مطلوب لسكربت النقل.
- فعّل **Enforce HTTPS** من GitHub: Settings ← Pages.
- في Supabase: Authentication ← Rate Limits راجعها، و Attack Protection (CAPTCHA) لو متاح.
