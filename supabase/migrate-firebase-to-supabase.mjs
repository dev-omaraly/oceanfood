#!/usr/bin/env node
/* =====================================================================
   نقل بيانات أوشين فود من Firebase (Firestore) إلى Supabase
   -------------------------------------------------------------------
   التشغيل (من فولدر المشروع):
     npm install
     SUPABASE_URL="https://xxxx.supabase.co" \
     SUPABASE_SERVICE_KEY="eyJ... (service_role)" \
     node supabase/migrate-firebase-to-supabase.mjs --branch "فرع حلوان"

   اختياري:  --dry   (يعدّ ويعرض بدون ما يكتب أي حاجة)
   مهم: مفتاح service_role سري — استخدمه على جهازك بس ومتحطوش في GitHub أو التطبيق.
   كل البيانات القديمة بتتنقل لفرع واحد (اللي تحدده في --branch).
===================================================================== */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const arg = n => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes("--dry");
const BRANCH = arg("--branch");
const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || "oceanfood-inventory-baf80";
const FB_KEY = process.env.FIREBASE_API_KEY || "AIzaSyBa9ZZAiju7y-O5FIyLkJi8pxBA1OuzStE";
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
if (!BRANCH || !URL_ || !KEY) { console.error('لازم: --branch "اسم الفرع" + متغيرات SUPABASE_URL و SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/* ---------- قراءة Firestore عبر REST ---------- */
function dec(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  return null;
}
async function fsAll(col) {
  const out = []; let token = "";
  do {
    const u = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/${col}?pageSize=300&key=${FB_KEY}${token ? "&pageToken=" + encodeURIComponent(token) : ""}`;
    const r = await fetch(u); if (!r.ok) throw new Error(`Firestore ${col}: ${r.status} ${await r.text()}`);
    const j = await r.json();
    (j.documents || []).forEach(d => out.push({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)])) }));
    token = j.nextPageToken || "";
  } while (token);
  return out;
}
async function insertAll(table, rows, opts = {}) {
  if (DRY || !rows.length) return;
  for (let i = 0; i < rows.length; i += 400) {
    const q = opts.upsert ? sb.from(table).upsert(rows.slice(i, i + 400), { onConflict: opts.upsert }) : sb.from(table).insert(rows.slice(i, i + 400));
    const { error } = await q; if (error) throw new Error(`${table}: ${error.message}`);
  }
}
const iso = ms => ms ? new Date(Number(ms)).toISOString() : new Date().toISOString();
const emailOf = u => { u = String(u || "").trim().toLowerCase(); if (/^[a-z0-9._-]+$/.test(u)) return u + "@oceanfood.app"; return "u" + Buffer.from(u, "utf8").toString("hex") + "@oceanfood.app"; };

console.log(DRY ? "== وضع التجربة (بدون كتابة) ==" : "== بدء النقل ==");
const [products, reps, merchants, vouchers, returns, incoming, stocktakes, deliveries, unloads, users, settings, activity] =
  await Promise.all(["products", "reps", "merchants", "vouchers", "returns", "incoming", "stocktakes", "repDeliveries", "unloads", "users", "settings", "activity"].map(fsAll));
console.log({ products: products.length, reps: reps.length, merchants: merchants.length, vouchers: vouchers.length, returns: returns.length, incoming: incoming.length, stocktakes: stocktakes.length, deliveries: deliveries.length, unloads: unloads.length, users: users.length, activity: activity.length });
if (DRY) process.exit(0);

/* ---------- الفرع ---------- */
let { data: br } = await sb.from("branches").select("*").eq("name", BRANCH).maybeSingle();
if (!br) { const r = await sb.from("branches").insert({ name: BRANCH }).select().single(); if (r.error) throw r.error; br = r.data; }
const B = br.id; console.log("الفرع:", BRANCH, B);

/* ---------- الأصناف + الرصيد الافتتاحي ---------- */
const prodRows = products.map((p, i) => ({ code: p.code || p.id, name: p.name, category: p.category || "", unit: p.unit || "كرتونة", units_per_carton: Number(p.unitsPerCarton) || (String(p.category || "").trim() === "سادة" ? 8 : 4), base_price: Number(p.price) || 0, image_url: p.imageUrl || null, sort_no: i + 1 }));
await insertAll("products", prodRows, { upsert: "code" });
const { data: dbProducts } = await sb.from("products").select("id,code,category"); const pid = {}, pcat = {}; dbProducts.forEach(p => { pid[p.code] = p.id; pcat[p.code] = p.category; });
await insertAll("opening_stock", products.filter(p => pid[p.code || p.id]).map(p => ({ branch_id: B, product_id: pid[p.code || p.id], qty: Number(p.opening) || 0 })), { upsert: "branch_id,product_id" });

/* ---------- المناديب / المتاجر ---------- */
await insertAll("reps", reps.map(r => ({ branch_id: B, name: r.name })), { upsert: "branch_id,name" });
const { data: dbReps } = await sb.from("reps").select("id,name").eq("branch_id", B); const repId = Object.fromEntries(dbReps.map(r => [r.name, r.id]));
const storeNames = [...new Set(merchants.map(m => m.name).filter(Boolean))];
await insertAll("stores", storeNames.map(name => ({ name })), { upsert: "name" });
const { data: dbStores } = await sb.from("stores").select("id,name"); const storeId = Object.fromEntries(dbStores.map(s => [s.name, s.id]));
await insertAll("store_branches", merchants.filter(m => m.branch).map(m => ({ store_id: storeId[m.name], name: m.branch })), { upsert: "store_id,name" });
const { data: dbSbr } = await sb.from("store_branches").select("id,store_id,name");
const labelMap = {}; merchants.forEach(m => { const s = storeId[m.name]; const b = dbSbr.find(x => x.store_id === s && x.name === (m.branch || "")); labelMap[m.branch ? `${m.name} - ${m.branch}` : m.name] = { store_id: s, store_branch_id: b?.id || null }; });

/* ---------- الحركات ---------- */
const addCat = items => (items || []).map(i => ({ ...i, category: i.category || pcat[i.code] || "" }));
const vId = {}; // firestore id -> uuid
const seen = new Set();
const vRows = [];
for (const v of vouchers) {
  const key = String(v.number); if (seen.has(key)) { console.warn("إذن مكرر اتخطى:", key); continue; } seen.add(key);
  const id = randomUUID(); vId[v.id] = id; const m = labelMap[v.merchant] || {};
  vRows.push({ id, branch_id: B, number: key, date: v.date, rep_id: repId[v.rep] || null, rep_name: v.rep, store_id: m.store_id || null, store_branch_id: m.store_branch_id || null, merchant_label: v.merchant, supervisor_name: null, items: addCat(v.items), total: Number(v.total) || 0, created_by_name: null, legacy_id: v.id, created_at: iso(v.createdAt) });
}
await insertAll("vouchers", vRows);
const uniq = (rows, f) => { const s = new Set(); return rows.filter(r => { const k = String(f(r)); if (s.has(k)) return false; s.add(k); return true; }); };
const retId = {};
const rRows = uniq(returns, r => r.number).map(r => { const id = randomUUID(); retId[r.id] = id; return { id, branch_id: B, number: String(r.number), date: r.date, rep_name: r.rep || null, merchant_label: r.merchant || null, voucher_number: r.voucherNumber ? String(r.voucherNumber) : null, items: addCat(r.items), qty: Number(r.qty) || 0, legacy_id: r.id, created_at: iso(r.createdAt) }; });
await insertAll("returns", rRows);
await insertAll("incoming", uniq(incoming, r => r.number).map(r => ({ branch_id: B, number: String(r.number), date: r.date, supplier: r.supplier || null, note: r.note || null, items: addCat(r.items), total_qty: Number(r.totalQty) || 0, legacy_id: r.id, created_at: iso(r.createdAt) })));
await insertAll("stocktakes", uniq(stocktakes, r => r.number).map(r => ({ branch_id: B, number: String(r.number), date: r.date, by_name: r.by || null, note: r.note || null, items: r.items || [], shortage: Number(r.shortage) || 0, surplus: Number(r.surplus) || 0, legacy_id: r.id, created_at: iso(r.createdAt) })));

const dId = {}; const dRows = [];
for (const d of deliveries) { const vid = vId[d.voucherId]; if (!vid) continue; const id = randomUUID(); dId[d.id] = id;
  dRows.push({ id, branch_id: B, voucher_id: vid, voucher_number: d.voucherNumber ? String(d.voucherNumber) : null, rep_id: repId[d.rep] || null, rep_name: d.rep, merchant_label: d.merchant, date: d.date, lines: d.lines || [], ret_status: d.retStatus || "none", created_by_name: d.username || null, legacy_id: d.id, created_at: iso(d.createdAt), updated_at: iso(d.updatedAt || d.createdAt) }); }
const uId = {}; const uRows = unloads.map(u => { const id = randomUUID(); uId[u.id] = id; return { id, branch_id: B, rep_id: repId[u.rep] || null, rep_name: u.rep, items: u.items || [], delivery_ids: (u.deliveryIds || []).map(x => dId[x]).filter(Boolean), voucher_numbers: u.voucherNumbers || [], status: u.status === "received" ? "received" : "pending", received_by: u.receivedBy || null, received_at: u.receivedAt ? iso(u.receivedAt) : null, return_number: u.returnNumber || null, legacy_id: u.id, created_at: iso(u.createdAt) }; });
dRows.forEach(d => { const old = deliveries.find(x => x.id && dId[x.id] === d.id); if (old?.unloadId && uId[old.unloadId]) d.unload_id = uId[old.unloadId]; });
await insertAll("unloads", uRows); await insertAll("rep_deliveries", dRows);
await insertAll("activity", activity.slice(-500).map(a => ({ branch_id: B, username: a.username || null, action: a.action || "", details: a.details || "", created_at: iso(a.createdAt) })));

/* ---------- العدادات (علشان الترقيم يكمّل) ---------- */
const maxNum = (rows, strip) => rows.reduce((m, r) => { const n = parseInt(String(r.number).replace(strip, ""), 10); return isNaN(n) ? m : Math.max(m, n); }, 0);
await insertAll("counters", [
  { branch_id: B, kind: "voucher", last_no: Math.max(1001, maxNum(vouchers, /\D/g)) }, { branch_id: B, kind: "return", last_no: maxNum(returns, "R-") },
  { branch_id: B, kind: "incoming", last_no: maxNum(incoming, "IN-") }, { branch_id: B, kind: "stocktake", last_no: maxNum(stocktakes, "ST-") }
], { upsert: "branch_id,kind" });

/* ---------- الإعدادات ---------- */
const cfg = settings.find(s => s.id === "config") || {};
const sRows = []; if (cfg.appName) sRows.push({ key: "app_name", value: cfg.appName }); if (cfg.logoUrl) sRows.push({ key: "logo_url", value: cfg.logoUrl });
if (typeof cfg.maxDiscountPct === "number") sRows.push({ key: "max_discount_pct", value: cfg.maxDiscountPct });
await insertAll("settings", sRows, { upsert: "key" });

/* ---------- المستخدمين ---------- */
const report = [];
const { data: listed } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 }); const existing = Object.fromEntries((listed?.users || []).map(u => [u.email, u.id]));
for (const u of users) {
  const username = u.username || u.id; const email = emailOf(username); let pw = String(u.password || ""); let note = "";
  if (pw.length < 6) { pw = "Of@" + Math.random().toString(36).slice(2, 8); note = "باسورد قديم قصير — اتولد باسورد جديد"; }
  let uid = existing[email];
  if (!uid) { const { data, error } = await sb.auth.admin.createUser({ email, password: pw, email_confirm: true }); if (error) { report.push([username, "فشل: " + error.message]); continue; } uid = data.user.id; }
  const isSup = u.role === "superadmin" || username === "administrator";
  const { error } = await sb.from("profiles").upsert({ id: uid, username, role: isSup ? "superadmin" : (["admin", "user", "rep"].includes(u.role) ? u.role : "user"), title: u.title || "", branch_id: isSup ? null : B, rep_id: u.role === "rep" ? (repId[u.repName] || null) : null, perms: u.perms || null, active: true });
  report.push([username, error ? "فشل البروفايل: " + error.message : "تم" + (note ? " — " + note + ": " + pw : "")]);
}
console.table(report);
console.log("\nخلصنا ✅  — افتح التطبيق ← المزيد ← الفروع ← 🔑 علشان تحدد باسورد الفرع، وبعدها حدد كلمة سر الحذف من الإعدادات، وأسعار المتاجر من (المتاجر وأسعارها).");
