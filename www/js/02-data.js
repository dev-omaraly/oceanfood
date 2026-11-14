/* =====================================================================
   02-data.js — الاتصال بـ Supabase، الدخول، تحميل البيانات، الحسابات
===================================================================== */
let sb = null;

const S = {
  session: null, me: null,
  branches: [], branchId: "",
  products: [], stores: [], storeBranches: [], priceRows: [], prices: {}, supervisors: [], settings: {},
  reps: [], openingRows: [], vouchers: [], returns: [], incoming: [], stocktakes: [], deliveries: [], unloads: [],
  users: [], activity: [],
  tab: "home", sub: {}, ver: 0, wiz: null, dirty: false
};

const ROLE_LABEL = { superadmin: "السوبر أدمن", admin: "أدمن", user: "مستخدم", rep: "مندوب" };
const PERMS = [
  { key: "voucher", label: "🧾 إذن صرف جديد" },
  { key: "returns", label: "↩️ تسجيل مرتجع" },
  { key: "incoming", label: "📥 الوارد" },
  { key: "inventory", label: "📦 المخزون والأصناف" },
  { key: "history", label: "🗂️ السجل (أذون / مرتجعات / وارد)" },
  { key: "reports", label: "📊 التقارير" },
  { key: "stocktake", label: "📋 الجرد (عرض وطباعة)" },
  { key: "receive", label: "📮 استلام مرتجعات المناديب" },
  { key: "export", label: "📤 تصدير Excel" }
];

/* ---------- إعداد الاتصال ---------- */
function getConn() {
  const c = window.OF_CONFIG || {};
  const url = (c.SUPABASE_URL || localStorage.getItem("of_url") || "").trim();
  const key = (c.SUPABASE_ANON_KEY || localStorage.getItem("of_key") || "").trim();
  if (!url || !key || /PASTE|YOUR_/i.test(url + key)) return null;
  return { url, key };
}
function initClient() {
  const c = getConn(); if (!c) return false;
  sb = supabase.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage } });
  return true;
}

/* ---------- المستخدم والصلاحيات ---------- */
const emailOf = u => {
  u = String(u || "").trim().toLowerCase();
  if (/^[a-z0-9._-]+$/.test(u)) return u + "@oceanfood.app";
  const hex = Array.from(new TextEncoder().encode(u)).map(b => b.toString(16).padStart(2, "0")).join("");
  return "u" + hex + "@oceanfood.app";
};
const isSuper = () => S.me?.role === "superadmin";
const isAdmin = () => S.me?.role === "admin" || S.me?.role === "superadmin";
const isRep = () => S.me?.role === "rep";
function can(key) {
  const u = S.me; if (!u) return false;
  if (u.role === "rep") return false;
  if (u.role === "superadmin") return true;
  if (!u.perms) return true;
  return !!u.perms[key];
}
const titleOf = u => (u?.title && u.title.trim()) || ROLE_LABEL[u?.role] || "مستخدم";
const curBranch = () => S.branches.find(b => b.id === S.branchId) || null;
const branchName = id => S.branches.find(b => b.id === id)?.name || "";
const setting = (k, d = "") => (S.settings[k] === undefined || S.settings[k] === null) ? d : S.settings[k];
const appName = () => setting("app_name", "أوشين فود");
const logoUrl = () => setting("logo_url", "") || "logo.png";

