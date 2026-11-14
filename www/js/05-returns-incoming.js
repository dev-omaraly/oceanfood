/* =====================================================================
   05-returns-incoming.js — المرتجعات والوارد
===================================================================== */
const RETURN_REASONS = ["رفض العميل", "تالف", "زيادة عن الطلب", "أخرى"];

/* ============================ المرتجع ============================ */
function startReturn() {
  if (!S.branchId) { toast("اختار الفرع الأول"); return; }
  if (!can("returns")) { toast("ليس لديك صلاحية"); return; }
  const w = S.wiz = { kind: "return", step: 1, voucher: null, items: [], q: "", saved: null, saving: false };
  w.dirty = () => w.step < 3 && w.items.length;
  w.render = () => renderReturnWiz(w);
  wizGo();
}
ACT.newReturn = startReturn;
const returnedFor = vn => {
  const m = {}; S.returns.filter(r => String(r.voucher_number || "").split("،").map(x => x.trim()).includes(String(vn)))
    .forEach(r => (r.items || []).forEach(i => { m[i.code] = (m[i.code] || 0) + num(i.qty); })); return m;
};
function renderReturnWiz(w) {
  if (w.step === 1) {
    const q = w.q.trim();
    const list = (q ? S.vouchers.filter(v => String(v.number).includes(q) || normAr(v.merchant_label).includes(normAr(q)) || normAr(v.rep_name).includes(normAr(q))) : S.vouchers).slice(0, 25);
    return wizHead("اختار إذن الصرف", 1, 3) + `
      <div class="field"><input type="search" data-in="retSearch" placeholder="🔎 رقم الإذن أو التاجر أو المندوب" value="${esc(w.q)}" inputmode="search"></div>
      <div id="retList">${retListHtml(list)}</div>`;
  }
  if (w.step === 2) {
    const v = w.voucher, prev = returnedFor(v.number);
    return wizHead("أصناف المرتجع", 2, 3) + `
      <div class="card"><b>إذن #${esc(v.number)}</b><div class="m muted">${esc(v.rep_name)} ← ${esc(v.merchant_label)} · ${ltr(v.date)}</div></div>
      <div class="sec" style="margin-top:0">اضغط على الصنف اللي رجع</div>
      ${(v.items || []).map(it => { const done = prev[it.code] || 0, sel = w.items.find(x => x.code === it.code);
      return `<button class="pick block ${sel ? "on" : ""}" style="width:100%;margin-bottom:8px" data-act="retPick" data-code="${esc(it.code)}">
        <span>${esc(it.name)}</span><small>المصروف ${qtyLabel(it)}${done ? ` · سبق إرجاع ${fmt(done)}` : ""}${sel ? ` · <b>مرتجع الآن ${fmt(sel.qty)}</b>` : ""}</small></button>`; }).join("")}
      <div class="sticky"><div class="row"><button class="btn ghost" data-act="retBack">‹ رجوع</button>
        <button class="btn red grow" data-act="retSave" ${w.items.length && !w.saving ? "" : "disabled"}>✅ حفظ المرتجع</button></div></div>`;
  }
  const r = w.saved;
  return `<div class="center mb noprint"><div style="font-size:38px">✅</div><b style="color:var(--green)">تم حفظ المرتجع ${esc(r.number)}</b></div>${returnDoc(r)}
    <div class="sticky noprint"><div class="row"><button class="btn line grow" data-act="printNow" data-n="return-${esc(r.number)}">🖨️ طباعة / PDF</button><button class="btn grow" data-act="wizCancel">تم</button></div></div>`;
}
const retListHtml = list => list.map(v => `<div class="item" data-act="retVoucher" data-id="${v.id}"><div class="t"><span>إذن #${esc(v.number)}</span><span class="tiny">${ltr(v.date)}</span></div><div class="m">${esc(v.rep_name || "")} ← ${esc(v.merchant_label || "")}</div></div>`).join("") || `<div class="empty">لا توجد أذون مطابقة</div>`;
INP.retSearch = v => { const w = S.wiz; if (!w || w.kind !== "return") return; w.q = v; const q = v.trim();
  const list = (q ? S.vouchers.filter(x => String(x.number).includes(q) || normAr(x.merchant_label).includes(normAr(q)) || normAr(x.rep_name).includes(normAr(q))) : S.vouchers).slice(0, 25);
  $("#retList").innerHTML = retListHtml(list); };
