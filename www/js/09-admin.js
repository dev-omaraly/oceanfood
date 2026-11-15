/* =====================================================================
   09-admin.js — المزيد: الفروع، المتاجر والأسعار، المشرفين، المناديب، المستخدمين، الإعدادات
===================================================================== */
const MORE = () => (S.sub.more = S.sub.more || { page: "" });
const backBar = t => `<div class="between mb"><div class="pagetitle" style="margin:0">${t}</div><button class="btn ghost sm" data-act="moreBack">‹ رجوع</button></div>`;
ACT.moreBack = () => { MORE().page = ""; render(); window.scrollTo(0, 0); };
ACT.morePage = async d => {
  MORE().page = d.p;
  if (d.p === "users") await loadUsers();
  if (d.p === "activity") await loadActivity();
  render(); window.scrollTo(0, 0);
};
ACT.closeSheet = () => closeSheet();
ACT.logout = async () => { if (await confirmBox("تسجيل الخروج؟", "خروج")) signOut(); };

VIEWS.more = function () {
  const m = MORE();
  if (isRep()) return `<div class="card"><div class="between"><div><b>👤 ${esc(S.me.username)}</b><div class="muted">${esc(titleOf(S.me))} · ${esc(branchName(S.me.branch_id))}</div></div><button class="btn danger sm" data-act="logout">🚪 خروج</button></div></div>`;
  if (m.page && MOREPAGES[m.page]) return MOREPAGES[m.page]();
  const tile = (p, ic, t, s) => `<div class="item" data-act="morePage" data-p="${p}"><div class="t"><span>${ic} ${t}</span><span class="tiny">‹</span></div><div class="m">${s}</div></div>`;
  return `<div class="card"><div class="between"><div><b>👤 ${esc(S.me.username)}</b> <span class="badge b-info">${esc(titleOf(S.me))}</span><div class="muted">${esc(isSuper() ? (curBranch()?.name || "كل الفروع") : branchName(S.me.branch_id))}</div></div><button class="btn danger sm" data-act="logout">🚪 خروج</button></div></div>
    ${isSuper() ? tile("branches", "🏢", "الفروع وباسوردات الفروع", `${S.branches.length} فرع`) : ""}
    ${isAdmin() ? tile("stores", "🏪", "المتاجر وأسعارها", `${S.stores.length} متجر${isSuper() ? " · الأسعار بتتحدد من هنا" : ""}`) : ""}
    ${isAdmin() ? tile("sups", "👷", "المشرفين المتعاقدين", `${S.supervisors.length} مشرف`) : ""}
    ${isAdmin() ? tile("reps", "👤", "المناديب", `${S.reps.length} مندوب في الفرع`) : ""}
    ${isSuper() ? tile("users", "👥", "المستخدمين والصلاحيات", "إضافة وتعديل وربط بالفروع") : ""}
    ${isAdmin() ? tile("settings", "⚙️", "إعدادات التطبيق", "الاسم، الشعار، بيانات الطباعة، حد الخصم") : ""}
    ${isSuper() ? tile("activity", "🧾", "سجل النشاط", "آخر العمليات") : ""}
    <div class="card muted center mt2">تم تطويل البرنامج بواسطة المطور : Omar Aly</div>`;
};
const MOREPAGES = {};

async function saveSetting(key, value) {
  const { error } = await sb.from("settings").upsert({ key, value });
  if (error) { toast(error.message); return false; }
  S.settings[key] = value; S.ver++; return true;
}