/* ---------- RPC / تحميل ---------- */
async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args || {});
  if (error) throw error;
  return data;
}
async function fetchAll(table, build, order = "created_at") {
  const out = []; const step = 1000; let from = 0;
  for (; ;) {
    let q = sb.from(table).select("*");
    if (build) q = build(q);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q.range(from, from + step - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return out;
}
const byBranch = q => S.branchId ? q.eq("branch_id", S.branchId) : q;

const GLOBAL_TABLES = {
  products: () => fetchAll("products", null, "sort_no").then(r => { S.products = r.sort((a, b) => (a.sort_no - b.sort_no) || a.code.localeCompare(b.code)); }),
  stores: () => fetchAll("stores", null, "name").then(r => { S.stores = r.sort((a, b) => a.name.localeCompare(b.name, "ar")); }),
  store_branches: () => fetchAll("store_branches", null, "name").then(r => { S.storeBranches = r; }),
  store_prices: () => fetchAll("store_prices", null, null).then(r => { S.priceRows = r; S.prices = {}; r.forEach(x => { (S.prices[x.store_id] = S.prices[x.store_id] || {})[x.product_id] = Number(x.price); }); }),
  supervisors: () => fetchAll("supervisors", null, "name").then(r => { S.supervisors = r; }),
  settings: () => fetchAll("settings", null, "key").then(r => { S.settings = {}; r.forEach(x => { S.settings[x.key] = x.value; }); }),
  branches: () => fetchAll("branches", null, "name").then(r => { S.branches = r.filter(b => b.active); })
};
const BRANCH_TABLES = {
  reps: () => fetchAll("reps", byBranch, "name").then(r => { S.reps = r.sort((a, b) => a.name.localeCompare(b.name, "ar")); }),
  opening_stock: () => fetchAll("opening_stock", byBranch, null).then(r => { S.openingRows = r; }),
  vouchers: () => fetchAll("vouchers", byBranch).then(r => { S.vouchers = r; }),
  returns: () => fetchAll("returns", byBranch).then(r => { S.returns = r; }),
  incoming: () => fetchAll("incoming", byBranch).then(r => { S.incoming = r; }),
  stocktakes: () => fetchAll("stocktakes", byBranch).then(r => { S.stocktakes = r; }),
  rep_deliveries: () => fetchAll("rep_deliveries", byBranch, "updated_at").then(r => { S.deliveries = r; }),
  unloads: () => fetchAll("unloads", byBranch).then(r => { S.unloads = r; })
};

async function loadGlobal() { await Promise.all(Object.values(GLOBAL_TABLES).map(f => f())); }
async function loadBranchData() {
  S.reps = []; S.openingRows = []; S.vouchers = []; S.returns = []; S.incoming = []; S.stocktakes = []; S.deliveries = []; S.unloads = [];
  if (!isSuper() && !S.branchId) return;
  await Promise.all(Object.values(BRANCH_TABLES).map(f => f()));
  S.ver++;
}
async function reloadTable(t) {
  try {
    if (GLOBAL_TABLES[t]) await GLOBAL_TABLES[t]();
    else if (BRANCH_TABLES[t]) await BRANCH_TABLES[t]();
    else return;
    S.ver++; softRender();
  } catch (e) { console.error("reload", t, e); }
}
const _rq = new Set(); let _rt = null;
function queueReload(t) {
  _rq.add(t); clearTimeout(_rt);
  _rt = setTimeout(() => { const l = Array.from(_rq); _rq.clear(); l.forEach(reloadTable); }, 350);
}
let _chan = null;
function startRealtime() {
  try {
    if (_chan) sb.removeChannel(_chan);
    _chan = sb.channel("of-live").on("postgres_changes", { event: "*", schema: "public" }, p => queueReload(p.table)).subscribe();
  } catch (e) { console.warn("realtime", e); }
}
function softRender() {
  if (S.wiz || $("#ovl")) { S.dirty = true; return; }
  S.dirty = false; render();
}

/* ---------- الدخول ---------- */
async function fetchProfile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (error || !data || !data.active) return null;
  S.session = session; S.me = data; return data;
}
async function signIn(username, password, branchId) {
  const { error } = await sb.auth.signInWithPassword({ email: emailOf(username), password });
  if (error) throw new Error(/Invalid login/i.test(error.message) ? "اسم المستخدم أو كلمة السر غير صحيحة" : error.message);
  const me = await fetchProfile();
  if (!me) { await sb.auth.signOut(); throw new Error("الحساب غير مفعّل أو غير مكتمل. كلّم الإدارة."); }
  if (me.role !== "superadmin" && branchId && me.branch_id !== branchId) {
    await sb.auth.signOut(); S.me = null; throw new Error("المستخدم ده مش تابع للفرع اللي اخترته");
  }
  await afterAuth(branchId);
}
async function afterAuth(pickedBranch) {
  await GLOBAL_TABLES.branches();
  if (isSuper()) {
    const saved = pickedBranch || localStorage.getItem("of_branch") || "";
    S.branchId = S.branches.some(b => b.id === saved) ? saved : (S.branches[0]?.id || "");
  } else S.branchId = S.me.branch_id || "";
  localStorage.setItem("of_branch", S.branchId);
  await loadGlobal();
  await loadBranchData();
  S.tab = "home"; S.sub = {}; S.wiz = null;
  startRealtime();
  logActivity("تسجيل دخول");
}
async function signOut() {
  logActivity("تسجيل خروج");
  try { if (_chan) sb.removeChannel(_chan); } catch (e) { }
  await sb.auth.signOut();
  S.me = null; S.session = null; S.wiz = null; render();
}
async function switchBranch(id) {
  S.branchId = id; localStorage.setItem("of_branch", id);
  await loadBranchData(); S.sub = {}; render();
}

/* ---------- الحسابات ---------- */
let _sm = null, _smv = -1;
function stockMap() {
  if (_sm && _smv === S.ver) return _sm;
  const m = {}; const codeById = {}; S.products.forEach(p => { codeById[p.id] = p.code; });
  S.openingRows.forEach(o => { const c = codeById[o.product_id]; if (c) m[c] = (m[c] || 0) + Number(o.qty); });
  S.vouchers.forEach(v => (v.items || []).forEach(i => { m[i.code] = (m[i.code] || 0) - num(i.qty); }));
  S.returns.forEach(r => (r.items || []).forEach(i => { m[i.code] = (m[i.code] || 0) + num(i.qty); }));
  S.incoming.forEach(r => (r.items || []).forEach(i => { m[i.code] = (m[i.code] || 0) + num(i.qty); }));
  _sm = m; _smv = S.ver; return m;
}
const stockOf = p => round2(stockMap()[p.code] || 0);
const LOW_STOCK = 5;
const productByCode = c => S.products.find(p => p.code === c);
const upcOf = p => Number(p?.units_per_carton) || 4;

function priceFor(storeId, p) {
  const sp = S.prices[storeId];
  if (sp && sp[p.id] !== undefined && sp[p.id] !== null) return { price: Number(sp[p.id]), custom: true };
  return { price: num(p.base_price), custom: false };
}
const lineTotal = it => num(it.qty) * num(it.price) * (1 - num(it.discountPct));
const itemsTotal = items => round2(items.reduce((s, it) => s + lineTotal(it), 0));
const qtyLabel = it => `${fmt(it.qty)} ${it.unit || ""}${it.packQty ? ` (${fmt(it.packQty)} علبة)` : ""}`;

function categories() {
  const seen = []; S.products.forEach(p => { const c = p.category || "بدون تصنيف"; if (!seen.includes(c)) seen.push(c); });
  return seen;
}
function groupByCategory(list) {
  const g = {}; list.forEach(p => { const c = p.category || "بدون تصنيف"; (g[c] = g[c] || []).push(p); });
  return g;
}

/* ---------- سجل النشاط + كلمات السر ---------- */
function logActivity(action, details) {
  if (!sb || !S.me) return;
  sb.from("activity").insert({ branch_id: S.branchId || null, username: S.me.username, action, details: details || "" }).then(() => { }, () => { });
}
async function nextNumber(kind) {
  if (!S.branchId) throw new Error("اختار فرع الأول");
  return await rpc("next_number", { p_branch: S.branchId, p_kind: kind });
}
async function askDeletePassword(msg) {
  const pw = await askText("كلمة سر الحذف", { label: "اكتب كلمة سر الحذف للمتابعة", type: "password", note: msg || "", okText: "متابعة" });
  if (pw === null) return false;
  try { const ok = await rpc("check_delete_password", { p: pw }); if (!ok) toast("كلمة سر الحذف غير صحيحة"); return !!ok; }
  catch (e) { toast("تعذر التحقق"); return false; }
}
const maxDiscount = () => Number(setting("max_discount_pct", 15));
async function approveHighDiscount(pct) {
  const lim = maxDiscount(); if (pct <= lim) return true;
  const pw = await askText("موافقة على خصم مرتفع", { label: "كلمة سر أدمن", type: "password", note: `الخصم ${pct}% أعلى من الحد المسموح (${lim}%). اكتب كلمة سر أدمن للموافقة.`, okText: "موافقة" });
  if (pw === null) return false;
  try { const ok = await rpc("verify_admin_password", { p: pw }); if (!ok) { toast("كلمة السر غير صحيحة"); return false; } logActivity("موافقة على خصم مرتفع", pct + "%"); return true; }
  catch (e) { toast("تعذر التحقق"); return false; }
}