ACT.retVoucher = d => { const w = S.wiz; w.voucher = S.vouchers.find(v => v.id === d.id); w.items = []; w.step = 2; wizGo(); };
ACT.retBack = () => { S.wiz.step = 1; wizGo(); };
ACT.retPick = d => {
  const w = S.wiz, it = w.voucher.items.find(x => x.code === d.code), ex = w.items.find(x => x.code === d.code);
  qtySheet({
    title: it.name, sub: `المصروف في الإذن: ${qtyLabel(it)}`, unit: it.unit, upc: it.unitsPerCarton || upcOf(productByCode(it.code)),
    allowPack: it.unit === "كرتونة", reasons: RETURN_REASONS, reason: ex?.reasonBase, qty: ex?.qty || 1, packQty: ex?.packQty,
    okText: ex ? "تحديث" : "إضافة للمرتجع", onRemove: ex ? () => { w.items.splice(w.items.indexOf(ex), 1); render(); } : null,
    onDone: c => {
      const row = { code: it.code, name: it.name, category: it.category || "", unit: it.unit, price: it.price, qty: c.qty, packQty: c.packQty, unitsPerCarton: c.packQty ? (it.unitsPerCarton || upcOf(productByCode(it.code))) : null, reason: c.reason, reasonBase: c.reason };
      if (ex) Object.assign(ex, row); else w.items.push(row);
      render();
    }
  });
  // لو عايز يشيل صنف: ضغطة طويلة غير متاحة، فنوفر زر حذف داخل النافذة التالية
};
ACT.retSave = async () => {
  const w = S.wiz; if (w.saving) return; w.saving = true; render();
  try {
    const number = await nextNumber("return");
    const items = w.items.map(({ reasonBase, ...r }) => r);
    const row = { branch_id: S.branchId, number, date: todayStr(), rep_name: w.voucher.rep_name, merchant_label: w.voucher.merchant_label, voucher_number: String(w.voucher.number), items, qty: items.reduce((s, i) => s + num(i.qty), 0), created_by_name: S.me.username };
    const { data, error } = await sb.from("returns").insert(row).select().single(); if (error) throw error;
    S.returns.unshift(data); S.ver++; w.saved = data; w.step = 3; w.saving = false;
    logActivity("تسجيل مرتجع", `${data.number} - ${items.length} صنف (إذن #${data.voucher_number})`);
    toast("تم حفظ المرتجع"); wizGo();
  } catch (e) { console.error(e); w.saving = false; toast("خطأ أثناء الحفظ: " + (e.message || "")); render(); }
};
function returnDoc(r) {
  const rows = groupedItemRows(r.items || [], 3, it => `<tr><td class="l">${esc(it.name)}</td><td>${fmt(it.qty)}${it.packQty ? ` <span style="font-size:10px;color:#666">(${fmt(it.packQty)} علبة)</span>` : ""}</td><td>${esc(it.reason || "")}</td></tr>`);
  return docShell("مرتجع", r.number, [["التاريخ", r.date], ["الفرع", branchName(r.branch_id)], ["المندوب", r.rep_name], ["التاجر", r.merchant_label], r.voucher_number ? ["من إذن", r.voucher_number] : null],
    `<table><tr><th>الصنف</th><th>الكمية</th><th>السبب</th></tr>${rows}</table>`, `<div class="sign"><div>المندوب</div><div>أمين المخزن</div><div>المراجع</div></div>`);
}