/* ============================ الفروع ============================ */
MOREPAGES.branches = () => backBar("🏢 الفروع") + `
  <button class="btn block mb" data-act="addBranch">➕ فرع جديد</button>
  ${S.branches.map(b => `<div class="item"><div class="t"><span>${esc(b.name)}</span>${b.id === S.branchId ? `<span class="badge b-ok">الفرع الحالي</span>` : ""}</div>
    <div class="m">المستخدمين: ${S.users.filter(u => u.branch_id === b.id).length || "—"}</div>
    <div class="row wrap mt"><button class="btn ghost sm" data-act="doPickBranch" data-id="${b.id}">فتح الفرع</button><button class="btn ghost sm" data-act="branchPw" data-id="${b.id}">🔑 تغيير الباسورد</button>
      <button class="btn ghost sm" data-act="branchRename" data-id="${b.id}">✏️ الاسم</button><button class="btn danger sm" data-act="branchOff" data-id="${b.id}">إيقاف</button></div></div>`).join("") || `<div class="empty">لا توجد فروع بعد</div>`}
  <div class="tiny mt">باسورد الفرع بيتطلب في شاشة الدخول قبل اسم المستخدم. كل مستخدم بيتبع فرع واحد وبيشوف بيانات فرعه بس.</div>`;
ACT.addBranch = () => openSheet(`<h2>فرع جديد</h2>
  <div class="field"><label>اسم الفرع</label><input type="text" id="bName" placeholder="مثال: فرع الهرم"></div>
  <div class="field"><label>باسورد الفرع</label><input type="text" id="bPw" placeholder="6 حروف على الأقل"></div>
  <div class="row"><button class="btn ghost grow" data-act="closeSheet">إلغاء</button><button class="btn grow" id="bSave">إنشاء</button></div>`,
  s => $("#bSave", s).onclick = async () => {
    const name = $("#bName", s).value.trim(), pw = $("#bPw", s).value.trim();
    if (!name || pw.length < 6) { toast("اكتب الاسم وباسورد (6 حروف على الأقل)"); return; }
    const { data, error } = await sb.from("branches").insert({ name }).select().single();
    if (error) { toast(error.code === "23505" ? "اسم الفرع موجود" : error.message); return; }
    try { await rpc("set_branch_password", { p_branch: data.id, p_password: pw }); } catch (e) { toast("الفرع اتعمل لكن الباسورد فشل: " + e.message); }
    await GLOBAL_TABLES.branches(); closeSheet(); logActivity("إنشاء فرع", name); toast("تم إنشاء الفرع");
    if (!S.branchId) await switchBranch(data.id); else render();
  });
ACT.branchPw = async d => {
  const pw = await askText("باسورد الفرع", { label: "الباسورد الجديد", note: branchName(d.id) }); if (pw === null) return;
  if (pw.trim().length < 6) { toast("الباسورد قصير (6 حروف على الأقل)"); return; }
  try { await rpc("set_branch_password", { p_branch: d.id, p_password: pw.trim() }); toast("تم تغيير الباسورد"); logActivity("تغيير باسورد فرع", branchName(d.id)); } catch (e) { toast(e.message); }
};
ACT.branchRename = async d => {
  const n = await askText("اسم الفرع", { label: "الاسم", value: branchName(d.id) }); if (!n?.trim()) return;
  const { error } = await sb.from("branches").update({ name: n.trim() }).eq("id", d.id); if (error) { toast(error.message); return; }
  await GLOBAL_TABLES.branches(); render();
};
ACT.branchOff = async d => {
  if (!(await confirmBox(`إيقاف فرع ${branchName(d.id)}؟\nالبيانات هتفضل محفوظة لكن الفرع مش هيظهر في الدخول.`, "إيقاف", true))) return;
  await sb.from("branches").update({ active: false }).eq("id", d.id); await GLOBAL_TABLES.branches();
  if (S.branchId === d.id) await switchBranch(S.branches[0]?.id || ""); else render();
};

