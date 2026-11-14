/* =====================================================================
   04-voucher.js — إذن الصرف + أدوات مشتركة (نافذة الكمية، المستند المطبوع)
===================================================================== */
const round3 = n => Math.round(n * 1000) / 1000;

/* ---------- أدوات الـ wizard المشتركة ---------- */
function wizHead(title, step, total) {
  return `<div class="between mb noprint"><div><div class="pagetitle" style="margin:0">${title}</div><div class="tiny">خطوة ${step} من ${total}</div></div>
    <button class="btn ghost sm" data-act="wizCancel">✕ إغلاق</button></div>
    <div class="bar-track mb noprint"><div class="bar-fill" style="width:${step / total * 100}%"></div></div>`;
}
function wizGo() { render(); window.scrollTo(0, 0); }
ACT.wizCancel = async () => {
  const w = S.wiz;
  if (w && w.dirty && w.dirty() && !(await confirmBox("لو خرجت دلوقتي هتضيع البيانات اللي كتبتها. متأكد؟", "خروج", true))) return;
  S.wiz = null; if (S.dirty) { S.dirty = false; } render(); window.scrollTo(0, 0);
};
function openViewer(html) {
  S.wiz = { kind: "viewer", render: () => `<div class="between mb noprint"><button class="btn ghost sm" data-act="wizCancel">‹ رجوع</button></div>${html}` };
  wizGo();
}