/* ============================ الوارد ============================ */
function startIncoming() {
  if (!S.branchId) { toast("اختار الفرع الأول"); return; }
  if (!can("incoming")) { toast("ليس لديك صلاحية"); return; }
  const w = S.wiz = { kind: "incoming", step: 1, supplier: "", note: "", date: todayStr(), items: [], q: "", open: {}, saved: null, saving: false };
  w.dirty = () => w.step < 2 && w.items.length;
  w.render = () => renderIncomingWiz(w);
  wizGo();
}
ACT.newIncoming = startIncoming;
function incProductsHtml(w) {
  const q = normAr(w.q);
  const list = S.products.filter(p => p.active !== false && (!q || normAr(p.name).includes(q) || normAr(p.code).includes(q)));
  if (!list.length) return `<div class="empty">لا توجد أصناف</div>`;
  return Object.entries(groupByCategory(list)).map(([cat, ps], i) => {
    const open = q ? true : (w.open[cat] === undefined ? i === 0 : w.open[cat]);
    return `<details class="cat" ${open ? "open" : ""}><summary data-act="vwCat" data-c="${esc(cat)}"><span>${esc(cat)} <span class="tiny">(${ps.length})</span></span></summary>
      <div class="inner"><div class="grid2">${ps.map(p => `<button class="pick ${w.items.some(i => i.code === p.code) ? "on" : ""}" data-act="incAdd" data-code="${esc(p.code)}"><span>${esc(p.name)}</span><small>الرصيد ${fmt(stockOf(p))}</small></button>`).join("")}</div></div></details>`;
  }).join("");
}
function renderIncomingWiz(w) {
  if (w.step === 1) {
    return wizHead("وارد جديد", 1, 2) + `
      <div class="card">
        <div class="field"><label>المورد / مصدر الوارد (اختياري)</label><input type="text" data-in="incSupplier" value="${esc(w.supplier)}" placeholder="مثال: المصنع"></div>
        <div class="field"><label>ملاحظة (اختياري)</label><input type="text" data-in="incNote" value="${esc(w.note)}"></div>
        <div class="field" style="margin-bottom:0"><label>التاريخ</label><input type="date" data-ch="incDate" value="${w.date}"></div>
      </div>
      <div class="field"><input type="search" data-in="incSearch" placeholder="🔎 بحث عن صنف..." value="${esc(w.q)}"></div>
      <div id="incProducts">${incProductsHtml(w)}</div>
      ${w.items.length ? `<div class="sec">الأصناف الواردة (${w.items.length})</div>${w.items.map((it, i) => `<div class="item"><div class="t"><span>${esc(it.name)}</span><span>${qtyLabel(it)}</span></div>
        <div class="row mt"><button class="btn ghost sm" data-act="incAdd" data-code="${esc(it.code)}">تعديل</button><button class="btn danger sm" data-act="incDel" data-i="${i}">حذف</button></div></div>`).join("")}` : ""}
      <div class="sticky"><button class="btn green block" data-act="incSave" ${w.items.length && !w.saving ? "" : "disabled"}>✅ حفظ الوارد</button></div>`;
  }
  const r = w.saved;
  return `<div class="center mb noprint"><div style="font-size:38px">✅</div><b style="color:var(--green)">تم حفظ الوارد ${esc(r.number)}</b></div>${incomingDoc(r)}
    <div class="sticky noprint"><div class="row"><button class="btn line grow" data-act="printNow" data-n="incoming-${esc(r.number)}">🖨️ طباعة / PDF</button><button class="btn grow" data-act="wizCancel">تم</button></div></div>`;
}
INP.incSupplier = v => { S.wiz.supplier = v; }; INP.incNote = v => { S.wiz.note = v; }; CHG.incDate = v => { S.wiz.date = v || todayStr(); };
INP.incSearch = v => { const w = S.wiz; if (!w || w.kind !== "incoming") return; w.q = v; $("#incProducts").innerHTML = incProductsHtml(w); };
ACT.incAdd = d => {
  const w = S.wiz, p = productByCode(d.code), ex = w.items.find(i => i.code === p.code);
  qtySheet({ title: p.name, sub: `الرصيد الحالي ${fmt(stockOf(p))} ${p.unit}`, upc: upcOf(p), allowPack: p.unit === "كرتونة", qty: ex?.qty, packQty: ex?.packQty, okText: ex ? "تحديث" : "إضافة",
    onDone: c => { const it = { code: p.code, name: p.name, category: p.category || "", unit: p.unit, qty: c.qty, packQty: c.packQty, unitsPerCarton: c.packQty ? upcOf(p) : null }; if (ex) Object.assign(ex, it); else w.items.push(it); render(); } });
};
ACT.incDel = d => { S.wiz.items.splice(+d.i, 1); render(); };
ACT.incSave = async () => {
  const w = S.wiz; if (w.saving) return; w.saving = true; render();
  try {
    const number = await nextNumber("incoming");
    const row = { branch_id: S.branchId, number, date: w.date, supplier: w.supplier || null, note: w.note || null, items: w.items, total_qty: w.items.reduce((s, i) => s + num(i.qty), 0), created_by_name: S.me.username };
    const { data, error } = await sb.from("incoming").insert(row).select().single(); if (error) throw error;
    S.incoming.unshift(data); S.ver++; w.saved = data; w.step = 2; w.saving = false;
    logActivity("تسجيل وارد", `${data.number} - ${w.items.map(i => `${i.name} ×${fmt(i.qty)}`).join("، ")}`);
    toast("تم حفظ الوارد"); wizGo();
  } catch (e) { console.error(e); w.saving = false; toast("خطأ أثناء الحفظ: " + (e.message || "")); render(); }
};
function incomingDoc(r) {
  const rows = groupedItemRows(r.items || [], 2, it => `<tr><td class="l">${esc(it.name)}</td><td>${fmt(it.qty)}${it.packQty ? ` <span style="font-size:10px;color:#666">(${fmt(it.packQty)} علبة)</span>` : ""}</td></tr>`);
  return docShell("وارد مخزن", r.number, [["التاريخ", r.date], ["الفرع", branchName(r.branch_id)], r.supplier ? ["المورد", r.supplier] : null, r.note ? ["ملاحظة", r.note] : null],
    `<table><tr><th>الصنف</th><th>الكمية</th></tr>${rows}</table>`, `<div class="tot"><span>إجمالي الكمية</span><span>${fmt(r.total_qty)}</span></div><div class="sign"><div>أمين المخزن</div><div>المورد</div><div>المراجع</div></div>`);
}