/* ============================ المتاجر والأسعار ============================ */
MOREPAGES.stores = () => backBar("🏪 المتاجر وأسعارها") + `
  <button class="btn block mb" data-act="addStore">➕ متجر جديد</button>
  ${S.stores.map(s => { const brs = S.storeBranches.filter(b => b.store_id === s.id); const pc = Object.keys(S.prices[s.id] || {}).length;
    return `<div class="item"><div class="t"><span>${esc(s.name)}</span><span class="badge ${pc ? "b-ok" : "b-warn"}">${pc ? pc + " سعر محدد" : "بدون أسعار"}</span></div>
      <div class="m">الفروع: ${brs.map(b => esc(b.name)).join("، ") || "—"}</div>
      <div class="row wrap mt">${isSuper() ? `<button class="btn sm" data-act="editPrices" data-id="${s.id}">💰 الأسعار</button>` : ""}
        <button class="btn ghost sm" data-act="storeBranches" data-id="${s.id}">📍 الفروع</button><button class="btn ghost sm" data-act="storeRename" data-id="${s.id}">✏️</button>
        ${isSuper() ? `<button class="btn danger sm" data-act="storeDel" data-id="${s.id}">🗑️</button>` : ""}</div></div>`; }).join("") || `<div class="empty">لا توجد متاجر</div>`}
  <div class="tiny mt">سعر الكرتونة وخصم الصنف وخصم الفاتورة بيتحددوا لكل متجر على حدة وبينطبقوا على كل فروع المتجر. لو صنف ملوش سعر للمتجر بيتاخد السعر الافتراضي.</div>`;
ACT.addStore = async () => { const n = await askText("متجر جديد", { label: "اسم المتجر" }); if (!n?.trim()) return; if (await quickInsert("stores", { name: n.trim() }, "stores")) render(); };
ACT.storeRename = async d => { const s = S.stores.find(x => x.id === d.id); const n = await askText("اسم المتجر", { label: "الاسم", value: s.name }); if (!n?.trim()) return; const { error } = await sb.from("stores").update({ name: n.trim() }).eq("id", d.id); if (error) { toast(error.message); return; } await GLOBAL_TABLES.stores(); render(); };
ACT.storeDel = async d => {
  const s = S.stores.find(x => x.id === d.id);
  if (!(await askDeletePassword(`حذف المتجر ${s.name} وكل فروعه وأسعاره`))) return;
  const { error } = await sb.from("stores").delete().eq("id", d.id); if (error) { toast(error.message); return; }
  await Promise.all([GLOBAL_TABLES.stores(), GLOBAL_TABLES.store_branches(), GLOBAL_TABLES.store_prices()]); S.ver++; render();
};
ACT.storeBranches = d => {
  const s = S.stores.find(x => x.id === d.id); const brs = S.storeBranches.filter(b => b.store_id === s.id);
  openSheet(`<h2>فروع ${esc(s.name)}</h2>${brs.map(b => `<div class="between item"><span>${esc(b.name)}</span>${isAdmin() ? `<button class="btn danger sm" data-act="sbrDel" data-id="${b.id}" data-s="${s.id}">حذف</button>` : ""}</div>`).join("") || `<div class="muted mb">لا توجد فروع</div>`}
    <button class="btn block mt" data-act="sbrAdd" data-s="${s.id}">➕ فرع جديد</button>`);
};
ACT.sbrAdd = async d => { const n = await askText("فرع جديد", { label: "اسم الفرع" }); if (!n?.trim()) return; await quickInsert("store_branches", { store_id: d.s, name: n.trim() }, "store_branches"); ACT.storeBranches({ id: d.s }); };
ACT.sbrDel = async d => { if (!(await askDeletePassword("حذف فرع متجر"))) return; await sb.from("store_branches").delete().eq("id", d.id); await GLOBAL_TABLES.store_branches(); ACT.storeBranches({ id: d.s }); };