/* ---------- نافذة الكمية (مشتركة: صرف / مرتجع / وارد) ---------- */
function qtySheet(o) {
  const upc = o.upc || 4;
  const c = { mode: o.packQty ? "pack" : "carton", qty: o.qty || 1, packQty: o.packQty || null, disc: o.discountPct || 0, reason: o.reason || (o.reasons ? o.reasons[0] : "") };
  if (c.mode === "pack" && !c.packQty) c.packQty = Math.round(c.qty * upc);
  const setPack = p => { c.packQty = Math.max(1, Math.round(p)); c.qty = round3(c.packQty / upc); };
  const draw = () => {
    const total = o.price != null ? c.qty * o.price * (1 - c.disc / 100) : null;
    openSheet(`<h2>${esc(o.title)}</h2>
      <div class="muted mb">${esc(o.sub || "")}</div>
      ${o.allowPack ? `<div class="sec" style="margin-top:0">وحدة الإدخال</div>
        <div class="chips mb"><button class="chip ${c.mode === "carton" ? "on" : ""}" id="mCarton">بالكرتونة</button><button class="chip ${c.mode === "pack" ? "on" : ""}" id="mPack">بالعلب (${upc} علبة/كرتونة)</button></div>` : ""}
      <div class="sec" style="margin-top:0">الكمية ${c.mode === "pack" ? "(بالعلب)" : ""}</div>
      <div class="stepper mb"><button id="qMinus">−</button><input type="number" id="qVal" min="1" inputmode="numeric" value="${c.mode === "pack" ? c.packQty : c.qty}"><button id="qPlus">+</button></div>
      ${c.mode === "pack" ? `<div class="muted center mb">= ${fmt(c.qty)} كرتونة</div>` : ""}
      ${o.stock != null && c.qty > o.stock ? `<div class="badge b-warn mb">تنبيه: الكمية أكبر من المتاح بالمخزون (${fmt(o.stock)})</div>` : ""}
      ${o.discount ? `<div class="sec">نسبة الخصم <span class="tiny">(أعلى من ${maxDiscount()}% محتاج موافقة أدمن)</span></div>
        <div class="chips mb">${[0, 5, 10, 15, 20, 25].map(d => `<button class="chip ${c.disc === d ? "on" : ""}" data-d="${d}">${d}%</button>`).join("")}</div>
        <div class="field"><label>خصم مخصص (%)</label><input type="number" id="dCustom" min="0" max="100" value="${c.disc}"></div>` : ""}
      ${o.reasons ? `<div class="sec">السبب</div><div class="chips mb">${o.reasons.map(r => `<button class="chip ${c.reason === r ? "on" : ""}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
        ${c.reason === "أخرى" ? `<div class="field"><input type="text" id="rOther" placeholder="اكتب السبب" value="${esc(c.other || "")}"></div>` : ""}` : ""}
      ${total != null ? `<div class="between mb" style="font-weight:800;font-size:16px"><span>الإجمالي</span><span>${fmt(total)}</span></div>` : ""}
      <div class="row"><button class="btn ghost grow" id="qCancel">إلغاء</button><button class="btn grow" id="qOk">${esc(o.okText || "إضافة")}</button></div>
      ${o.onRemove ? `<button class="btn danger block mt" id="qDel">🗑️ شيل الصنف</button>` : ""}`,
      s => {
        const rd = () => { const v = Math.round(num($("#qVal", s).value)); return v < 1 ? 1 : v; };
        const setV = v => { if (c.mode === "pack") setPack(v); else { c.qty = Math.max(1, v); c.packQty = null; } };
        if (o.allowPack) {
          $("#mCarton", s).onclick = () => { c.mode = "carton"; c.qty = Math.max(1, Math.round(c.qty)); c.packQty = null; draw(); };
          $("#mPack", s).onclick = () => { c.mode = "pack"; setPack(Math.round(c.qty * upc) || upc); draw(); };
        }
        $("#qMinus", s).onclick = () => { setV(rd() - 1); draw(); };
        $("#qPlus", s).onclick = () => { setV(rd() + 1); draw(); };
        $("#qVal", s).onchange = () => { setV(rd()); draw(); };
        $$("[data-d]", s).forEach(b => b.onclick = () => { setV(rd()); c.disc = Number(b.dataset.d); draw(); });
        const dc = $("#dCustom", s); if (dc) dc.onchange = () => { setV(rd()); c.disc = Math.min(100, Math.max(0, num(dc.value))); draw(); };
        $$("[data-r]", s).forEach(b => b.onclick = () => { setV(rd()); c.reason = b.dataset.r; draw(); });
        const ro = $("#rOther", s); if (ro) ro.oninput = () => { c.other = ro.value; };
        $("#qCancel", s).onclick = closeSheet;
        const qd = $("#qDel", s); if (qd) qd.onclick = () => { closeSheet(); o.onRemove(); };
        $("#qOk", s).onclick = async () => {
          setV(rd());
          if (o.discount && !(await approveHighDiscount(c.disc))) return;
          closeSheet();
          o.onDone({ qty: c.qty, packQty: c.mode === "pack" ? c.packQty : null, discountPct: c.disc / 100, reason: c.reason === "أخرى" ? (c.other || "أخرى") : c.reason });
        };
      });
  };
  draw();
}

/* ---------- المستند المطبوع ---------- */
function docShell(title, no, metaPairs, body, extra) {
  const meta = metaPairs.filter(Boolean).map(([k, v]) => `<div><b>${esc(k)}:</b> ${/^[\d\-\/.: ]+$/.test(String(v)) ? ltr(v) : esc(v)}</div>`).join("");
  return `<div class="doc" id="printArea">
    <div class="dh"><img src="${esc(logoUrl())}" alt="">
      <div class="co"><b style="font-size:14px">${esc(appName())}</b><br>سجل تجاري: ${ltr(setting("commercial_register", ""))}<br>بطاقة ضريبية: ${ltr(setting("tax_card", ""))}</div></div>
    <h2>${esc(title)}${no ? " رقم " + esc(no) : ""}</h2>
    <div class="meta">${meta}</div>${body}${extra || ""}
    <div class="foot">تمت الطباعة: ${new Date().toLocaleString("ar-EG")}</div></div>`;
}
function groupedItemRows(items, cols, rowFn) {
  const g = {}; items.forEach(it => { const c = it.category || productByCode(it.code)?.category || "أخرى"; (g[c] = g[c] || []).push(it); });
  return Object.entries(g).map(([c, list]) => `<tr><td colspan="${cols}" style="background:#f1f7f6;font-weight:800;text-align:right">${esc(c)}</td></tr>${list.map(rowFn).join("")}`).join("");
}
function voucherDoc(v) {
  const rows = groupedItemRows(v.items || [], 5, it => `<tr><td class="l">${esc(it.name)}</td><td>${fmt(it.qty)}${it.packQty ? ` <span style="font-size:10px;color:#666">(${fmt(it.packQty)} علبة)</span>` : ""}</td><td>${fmt(it.price)}</td><td>${(num(it.discountPct) * 100).toFixed(0)}%</td><td>${fmt(lineTotal(it))}</td></tr>`);
  const disc = (v.items || []).reduce((s, it) => s + num(it.qty) * num(it.price) * num(it.discountPct), 0);
  return docShell("إذن صرف", v.number, [
    ["التاريخ", v.date], ["الفرع", branchName(v.branch_id)], ["المندوب", v.rep_name], ["التاجر", v.merchant_label],
    v.supervisor_name ? ["المشرف المتعاقد", v.supervisor_name] : null
  ], `<table><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الإجمالي</th></tr>${rows}</table>`,
    `${disc > 0 ? `<div class="tot" style="font-weight:600;font-size:12.5px"><span>إجمالي الخصم</span><span>${fmt(disc)}</span></div>` : ""}
     <div class="tot"><span>الإجمالي</span><span>${fmt(v.total)}</span></div>
     <div class="sign"><div>المستلم</div><div>المندوب</div><div>أمين المخزن</div></div>`);
}

/* ---------- إذن الصرف: wizard ---------- */
function startVoucher() {
  if (!S.branchId) { toast("اختار الفرع الأول"); return; }
  if (!can("voucher")) { toast("ليس لديك صلاحية"); return; }
  const w = S.wiz = { kind: "voucher", step: 1, rep: null, store: null, sbr: null, sup: "", items: [], date: todayStr(), q: "", open: {}, saved: null, saving: false };
  w.dirty = () => w.step < 5 && (w.rep || w.items.length);
  w.render = () => renderVoucherWiz(w);
  wizGo();
}
ACT.newVoucher = startVoucher;

function renderVoucherWiz(w) {
  if (w.step === 1) {
    return wizHead("اختار المندوب", 1, 4) + `
      <div class="grid2">${S.reps.map(r => `<button class="pick ${w.rep?.id === r.id ? "on" : ""}" data-act="vwRep" data-id="${r.id}">👤 ${esc(r.name)}</button>`).join("")}</div>
      ${!S.reps.length ? `<div class="empty"><div class="big">👤</div>مفيش مناديب في الفرع ده</div>` : ""}
      ${isAdmin() ? `<button class="btn line block mt" data-act="addRepQuick">➕ إضافة مندوب جديد</button>` : ""}`;
  }
  if (w.step === 2) {
    const brs = w.store ? S.storeBranches.filter(b => b.store_id === w.store.id) : [];
    const sups = w.store ? S.supervisors.filter(s => s.store_id === w.store.id || !s.store_id) : [];
    const ready = w.store && (w.sbr || !brs.length);
    return wizHead("التاجر والمشرف", 2, 4) + `
      <div class="muted mb">المندوب: <b>${esc(w.rep.name)}</b></div>
      <div class="sec" style="margin-top:0">🏪 المتجر</div>
      <div class="grid2">${S.stores.map(s => `<button class="pick ${w.store?.id === s.id ? "on" : ""}" data-act="vwStore" data-id="${s.id}">${esc(s.name)}</button>`).join("")}</div>
      <button class="btn line block mt" data-act="addStoreQuick">➕ متجر جديد</button>
      ${w.store ? `
        <div class="sec">📍 فرع المتجر</div>
        <div class="chips">${brs.map(b => `<button class="chip ${w.sbr?.id === b.id ? "on" : ""}" data-act="vwSbr" data-id="${b.id}">${esc(b.name)}</button>`).join("")}
          <button class="chip" data-act="addSbrQuick">➕ فرع</button></div>
        <div class="sec">👷 المشرف المتعاقد</div>
        <div class="chips">
          <button class="chip ${!w.sup ? "on" : ""}" data-act="vwSup" data-n="">بدون</button>
          ${sups.map(s => `<button class="chip ${w.sup === s.name ? "on" : ""}" data-act="vwSup" data-n="${esc(s.name)}">${esc(s.name)}</button>`).join("")}
          <button class="chip" data-act="addSupQuick">➕ مشرف</button></div>` : ""}
      <div class="sticky"><div class="row"><button class="btn ghost" data-act="vwBack">‹ رجوع</button><button class="btn grow" data-act="vwNext" ${ready ? "" : "disabled"}>التالي ›</button></div></div>`;
  }
  if (w.step === 3) {
    return wizHead("أضف الأصناف", 3, 4) + `
      <div class="muted mb">${esc(w.rep.name)} ← ${esc(merchantLabelOf(w))}${w.sup ? ` · 👷 ${esc(w.sup)}` : ""}</div>
      <div class="field"><input type="search" id="vwQ" data-in="vwSearch" placeholder="🔎 بحث عن صنف..." value="${esc(w.q)}"></div>
      <div id="vwProducts">${voucherProductsHtml(w)}</div>
      <div id="vwCart">${voucherCartHtml(w)}</div>
      <div class="sticky"><div class="row"><button class="btn ghost" data-act="vwBack">‹ رجوع</button><button class="btn grow" data-act="vwNext" ${w.items.length ? "" : "disabled"}>مراجعة الإذن ›</button></div></div>`;
  }
  if (w.step === 4) {
    const total = itemsTotal(w.items);
    return wizHead("مراجعة وحفظ", 4, 4) + `
      <div class="card">
        <div class="between"><span class="muted">الفرع</span><b>${esc(branchName(S.branchId))}</b></div>
        <div class="between"><span class="muted">المندوب</span><b>${esc(w.rep.name)}</b></div>
        <div class="between"><span class="muted">التاجر</span><b>${esc(merchantLabelOf(w))}</b></div>
        <div class="between"><span class="muted">المشرف المتعاقد</span><b>${esc(w.sup || "—")}</b></div>
        <div class="field mt" style="margin-bottom:0"><label>تاريخ الإذن</label><input type="date" id="vwDate" data-ch="vwDate" value="${w.date}"></div>
      </div>
      ${voucherCartHtml(w, true)}
      <div class="card between" style="font-size:17px;font-weight:800"><span>الإجمالي الكلي</span><span>${fmt(total)}</span></div>
      <div class="sticky"><div class="row"><button class="btn ghost" data-act="vwBack">‹ تعديل</button><button class="btn red grow" data-act="vwSave" ${w.saving ? "disabled" : ""}>✅ حفظ الإذن</button></div></div>`;
  }
  const v = w.saved;
  return `<div class="center mb noprint"><div style="font-size:38px">✅</div><b style="color:var(--green)">تم حفظ إذن الصرف #${esc(v.number)}</b></div>
    ${voucherDoc(v)}
    <div class="sticky noprint"><div class="row"><button class="btn line grow" data-act="printNow" data-n="voucher-${esc(v.number)}">🖨️ طباعة / PDF</button><button class="btn grow" data-act="wizCancel">تم</button></div></div>`;
}
const merchantLabelOf = w => w.store ? (w.sbr ? `${w.store.name} - ${w.sbr.name}` : w.store.name) : "";

function voucherProductsHtml(w) {
  const q = normAr(w.q);
  const list = S.products.filter(p => p.active !== false && (!q || normAr(p.name).includes(q) || normAr(p.code).includes(q)));
  if (!list.length) return `<div class="empty">لا توجد أصناف</div>`;
  const g = groupByCategory(list);
  return Object.entries(g).map(([cat, ps], i) => {
    const open = q ? true : (w.open[cat] === undefined ? i === 0 : w.open[cat]);
    const inCart = ps.filter(p => w.items.some(it => it.code === p.code)).length;
    return `<details class="cat" ${open ? "open" : ""}><summary data-act="vwCat" data-c="${esc(cat)}"><span>${esc(cat)} <span class="tiny">(${ps.length})</span></span>${inCart ? `<span class="badge b-ok">${inCart} في الإذن</span>` : ""}</summary>
      <div class="inner"><div class="grid2">${ps.map(p => {
      const pr = priceFor(w.store.id, p), st = stockOf(p), inC = w.items.some(it => it.code === p.code);
      return `<button class="pick ${inC ? "on" : ""}" data-act="vwAdd" data-code="${esc(p.code)}">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : ""}<span>${esc(p.name)}</span>
          <small>${fmt(pr.price)} ج${pr.custom ? "" : ` · <b style="color:var(--red)">سعر افتراضي</b>`} · متاح <b style="color:${st <= LOW_STOCK ? "var(--red)" : "inherit"}">${fmt(st)}</b></small></button>`;
    }).join("")}</div></div></details>`;
  }).join("");
}
function voucherCartHtml(w, review) {
  if (!w.items.length) return `<div class="empty"><div class="big">🛒</div>لم تُضف أصناف بعد</div>`;
  const g = {}; w.items.forEach((it, i) => { const c = it.category || "أخرى"; (g[c] = g[c] || []).push([it, i]); });
  return `<div class="sec">أصناف الإذن (${w.items.length})</div>` + Object.entries(g).map(([c, list]) => `
    <div class="tiny" style="margin:4px 4px">${esc(c)}</div>
    ${list.map(([it, i]) => `<div class="item"><div class="t"><span>${esc(it.name)} × ${fmt(it.qty)}${it.packQty ? ` <span class="tiny">(${fmt(it.packQty)} علبة)</span>` : ""}</span><span style="color:var(--brand2)">${fmt(lineTotal(it))}</span></div>
      <div class="between"><div class="m">سعر ${fmt(it.price)} · خصم ${(num(it.discountPct) * 100).toFixed(0)}%</div>
      <div class="row"><button class="btn ghost sm" data-act="vwEdit" data-i="${i}">تعديل</button><button class="btn danger sm" data-act="vwDel" data-i="${i}">حذف</button></div></div></div>`).join("")}`).join("");
}

INP.vwSearch = v => { const w = S.wiz; if (!w || w.kind !== "voucher") return; w.q = v; $("#vwProducts").innerHTML = voucherProductsHtml(w); };
CHG.vwDate = v => { if (S.wiz) S.wiz.date = v || todayStr(); };
ACT.vwCat = (d, el) => { const w = S.wiz; const det = el.parentElement; const cur = det.hasAttribute("open"); w.open[d.c] = !cur; det.toggleAttribute("open", !cur); };
ACT.vwRep = d => { const w = S.wiz; w.rep = S.reps.find(r => r.id === d.id); w.step = 2; wizGo(); };
ACT.vwStore = d => { const w = S.wiz; const s = S.stores.find(x => x.id === d.id); if (w.store?.id !== s.id) { w.store = s; w.sbr = null; w.sup = ""; w.items = []; } render(); };
ACT.vwSbr = d => { const w = S.wiz; w.sbr = S.storeBranches.find(b => b.id === d.id); render(); };
ACT.vwSup = d => { S.wiz.sup = d.n; render(); };
ACT.vwBack = () => { const w = S.wiz; w.step = Math.max(1, w.step - 1); wizGo(); };
ACT.vwNext = () => { const w = S.wiz; w.step = Math.min(4, w.step + 1); wizGo(); };
ACT.vwAdd = d => {
  const w = S.wiz; const p = productByCode(d.code); const pr = priceFor(w.store.id, p);
  const ex = w.items.find(it => it.code === p.code);
  qtySheet({
    title: p.name, sub: `السعر ${fmt(pr.price)} · متاح ${fmt(stockOf(p))} ${p.unit}`, price: pr.price, stock: stockOf(p), upc: upcOf(p), allowPack: p.unit === "كرتونة",
    discount: true, qty: ex?.qty, packQty: ex?.packQty, discountPct: ex ? num(ex.discountPct) * 100 : 0, okText: ex ? "تحديث" : "إضافة للإذن",
    onDone: c => {
      const it = { code: p.code, name: p.name, category: p.category || "", unit: p.unit, price: pr.price, qty: c.qty, discountPct: c.discountPct, packQty: c.packQty, unitsPerCarton: c.packQty ? upcOf(p) : null };
      if (ex) Object.assign(ex, it); else w.items.push(it);
      render();
    }
  });
};
ACT.vwEdit = d => { const w = S.wiz; const it = w.items[+d.i]; ACT.vwAdd({ code: it.code }); };
ACT.vwDel = d => { S.wiz.items.splice(+d.i, 1); render(); };

ACT.vwSave = async () => {
  const w = S.wiz; if (w.saving) return; w.saving = true; render();
  try {
    const number = await nextNumber("voucher");
    const row = {
      branch_id: S.branchId, number, date: w.date, rep_id: w.rep.id, rep_name: w.rep.name,
      store_id: w.store.id, store_branch_id: w.sbr?.id || null, merchant_label: merchantLabelOf(w), supervisor_name: w.sup || null,
      items: w.items, total: itemsTotal(w.items), created_by: S.me.id, created_by_name: S.me.username
    };
    const { data, error } = await sb.from("vouchers").insert(row).select().single();
    if (error) throw error;
    S.vouchers.unshift(data); S.ver++;
    w.saved = data; w.step = 5; w.saving = false;
    logActivity("إذن صرف جديد", `#${data.number} - ${data.rep_name} ← ${data.merchant_label} - ${fmt(data.total)}`);
    toast("تم حفظ إذن الصرف"); wizGo();
  } catch (e) { console.error(e); w.saving = false; toast("حصل خطأ أثناء الحفظ: " + (e.message || "")); render(); }
};
ACT.printNow = d => printDoc("printArea", d.n || "document");

/* ---------- إضافات سريعة (مندوب / متجر / فرع متجر / مشرف) ---------- */
async function quickInsert(table, row, reloadKey) {
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) { toast(error.code === "23505" ? "الاسم ده موجود بالفعل" : (error.message || "تعذر الحفظ")); return null; }
  await (GLOBAL_TABLES[reloadKey] || BRANCH_TABLES[reloadKey])(); S.ver++;
  return data;
}
ACT.addRepQuick = async () => {
  const n = await askText("مندوب جديد", { label: "اسم المندوب" }); if (!n?.trim()) return;
  if (await quickInsert("reps", { branch_id: S.branchId, name: n.trim() }, "reps")) { toast("تمت الإضافة"); render(); }
};
ACT.addStoreQuick = async () => {
  const n = await askText("متجر جديد", { label: "اسم المتجر (مثال: سعودي)" }); if (!n?.trim()) return;
  const s = await quickInsert("stores", { name: n.trim() }, "stores"); if (s) { S.wiz.store = s; S.wiz.sbr = null; toast("تمت الإضافة — الأسعار الافتراضية لحد ما الإدارة تحدد أسعاره"); render(); }
};
ACT.addSbrQuick = async () => {
  const n = await askText("فرع جديد للمتجر", { label: "اسم الفرع (مثال: فرع الجيزة)" }); if (!n?.trim()) return;
  const b = await quickInsert("store_branches", { store_id: S.wiz.store.id, name: n.trim() }, "store_branches"); if (b) { S.wiz.sbr = b; render(); }
};
ACT.addSupQuick = async () => {
  const n = await askText("مشرف متعاقد جديد", { label: "اسم المشرف المتعاقد" }); if (!n?.trim()) return;
  const s = await quickInsert("supervisors", { store_id: S.wiz.store.id, name: n.trim() }, "supervisors"); if (s) { S.wiz.sup = s.name; render(); }
};
