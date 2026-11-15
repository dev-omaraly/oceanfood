/* =====================================================================
   03-ui-main.js — التشغيل، الراوتر، الدخول، الرئيسية
===================================================================== */
const ACT = {}, INP = {}, CHG = {};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const f = ACT[el.dataset.act]; if (f) { e.preventDefault(); Promise.resolve(f(el.dataset, el, e)).catch(err => { console.error(err); toast(err?.message || "حصل خطأ"); }); }
});
document.addEventListener("input", e => { const el = e.target.closest("[data-in]"); if (el && INP[el.dataset.in]) INP[el.dataset.in](el.value, el, e); });
document.addEventListener("change", e => { const el = e.target.closest("[data-ch]"); if (el && CHG[el.dataset.ch]) CHG[el.dataset.ch](el.value, el, e); });

const VIEWS = {}; // id -> () => html  (بتتعبّى من باقي الملفات)

function visibleTabs() {
  const t = [{ id: "home", label: "الرئيسية", ic: "home" }];
  if (isRep()) { t.push({ id: "more", label: "حسابي", ic: "menu" }); return t; }
  if (can("history")) t.push({ id: "history", label: "السجل", ic: "doc" });
  if (can("inventory") || can("stocktake") || can("receive")) t.push({ id: "inventory", label: "المخزون", ic: "box" });
  if (can("reports")) t.push({ id: "reports", label: "التقارير", ic: "chart" });
  t.push({ id: "more", label: "المزيد", ic: "menu" });
  return t;
}

function headerHtml() {
  const b = curBranch();
  const bn = isSuper() ? (b ? b.name : "كل الفروع") : (b?.name || branchName(S.me.branch_id) || "");
  return `<header class="top">
    <div class="brandline">
      <img class="logo" src="${esc(logoUrl())}" alt="">
      <div><h1>${esc(appName())}</h1>
        <div class="sub">${isSuper() ? `<button class="pill-btn" data-act="pickBranch">📍 ${esc(bn || "اختار الفرع")} ▾</button>` : `📍 ${esc(bn)}`}</div></div>
      <div class="who"><b>${esc(S.me.username)}</b><br>${esc(titleOf(S.me))}</div>
    </div></header>`;
}
function navHtml(tabs) {
  const pend = S.unloads.filter(u => u.status === "pending").length;
  return `<nav class="bar">${tabs.map(t => `<button class="${S.tab === t.id ? "on" : ""}" data-act="tab" data-t="${t.id}">${IC[t.ic]}<span>${t.label}${t.id === "inventory" && pend && can("receive") ? ` <span class="badge b-bad">${pend}</span>` : ""}</span></button>`).join("")}</nav>`;
}

function render() {
  const app = $("#app");
  if (!sb) { app.innerHTML = setupHtml(); return; }
  if (!S.me) { app.innerHTML = loginHtml(); return; }
  const tabs = visibleTabs();
  if (!tabs.find(t => t.id === S.tab)) S.tab = "home";
  const scroll = window.scrollY;
  if (S.wiz) {
    app.innerHTML = headerHtml() + `<main id="main">${S.wiz.render()}</main>`;
  } else {
    const v = VIEWS[S.tab]; let body = "";
    try { body = v ? v() : ""; } catch (e) { console.error(e); body = `<div class="card">حصل خطأ في عرض الصفحة: ${esc(e.message)}</div>`; }
    app.innerHTML = headerHtml() + `<main id="main">${body}</main>` + navHtml(tabs);
  }
  window.scrollTo(0, scroll);
}
ACT.tab = d => { S.tab = d.t; S.dirty = false; render(); window.scrollTo(0, 0); };

/* ---------- تغيير الفرع (سوبر أدمن) ---------- */
ACT.pickBranch = () => {
  openSheet(`<h2>اختار الفرع</h2>
    ${S.branches.map(b => `<button class="branchbtn ${b.id === S.branchId ? "on" : ""}" data-act="doPickBranch" data-id="${b.id}"><span>${esc(b.name)}</span><span>${b.id === S.branchId ? "✓" : "‹"}</span></button>`).join("") || `<div class="muted">لا توجد فروع. أضف فرع من (المزيد ← الفروع).</div>`}
    <button class="branchbtn ${S.branchId === "" ? "on" : ""}" data-act="doPickBranch" data-id=""><span>🌐 كل الفروع (عرض وتقارير فقط)</span><span>${S.branchId === "" ? "✓" : "‹"}</span></button>`);
};
ACT.doPickBranch = async d => { closeSheet(); toast("جاري تحميل بيانات الفرع..."); await switchBranch(d.id); };