/* ---------- محرر أسعار المتجر ---------- */
ACT.editPrices = d => {
  if (!isSuper()) return;
  const store = S.stores.find(s => s.id === d.id);
  const w = S.wiz = { kind: "prices", store, edits: {}, disc: {}, inv: String(num(store.invoice_discount_pct) || ""), q: "", saving: false };
  Object.entries(S.prices[store.id] || {}).forEach(([pid, p]) => { w.edits[pid] = String(p); const dd = num(S.discounts[store.id]?.[pid]); if (dd) w.disc[pid] = String(dd); });
  w.orig = JSON.stringify([w.edits, w.disc, w.inv]);
  w.dirty = () => JSON.stringify([w.edits, w.disc, w.inv]) !== w.orig;
  w.render = () => priceEditorHtml(w);
  wizGo();
};
function priceListHtml(w) {
  const q = normAr(w.q);
  const list = S.products.filter(p => !q || normAr(p.name).includes(q) || normAr(p.code).includes(q));
  return Object.entries(groupByCategory(list)).map(([cat, ps]) => `<div class="sec">${esc(cat)}</div>` + ps.map(p => `<div class="item"><div class="between"><div><b>${esc(p.name)}</b><div class="tiny">${esc(p.code)} · افتراضي ${fmt(p.base_price)}</div></div>
    <div class="row" style="gap:6px"><input type="number" inputmode="decimal" style="width:92px;text-align:center;font-weight:800" data-in="priceEdit" data-p="${p.id}" placeholder="${fmt(p.base_price)}" value="${esc(w.edits[p.id] ?? "")}">
    <input type="number" inputmode="decimal" min="0" max="100" style="width:70px;text-align:center;font-weight:800;color:var(--green)" data-in="discEdit" data-p="${p.id}" placeholder="خصم%" value="${esc(w.disc[p.id] ?? "")}"></div></div></div>`).join("")).join("") || `<div class="empty">لا توجد أصناف</div>`;
}
function priceEditorHtml(w) {
  const others = S.stores.filter(s => s.id !== w.store.id && Object.keys(S.prices[s.id] || {}).length);
  return `<div class="between mb"><div><div class="pagetitle" style="margin:0">💰 أسعار ${esc(w.store.name)}</div><div class="tiny">سعر الكرتونة + خصم % لكل صنف — بينطبق على كل فروع المتجر</div></div><button class="btn ghost sm" data-act="wizCancel">✕ إغلاق</button></div>
    <div class="card"><div class="field" style="margin-bottom:0"><label>🏷️ خصم على الفاتورة كلها (%) — بيتخصم من إجمالي الإذن بعد خصومات الأصناف</label><input type="number" inputmode="decimal" min="0" max="100" data-in="invDiscEdit" value="${esc(w.inv)}" placeholder="0"></div></div>
    <div class="tiny mb">لو حددت خصم لصنف من غير سعر، هياخد السعر الافتراضي بتاعه.</div>
    <div class="field"><input type="search" data-in="priceSearch" placeholder="🔎 بحث عن صنف" value="${esc(w.q)}"></div>
    ${others.length ? `<div class="field"><label>نسخ الأسعار من متجر آخر</label><select data-ch="priceCopy"><option value="">اختار متجر...</option>${others.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>` : ""}
    <div id="priceList">${priceListHtml(w)}</div>
    <div class="sticky"><button class="btn green block" data-act="pricesSave" ${w.saving ? "disabled" : ""}>💾 حفظ الأسعار</button></div>`;
}
INP.priceEdit = (v, el) => { S.wiz.edits[el.dataset.p] = v; };
INP.discEdit = (v, el) => { S.wiz.disc[el.dataset.p] = v; };
INP.invDiscEdit = v => { S.wiz.inv = v; };
INP.priceSearch = v => { S.wiz.q = v; $("#priceList").innerHTML = priceListHtml(S.wiz); };
CHG.priceCopy = v => { if (!v) return; const w = S.wiz; Object.entries(S.prices[v] || {}).forEach(([pid, p]) => { w.edits[pid] = String(p); const dd = num(S.discounts[v]?.[pid]); if (dd) w.disc[pid] = String(dd); else delete w.disc[pid]; }); render(); toast("تم النسخ — راجع واضغط حفظ"); };
ACT.pricesSave = async () => {
  const w = S.wiz; w.saving = true;
  const up = [], del = [];
  const pctOf = x => Math.min(100, Math.max(0, num(x)));
  S.products.forEach(p => { const v = (w.edits[p.id] ?? "").toString().trim(); const dp = pctOf(w.disc[p.id]); const had = S.prices[w.store.id]?.[p.id] !== undefined;
    if (v !== "" && !isNaN(Number(v))) up.push({ store_id: w.store.id, product_id: p.id, price: Number(v), discount_pct: dp });
    else if (dp > 0) up.push({ store_id: w.store.id, product_id: p.id, price: num(p.base_price), discount_pct: dp });
    else if (had) del.push(p.id); });
  try {
    { const { error } = await sb.from("stores").update({ invoice_discount_pct: pctOf(w.inv) }).eq("id", w.store.id); if (error) throw error; await GLOBAL_TABLES.stores(); }
    if (up.length) { const { error } = await sb.from("store_prices").upsert(up); if (error) throw error; }
    if (del.length) { const { error } = await sb.from("store_prices").delete().eq("store_id", w.store.id).in("product_id", del); if (error) throw error; }
    await GLOBAL_TABLES.store_prices(); S.ver++; logActivity("تحديث أسعار وخصومات متجر", `${w.store.name}: ${up.length} صنف · خصم الفاتورة ${pctOf(w.inv)}%`);
    S.wiz = null; toast("تم حفظ الأسعار"); render(); window.scrollTo(0, 0);
  } catch (e) { w.saving = false; toast("تعذر الحفظ: " + e.message); }
};

/* ============================ المشرفين المتعاقدين ============================ */
MOREPAGES.sups = () => backBar("👷 المشرفين المتعاقدين") + `<button class="btn block mb" data-act="supAdd">➕ مشرف جديد</button>
  ${S.supervisors.map(s => `<div class="item"><div class="t"><span>${esc(s.name)}</span><button class="btn danger sm" data-act="supDel" data-id="${s.id}">حذف</button></div><div class="m">${esc(S.stores.find(x => x.id === s.store_id)?.name || "كل المتاجر")}</div></div>`).join("") || `<div class="empty"><div class="big">👷</div>لا يوجد مشرفين</div>`}`;
ACT.supAdd = () => openSheet(`<h2>مشرف متعاقد جديد</h2><div class="field"><label>الاسم</label><input type="text" id="sName"></div>
  <div class="field"><label>المتجر</label><select id="sStore"><option value="">كل المتاجر</option>${S.stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
  <div class="row"><button class="btn ghost grow" data-act="closeSheet">إلغاء</button><button class="btn grow" id="sSave">حفظ</button></div>`,
  s => $("#sSave", s).onclick = async () => { const n = $("#sName", s).value.trim(); if (!n) { toast("اكتب الاسم"); return; }
    if (await quickInsert("supervisors", { name: n, store_id: $("#sStore", s).value || null }, "supervisors")) { closeSheet(); render(); } });
ACT.supDel = async d => { if (!(await confirmBox("حذف المشرف؟", "حذف", true))) return; await sb.from("supervisors").delete().eq("id", d.id); await GLOBAL_TABLES.supervisors(); render(); };

/* ============================ المناديب ============================ */
MOREPAGES.reps = () => backBar("👤 المناديب") + (S.branchId ? `<button class="btn block mb" data-act="addRepQuickMore">➕ مندوب جديد</button>
  ${S.reps.map(r => `<div class="item"><div class="t"><span>${esc(r.name)}</span><button class="btn danger sm" data-act="repDel" data-id="${r.id}">حذف</button></div></div>`).join("") || `<div class="empty">لا يوجد مناديب</div>`}` : `<div class="empty">اختار فرع الأول</div>`);
ACT.addRepQuickMore = async () => { await ACT.addRepQuick(); };
ACT.repDel = async d => { if (!(await confirmBox("حذف المندوب؟ (الأذون القديمة هتفضل محفوظة)", "حذف", true))) return; await sb.from("reps").delete().eq("id", d.id); await BRANCH_TABLES.reps(); render(); };
// نسخة آمنة من addRepQuick لما تتنادى برا الـ wizard
const _addRepQuick = ACT.addRepQuick;
ACT.addRepQuick = async () => { const n = await askText("مندوب جديد", { label: "اسم المندوب" }); if (!n?.trim()) return; if (await quickInsert("reps", { branch_id: S.branchId, name: n.trim() }, "reps")) { toast("تمت الإضافة"); render(); } };

/* ============================ المستخدمين ============================ */
async function loadUsers() { const { data } = await sb.from("profiles").select("*").order("created_at", { ascending: false }); S.users = data || []; }
MOREPAGES.users = () => backBar("👥 المستخدمين") + `<button class="btn block mb" data-act="userForm" data-u="">➕ مستخدم جديد</button>
  ${S.users.map(u => { const pc = u.perms ? PERMS.filter(p => u.perms[p.key]).length : PERMS.length;
    return `<div class="item" data-act="userForm" data-u="${u.id}"><div class="t"><span>${esc(u.username)} <span class="badge b-info">${esc(titleOf(u))}</span></span>${u.active ? "" : `<span class="badge b-bad">موقوف</span>`}</div>
      <div class="m">${ROLE_LABEL[u.role]} · ${u.branch_id ? "🏢 " + esc(branchName(u.branch_id)) : "كل الفروع"}${u.role === "rep" ? " · مندوب: " + esc(S.reps.find(r => r.id === u.rep_id)?.name || "—") : ""} · ${u.role === "superadmin" ? "كل الصلاحيات" : u.role === "rep" ? "شاشة المندوب" : `${pc} من ${PERMS.length} صلاحيات`}</div></div>`; }).join("")}`;
ACT.userForm = async d => {
  const ex = d.u ? S.users.find(u => u.id === d.u) : null;
  let repsForBranch = []; let role = ex?.role || "user"; let branch = ex?.branch_id || S.branchId || S.branches[0]?.id || "";
  const loadReps = async b => { const { data } = await sb.from("reps").select("*").eq("branch_id", b).order("name"); repsForBranch = data || []; };
  if (branch) await loadReps(branch);
  const draw = () => openSheet(`<h2>${ex ? "تعديل: " + esc(ex.username) : "مستخدم جديد"}</h2>
    ${ex ? "" : `<div class="field"><label>اسم المستخدم</label><input type="text" id="uName" dir="ltr" autocapitalize="off" placeholder="مثال: omar.haram"></div>
    <div class="field"><label>كلمة السر (8 أحرف على الأقل)</label><input type="text" id="uPw" dir="ltr"></div>`}
    <div class="field"><label>الدور</label><div class="chips">${["user", "admin", "rep", "superadmin"].map(r => `<button class="chip ${role === r ? "on" : ""}" data-role="${r}">${ROLE_LABEL[r]}</button>`).join("")}</div></div>
    ${role !== "superadmin" ? `<div class="field"><label>الفرع</label><select id="uBranch">${S.branches.map(b => `<option value="${b.id}" ${b.id === branch ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></div>` : ""}
    <div class="field"><label>الكنية (تظهر جنب اسمه — مثال: أمين مخزن)</label><input type="text" id="uTitle" value="${esc(ex?.title || "")}"></div>
    ${role === "rep" ? `<div class="field"><label>ربط بمندوب</label><select id="uRep"><option value="">— اختار —</option>${repsForBranch.map(r => `<option value="${r.id}" ${ex?.rep_id === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>` : ""}
    ${(role === "user" || role === "admin") ? `<div class="field"><label>الصلاحيات</label>${PERMS.map(p => `<label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;font-weight:600;color:var(--ink)"><input type="checkbox" style="width:auto" class="pcb" data-k="${p.key}" ${(!ex?.perms || ex.perms[p.key]) ? "checked" : ""}> ${p.label}</label>`).join("")}</div>` : ""}
    ${ex ? `<label style="display:flex;gap:8px;align-items:center;margin-bottom:10px;color:var(--ink)"><input type="checkbox" style="width:auto" id="uActive" ${ex.active ? "checked" : ""}> الحساب مفعّل</label>` : ""}
    <div class="row"><button class="btn ghost grow" id="uNo">إلغاء</button><button class="btn grow" id="uOk">حفظ</button></div>
    ${ex ? `<div class="row mt"><button class="btn line grow" id="uPass">🔑 كلمة سر جديدة</button>${ex.id !== S.me.id ? `<button class="btn danger grow" id="uDel">🗑️ حذف</button>` : ""}</div>` : ""}`,
    s => {
      $$("[data-role]", s).forEach(b => b.onclick = async () => { snap(s); role = b.dataset.role; draw(); });
      const ub = $("#uBranch", s); if (ub) ub.onchange = async () => { snap(s); branch = ub.value; await loadReps(branch); draw(); };
      $("#uNo", s).onclick = closeSheet;
      $("#uOk", s).onclick = () => saveUser(s);
      const pw = $("#uPass", s); if (pw) pw.onclick = async () => { const p = await askText("كلمة سر جديدة", { label: ex.username, note: "8 أحرف على الأقل" }); if (!p) return; try { await rpc("admin_set_password", { p_user: ex.id, p_password: p }); toast("تم تغيير كلمة السر"); logActivity("تغيير كلمة سر", ex.username); } catch (e) { toast(e.message); } draw(); };
      const dl = $("#uDel", s); if (dl) dl.onclick = async () => { closeSheet(); if (!(await confirmBox(`حذف المستخدم ${ex.username} نهائيًا؟`, "حذف", true))) return; try { await rpc("admin_delete_user", { p_user: ex.id }); await loadUsers(); toast("تم الحذف"); render(); } catch (e) { toast(e.message); } };
    });
  let draft = {};
  const snap = s => { draft = { title: $("#uTitle", s)?.value, name: $("#uName", s)?.value, pw: $("#uPw", s)?.value }; setTimeout(() => { if ($("#uTitle")) { if (draft.title !== undefined) $("#uTitle").value = draft.title; if ($("#uName")) $("#uName").value = draft.name || ""; if ($("#uPw")) $("#uPw").value = draft.pw || ""; } }, 0); };
  const saveUser = async s => {
    const title = $("#uTitle", s).value.trim(); const br = role === "superadmin" ? null : ($("#uBranch", s)?.value || null);
    const perms = (role === "user" || role === "admin") ? Object.fromEntries($$(".pcb", s).map(c => [c.dataset.k, c.checked])) : null;
    const repId = role === "rep" ? ($("#uRep", s)?.value || null) : null;
    if (role !== "superadmin" && !br) { toast("اختار الفرع"); return; }
    if (role === "rep" && !repId) { toast("اربط المندوب باسم من قائمة المناديب"); return; }
    if (ex) {
      const { error } = await sb.from("profiles").update({ role, title, branch_id: br, rep_id: repId, perms, active: $("#uActive", s).checked }).eq("id", ex.id);
      if (error) { toast(error.message); return; }
      closeSheet(); await loadUsers(); logActivity("تعديل مستخدم", ex.username); toast("تم الحفظ"); render(); return;
    }
    const username = $("#uName", s).value.trim().toLowerCase(), pw = $("#uPw", s).value;
    if (!username || pw.length < 8) { toast("اكتب اسم المستخدم وكلمة سر 8 أحرف على الأقل"); return; }
    const c = getConn(); const nostore = { getItem() { return null; }, setItem() { }, removeItem() { } };
    const sb2 = supabase.createClient(c.url, c.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storage: nostore } });
    const { data, error } = await sb2.auth.signUp({ email: emailOf(username), password: pw });
    if (error || !data.user) { toast(/registered|exists/i.test(error?.message || "") ? "اسم المستخدم موجود بالفعل" : (error?.message || "تعذر إنشاء الحساب")); return; }
    const { error: e2 } = await sb.from("profiles").insert({ id: data.user.id, username, role, title, branch_id: br, rep_id: repId, perms, active: true });
    if (e2) { toast("اتعمل الحساب لكن البروفايل فشل: " + e2.message); return; }
    closeSheet(); await loadUsers(); logActivity("إضافة مستخدم", username);
    toast(data.session ? "تم إنشاء المستخدم" : "تم الإنشاء — لازم توقف Confirm email من إعدادات Supabase علشان يقدر يدخل", 4500); render();
  };
  draw();
};

/* ============================ الإعدادات ============================ */
MOREPAGES.settings = () => backBar("⚙️ إعدادات التطبيق") + `
  <div class="card"><div class="field"><label>اسم الشركة (الشاشة والطباعة)</label><input type="text" id="sAppName" value="${esc(appName())}"></div>
    <div class="field"><label>رقم السجل التجاري (على الإذن)</label><input type="text" id="sCR" value="${esc(setting("commercial_register", ""))}" dir="ltr"></div>
    <div class="field"><label>رقم البطاقة الضريبية (على الإذن)</label><input type="text" id="sTax" value="${esc(setting("tax_card", ""))}" dir="ltr"></div>
    <div class="field"><label>أقصى خصم بدون موافقة أدمن (%)</label><input type="number" id="sDisc" value="${maxDiscount()}"></div>
    ${isSuper() ? `<button class="btn block" data-act="saveSettings">حفظ</button>` : `<div class="muted">التعديل للسوبر أدمن فقط</div>`}</div>
  ${isSuper() ? `<div class="card"><h3>🖼️ الشعار</h3><div class="center mb"><img src="${esc(logoUrl())}" style="max-height:90px;max-width:100%" alt=""></div>
    <input type="file" id="sLogo" accept="image/*"><div class="row mt"><button class="btn grow" data-act="saveLogo">حفظ الشعار</button>${setting("logo_url", "") ? `<button class="btn danger" data-act="resetLogo">الشعار الافتراضي</button>` : ""}</div>
    <div class="tiny mt">الشعار بيظهر في الهيدر وفي أذون الصرف المطبوعة.</div></div>
  <div class="card"><h3>🔐 كلمة سر الحذف</h3><div class="muted mb">أي عملية حذف (إذن / مرتجع / وارد / صنف) محتاجة الكلمة دي.</div><button class="btn line block" data-act="setDelPw">تغيير كلمة سر الحذف</button></div>` : ""}`;
ACT.saveSettings = async () => {
  const ok = await Promise.all([saveSetting("app_name", $("#sAppName").value.trim() || "أوشين فود"), saveSetting("commercial_register", $("#sCR").value.trim()), saveSetting("tax_card", $("#sTax").value.trim()), saveSetting("max_discount_pct", Math.max(0, num($("#sDisc").value)))]);
  if (ok.every(Boolean)) { toast("تم الحفظ"); render(); }
};
ACT.saveLogo = async () => { const f = $("#sLogo").files[0]; if (!f) { toast("اختار صورة"); return; } const url = await resizeImage(f, 700, .9, true); if (await saveSetting("logo_url", url)) { toast("تم حفظ الشعار"); render(); } };
ACT.resetLogo = async () => { if (await saveSetting("logo_url", "")) render(); };
ACT.setDelPw = async () => { const p = await askText("كلمة سر الحذف الجديدة", { label: "الكلمة (6 أحرف على الأقل)", type: "password" }); if (!p) return; if (p.length < 6) { toast("الكلمة قصيرة (6 أحرف على الأقل)"); return; } try { await rpc("set_delete_password", { p }); toast("تم تغيير كلمة سر الحذف"); logActivity("تغيير كلمة سر الحذف"); } catch (e) { toast(e.message); } };

/* ============================ سجل النشاط ============================ */
async function loadActivity() {
  let q = sb.from("activity").select("*").order("created_at", { ascending: false }).limit(300); if (S.branchId) q = q.eq("branch_id", S.branchId);
  const { data } = await q; S.activity = data || [];
}
MOREPAGES.activity = () => backBar("🧾 سجل النشاط") + (S.activity.map(a => `<div class="item"><div class="t"><span>${esc(a.action)}</span><span class="tiny">${fmtTime(a.created_at)}</span></div><div class="m">👤 ${esc(a.username || "")}${a.details ? " · " + esc(a.details) : ""}</div></div>`).join("") || `<div class="empty">لا يوجد نشاط</div>`);
