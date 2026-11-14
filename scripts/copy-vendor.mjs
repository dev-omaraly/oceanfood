// بينسخ المكتبات من node_modules إلى www/vendor علشان التطبيق (والـ APK) يشتغلوا من غير CDN
import fs from "node:fs";
const map = [
  ["node_modules/@supabase/supabase-js/dist/umd/supabase.js", "www/vendor/supabase.js"],
  ["node_modules/xlsx/dist/xlsx.full.min.js", "www/vendor/xlsx.full.min.js"],
  ["node_modules/html2canvas/dist/html2canvas.min.js", "www/vendor/html2canvas.min.js"],
  ["node_modules/jspdf/dist/jspdf.umd.min.js", "www/vendor/jspdf.umd.min.js"]
];
fs.mkdirSync("www/vendor", { recursive: true });
for (const [a, b] of map) { fs.copyFileSync(a, b); console.log("✔", b); }