/* ---------- شاشة إعداد الاتصال (لو config.js فاضي) ---------- */
function setupHtml() {
  return `<div class="login"><div class="hero"><img src="logo.png" alt=""><p>إعداد الاتصال بقاعدة البيانات</p></div>
    <div class="box">
      <div class="field"><label>Project URL (من Supabase ← Settings ← API)</label><input type="text" id="cfgUrl" placeholder="https://xxxx.supabase.co" dir="ltr"></div>
      <div class="field"><label>anon public key</label><input type="text" id="cfgKey" placeholder="eyJ..." dir="ltr"></div>
      <button class="btn block" data-act="saveCfg">حفظ والمتابعة</button>
      <div class="tiny mt">لو حطيتهم في ملف config.js مش هتحتاج الشاشة دي.</div>
    </div></div>`;
}
ACT.saveCfg = () => {
  const u = $("#cfgUrl").value.trim(), k = $("#cfgKey").value.trim();
  if (!/^https:\/\/.+\.supabase\.co/i.test(u) || k.length < 40) { toast("البيانات غير صحيحة"); return; }
  localStorage.setItem("of_url", u); localStorage.setItem("of_key", k); location.reload();
};

/* ---------- شاشة الدخول: (1) الفرع + باسورد الفرع  (2) اليوزر ---------- */
const L = { step: 1, branches: [], branchId: "", branchName: "", loading: true, err: "", admin: false };
function loginHtml() {
  const head = `<div class="hero"><img src="${esc(logoUrl())}" alt=""><p>نظام المخزون والمبيعات</p></div>`;
  if (L.step === 1) {
    return `<div class="login">${head}<div class="box">
      <div class="sec" style="margin-top:0">🏢 اختار الفرع</div>
      ${L.loading ? `<div class="muted center">جاري التحميل...</div>` : (L.branches.map(b => `<button class="branchbtn ${L.branchId === b.id ? "on" : ""}" data-act="lgBranch" data-id="${b.id}" data-n="${esc(b.name)}"><span>${esc(b.name)}</span><span>${L.branchId === b.id ? "✓" : "‹"}</span></button>`).join("") || `<div class="muted center">لا توجد فروع بعد — الدخول للإدارة بس</div>`)}
      ${L.branchId ? `<div class="field mt"><label>باسورد فرع ${esc(L.branchName)}</label><input type="password" id="lgBranchPw" autocomplete="off"></div>
        <button class="btn block" data-act="lgNext">التالي ›</button>` : ""}
      ${L.err ? `<div class="badge b-bad mt">${esc(L.err)}</div>` : ""}
      <div class="center mt2"><button class="btn ghost sm" data-act="lgAdmin">🔑 دخول الإدارة</button></div>
    </div></div>`;
  }
  return `<div class="login">${head}<div class="box">
    <div class="between mb"><b>${L.admin ? "🔑 دخول الإدارة" : "🏢 " + esc(L.branchName)}</b><button class="btn ghost sm" data-act="lgBack">‹ رجوع</button></div>
    <div class="field"><label>اسم المستخدم</label><input type="text" id="lgUser" autocomplete="username" autocapitalize="off" dir="ltr" value="${esc(L.user || "")}"></div>
    <div class="field"><label>كلمة السر</label><input type="password" id="lgPass" autocomplete="current-password" dir="ltr"></div>
    <button class="btn block" data-act="lgGo">دخول</button>
    ${L.err ? `<div class="badge b-bad mt">${esc(L.err)}</div>` : ""}
  </div></div>`;
}
async function loadLoginBranches() {
  L.loading = true;
  try { L.branches = (await rpc("list_branches")) || []; L.err = ""; }
  catch (e) { L.err = "تعذر تحميل الفروع (اتأكد من تنفيذ ملف schema.sql وإعدادات الاتصال)"; console.error(e); }
  L.loading = false; if (!S.me) render();
}
ACT.lgBranch = d => { L.branchId = d.id; L.branchName = d.n; L.err = ""; render(); setTimeout(() => $("#lgBranchPw")?.focus(), 50); };
ACT.lgNext = async () => {
  const pw = $("#lgBranchPw").value;
  if (!pw) { L.err = "اكتب باسورد الفرع"; render(); return; }
  try {
    const ok = await rpc("check_branch_password", { p_branch: L.branchId, p_password: pw });
    if (!ok) { L.err = "باسورد الفرع غير صحيح"; render(); return; }
    L.step = 2; L.admin = false; L.err = ""; render(); setTimeout(() => $("#lgUser")?.focus(), 50);
  } catch (e) { L.err = e.locked ? e.message : "تعذر التحقق من الباسورد"; render(); }
};
ACT.lgAdmin = () => { L.step = 2; L.admin = true; L.err = ""; render(); };
ACT.lgBack = () => { L.step = 1; L.err = ""; render(); };
ACT.lgGo = async () => {
  const u = $("#lgUser").value.trim(), p = $("#lgPass").value; L.user = u;
  if (!u || !p) { L.err = "اكتب اسم المستخدم وكلمة السر"; render(); return; }
  try {
    await signIn(u, p, L.admin ? "" : L.branchId);
    if (L.admin && !isSuper()) { await sb.auth.signOut(); S.me = null; throw new Error("دخول الإدارة للسوبر أدمن بس. اختار فرعك."); }
    L.err = ""; L.step = 1; L.user = ""; render();
  } catch (e) { L.err = e.message || "فشل الدخول"; render(); }
};
document.addEventListener("keydown", e => { if (e.key === "Enter" && !S.me && L.step === 2 && e.target.id === "lgPass") ACT.lgGo(); });

