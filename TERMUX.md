# من Termux: فك الضغط ← GitHub ← استلام APK

## 1) تجهيز Termux (مرة واحدة)
```bash
pkg update -y && pkg upgrade -y
pkg install -y git unzip gh
termux-setup-storage          # وافق على الصلاحية
```

## 2) فك الضغط
```bash
cd ~/storage/downloads
unzip -o OceanFood-v2.1.zip -d ~/OceanFood
cd ~/OceanFood
ls                            # لازم تشوف www و supabase و package.json
```

## 3) تسجيل الدخول في GitHub (مرة واحدة)
```bash
git config --global user.name "Omar Aly"
git config --global user.email "ايميلك@example.com"
gh auth login                 # GitHub.com ← HTTPS ← Login with a web browser
```

## 4أ) أول مرة: إنشاء Repository ورفع
```bash
git init -b main
git add .
git commit -m "OceanFood v2.1"
gh repo create oceanfood --private --source=. --remote=origin --push
```

## 4ب) لو الـ Repository موجود عندك بالفعل
```bash
cd ~ && rm -rf OceanFood-repo
gh repo clone USERNAME/oceanfood OceanFood-repo
cp -r ~/OceanFood/. ~/OceanFood-repo/ && cd ~/OceanFood-repo
git add -A && git commit -m "OceanFood v2.1" && git push
```

## 5) متابعة بناء الـ APK على GitHub
```bash
gh run list --limit 3
gh run watch                  # اختار Build APK وانتظر ✓ (حوالي 5-8 دقايق)
```

## 6) استلام الـ APK وتثبيته
```bash
gh release download apk-latest -p OceanFood.apk -D ~/storage/downloads --clobber
termux-open ~/storage/downloads/OceanFood.apk
```
(لو طلب صلاحية "تثبيت من مصادر غير معروفة" فعّلها لـ Termux)

## 7) أي تعديل بعد كده
```bash
cd ~/OceanFood        # أو ~/OceanFood-repo
git add -A && git commit -m "update" && git push
gh run watch
gh release download apk-latest -p OceanFood.apk -D ~/storage/downloads --clobber
```

## قبل ما تفتح التطبيق الجديد (مهم)
Supabase ← SQL Editor ← الصق `supabase/schema.sql` كله ← Run (آمن للتكرار).
