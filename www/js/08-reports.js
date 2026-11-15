/* =====================================================================
   08-reports.js — التقارير (ألوان واضحة)
===================================================================== */
const RP = () => (S.sub.rep = S.sub.rep || { period: "month", anchor: todayStr() });

function barList(obj, unit = "") {
  const e = Object.entries(obj).filter(([k]) => k && k !== "undefined" && k !== "null").sort((a, b) => b[1] - a[1]);
  if (!e.length) return `<div class="muted">لا توجد بيانات كافية بعد</div>`;
  const max = e[0][1] || 1;
  return e.map(([k, v]) => `<div class="bar-row"><div class="l"><span>${esc(k)}</span><span>${fmt(v)}${unit}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, v / max * 100)}%"></div></div></div>`).join("");
}
function reportData() {
  const r = RP(); const range = periodRange(r.period, r.anchor);
  const f = x => r.period === "all" || inRange(x.date, range);
  const vouchers = S.vouchers.filter(f), returns = S.returns.filter(f), incoming = S.incoming.filter(f);
  const byRep = {}, byMerchant = {}, byStore = {}, byCat = {}, byBranch = {}, bySup = {}, prod = {}; const repPerf = {};
  let sales = 0, disc = 0, qtyOut = 0;
  vouchers.forEach(v => {
    sales += num(v.total); disc += itemsTotal(v.items || []) * num(v.invoice_discount_pct) / 100; byRep[v.rep_name] = (byRep[v.rep_name] || 0) + num(v.total);
    byMerchant[v.merchant_label] = (byMerchant[v.merchant_label] || 0) + num(v.total);
    const sn = S.stores.find(s => s.id === v.store_id)?.name || (v.merchant_label || "").split(" - ")[0]; byStore[sn] = (byStore[sn] || 0) + num(v.total);
    if (v.supervisor_name) bySup[v.supervisor_name] = (bySup[v.supervisor_name] || 0) + num(v.total);
    byBranch[branchName(v.branch_id)] = (byBranch[branchName(v.branch_id)] || 0) + num(v.total);
    const rp = repPerf[v.rep_name] || (repPerf[v.rep_name] = { v: 0, total: 0, ret: 0 }); rp.v++; rp.total += num(v.total);
    (v.items || []).forEach(i => {
      disc += num(i.qty) * num(i.price) * num(i.discountPct); qtyOut += num(i.qty);
      const c = i.category || productByCode(i.code)?.category || "بدون تصنيف"; byCat[c] = (byCat[c] || 0) + lineTotal(i);
      const p = prod[i.code] || (prod[i.code] = { name: i.name, out: 0, val: 0, ret: 0 }); p.out += num(i.qty); p.val += lineTotal(i);
    });
  });
  let retQty = 0;
  returns.forEach(x => { if (x.rep_name && repPerf[x.rep_name]) repPerf[x.rep_name].ret++; else if (x.rep_name) repPerf[x.rep_name] = { v: 0, total: 0, ret: 1 };
    (x.items || []).forEach(i => { retQty += num(i.qty); const p = prod[i.code] || (prod[i.code] = { name: i.name, out: 0, val: 0, ret: 0 }); p.ret += num(i.qty); }); });
  const inQty = incoming.reduce((s, x) => s + num(x.total_qty), 0);
  return { range, vouchers, returns, incoming, sales, disc, qtyOut, retQty, inQty, byRep, byMerchant, byStore, byCat, byBranch, bySup, prod, repPerf };
}
VIEWS.reports = function () {
  if (!S.branchId && !isSuper()) return `<div class="empty">لا يوجد فرع</div>`;
  const r = RP(), d = reportData();
  const label = r.period === "all" ? "كل الفترات" : `${ltr(d.range.start)} ← ${ltr(d.range.end)}`;
  const rows = Object.values(d.prod).sort((a, b) => b.val - a.val);
  const perf = Object.entries(d.repPerf).sort((a, b) => b[1].total - a[1].total);
  return `
    <div class="chips scroll mb noprint">${Object.entries(PERIODS).map(([k, l]) => `<button class="chip ${r.period === k ? "on" : ""}" data-act="rpPeriod" data-p="${k}">${l}</button>`).join("")}</div>
    ${r.period !== "all" ? `<div class="between mb noprint"><button class="btn ghost sm" data-act="rpShift" data-d="-1">‹ السابق</button><b style="font-size:13px">${label}</b><button class="btn ghost sm" data-act="rpShift" data-d="1">التالي ›</button></div>
      ${r.anchor !== todayStr() ? `<button class="btn line sm block mb noprint" data-act="rpToday">↺ الفترة الحالية</button>` : ""}` : ""}
    <div class="row mb noprint"><button class="btn line grow" data-act="printNow" data-n="report-${todayStr()}">🖨️ طباعة / PDF</button>${can("export") ? `<button class="btn line grow" data-act="rpExport">📊 Excel</button>` : ""}</div>
    <div id="printArea" style="background:var(--bg)">
      <div class="card center"><b style="font-size:16px;color:var(--brand2)">${esc(appName())} — تقرير المبيعات والمخزون</b>
        <div class="muted">${esc(isSuper() && !S.branchId ? "كل الفروع" : branchName(S.branchId))} · الفترة: ${label}</div></div>
      <div class="stats">
        <div class="stat green"><div class="n">${fmt(d.sales)}</div><div class="l">إجمالي المبيعات</div></div>
        <div class="stat"><div class="n">${fmt(d.disc)}</div><div class="l">إجمالي الخصومات</div></div>
        <div class="stat"><div class="n">${fmt(d.qtyOut)}</div><div class="l">الكميات المصروفة</div></div>
        <div class="stat red"><div class="n">${fmt(d.retQty)}</div><div class="l">الكميات المرتجعة</div></div>
        <div class="stat"><div class="n">${fmt(d.inQty)}</div><div class="l">الكميات الواردة</div></div>
        <div class="stat"><div class="n">${fmt(d.vouchers.length)}</div><div class="l">عدد الأذون</div></div>
      </div>
      ${!S.branchId && isSuper() ? `<div class="sec">🏢 حسب الفرع</div><div class="card">${barList(d.byBranch)}</div>` : ""}
      <div class="sec">🎯 أداء المناديب</div>
      <div class="card">${perf.map(([n, p]) => `<div class="item" style="box-shadow:none"><div class="t"><span>👤 ${esc(n)}</span><span style="color:var(--brand2)">${fmt(p.total)}</span></div><div class="m">🧾 ${fmt(p.v)} إذن صرف · ↩️ ${fmt(p.ret)} مرتجع</div></div>`).join("") || `<div class="muted">لا توجد بيانات كافية بعد</div>`}</div>
      <div class="sec">👤 حسب المندوب</div><div class="card">${barList(d.byRep)}</div>
      <div class="sec">🏪 حسب المتجر</div><div class="card">${barList(d.byStore)}</div>
      <div class="sec">📍 حسب التاجر (فرع المتجر)</div><div class="card">${barList(d.byMerchant)}</div>
      ${Object.keys(d.bySup).length ? `<div class="sec">👷 حسب المشرف المتعاقد</div><div class="card">${barList(d.bySup)}</div>` : ""}
      <div class="sec">🗂️ حسب التصنيف</div><div class="card">${barList(d.byCat)}</div>
      <div class="sec">حركة الأصناف بالتفصيل</div>
      <div class="card scrollx"><table class="t"><tr><th>الصنف</th><th>مصروف</th><th>القيمة</th><th>مرتجع</th><th>الصافي</th></tr>
        ${rows.map(p => `<tr><td>${esc(p.name)}</td><td>${fmt(p.out)}</td><td>${fmt(p.val)}</td><td>${fmt(p.ret)}</td><td>${fmt(p.out - p.ret)}</td></tr>`).join("") || `<tr><td colspan="5">لا توجد بيانات</td></tr>`}</table></div>
    </div>`;
};
ACT.rpPeriod = d => { const r = RP(); r.period = d.p; r.anchor = todayStr(); render(); };
ACT.rpShift = d => { const r = RP(); r.anchor = shiftAnchor(r.period, r.anchor, Number(d.d)); render(); };
ACT.rpToday = () => { RP().anchor = todayStr(); render(); };
ACT.rpExport = () => {
  if (!can("export")) return; const d = reportData(); const pe = Object.values(d.prod).sort((a, b) => b.val - a.val);
  const sheet = (name, o) => ({ name, rows: [[name, "القيمة"], ...Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, round2(v)])] });
  exportWorkbook([
    { name: "ملخص", rows: [["البند", "القيمة"], ["إجمالي المبيعات", round2(d.sales)], ["إجمالي الخصومات", round2(d.disc)], ["الكميات المصروفة", d.qtyOut], ["الكميات المرتجعة", d.retQty], ["الكميات الواردة", d.inQty], ["عدد الأذون", d.vouchers.length]] },
    sheet("حسب المندوب", d.byRep), sheet("حسب المتجر", d.byStore), sheet("حسب التاجر", d.byMerchant), sheet("حسب التصنيف", d.byCat),
    { name: "الأصناف", rows: [["الصنف", "مصروف", "القيمة", "مرتجع", "الصافي"], ...pe.map(p => [p.name, p.out, round2(p.val), p.ret, p.out - p.ret])] }
  ], `report-${branchName(S.branchId) || "all"}-${todayStr()}`);
};