/* ---------- الرئيسية (للموظفين) ---------- */
VIEWS.home = function () {
  if (isRep()) return viewRepHome();
  if (!S.branchId) {
    return `<div class="card center"><div class="big" style="font-size:40px">🏢</div>
      <b>${S.branches.length ? "اختار فرع من الأعلى" : "مفيش فروع لسه"}</b>
      <div class="muted mt">${S.branches.length ? "علشان تشتغل لازم تحدد الفرع." : "ابدأ بإضافة أول فرع من (المزيد ← الفروع)."}</div>
      ${!S.branches.length ? `<button class="btn mt" data-act="tab" data-t="more">فتح المزيد</button>` : ""}</div>`;
  }
  const td = todayStr();
  const vt = S.vouchers.filter(v => v.date === td);
  const sales = vt.reduce((s, v) => s + num(v.total), 0);
  const low = S.products.filter(p => stockOf(p) <= LOW_STOCK).length;
  const pend = S.unloads.filter(u => u.status === "pending").length;
  const tiles = [];
  if (can("voucher")) tiles.push(`<button class="tile a" data-act="newVoucher">${IC.out}إذن صرف</button>`);
  if (can("returns")) tiles.push(`<button class="tile b" data-act="newReturn">${IC.ret}مرتجع</button>`);
  if (can("incoming")) tiles.push(`<button class="tile c" data-act="newIncoming">${IC.inn}وارد</button>`);
  return `
    <div class="stats">
      <div class="stat"><div class="n">${fmt(vt.length)}</div><div class="l">أذون صرف النهاردة</div></div>
      <div class="stat green"><div class="n">${fmt(sales)}</div><div class="l">مبيعات النهاردة</div></div>
      <div class="stat ${low ? "red" : ""}"><div class="n">${fmt(low)}</div><div class="l">أصناف رصيدها قليل</div></div>
      <div class="stat"><div class="n">${fmt(pend)}</div><div class="l">تفريغ بانتظار الاستلام</div></div>
    </div>
    ${tiles.length ? `<div class="tiles" style="grid-template-columns:repeat(${tiles.length},1fr)">${tiles.join("")}</div>` : ""}
    <div class="sec">آخر أذون الصرف</div>
    ${S.vouchers.slice(0, 6).map(voucherRow).join("") || `<div class="empty"><div class="big">🧾</div>لا توجد أذون بعد</div>`}`;
};
function voucherRow(v) {
  return `<div class="item" data-act="openVoucher" data-id="${v.id}"><div class="t"><span>إذن #${esc(v.number)}</span><span style="color:var(--brand2)">${fmt(v.total)}</span></div>
    <div class="m">${esc(v.rep_name || "")} ← ${esc(v.merchant_label || "")} · ${ltr(v.date)}</div>
    ${v.supervisor_name ? `<div class="m">👷 المشرف المتعاقد: ${esc(v.supervisor_name)}</div>` : ""}</div>`;
}

/* ---------- تشغيل ---------- */
async function boot() {
  $("#app").innerHTML = `<div class="login"><div class="hero"><img src="logo.png" alt=""><p>جاري التحميل...</p></div></div>`;
  if (!window.supabase) { $("#app").innerHTML = `<div class="login"><div class="box">تعذر تحميل مكتبة Supabase. اتأكد من الإنترنت أو من وجود vendor/supabase.js</div></div>`; return; }
  if (!initClient()) { render(); return; }
  try { const me = await fetchProfile(); if (me) await afterAuth(); } catch (e) { console.error(e); }
  render();
  if (!S.me) loadLoginBranches();
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && S.me) { S.me = null; render(); } });
}
window.addEventListener("load", () => {
  boot();
  if ("serviceWorker" in navigator && location.protocol === "https:" && !isNative()) navigator.serviceWorker.register("sw.js").catch(() => { });
});
