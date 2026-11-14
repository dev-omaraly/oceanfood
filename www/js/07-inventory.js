/* =====================================================================
   07-inventory.js — المخزون، الأصناف، الجرد، استلام مرتجعات المناديب
===================================================================== */
const INV = () => (S.sub.inv = S.sub.inv || { seg: "", cat: "الكل", q: "", stk: "report", counts: {}, note: "" });
const UNITS = ["كرتونة", "علبة", "قطعة", "كجم"];

function invSegs() {
  const s = [];
  if (can("inventory")) s.push(["stock", "📦 الأرصدة"]);
  if (can("stocktake")) s.push(["count", "📋 الجرد"]);
  if (can("receive")) s.push(["recv", "📮 الاستلام"]);
  return s;
}
VIEWS.inventory = function () {
  if (!S.branchId) return `<div class="empty"><div class="big">🏢</div>اختار فرع الأول</div>`;
  const segs = invSegs(); const v = INV();
  if (!segs.find(x => x[0] === v.seg)) v.seg = segs[0]?.[0] || "stock";
  const pend = S.unloads.filter(u => u.status === "pending").length;
  const bar = `<div class="seg">${segs.map(([k, l]) => `<button class="${v.seg === k ? "on" : ""}" data-act="invSeg" data-s="${k}">${l}${k === "recv" && pend ? ` <span class="badge b-bad">${pend}</span>` : ""}</button>`).join("")}</div>`;
  return bar + (v.seg === "stock" ? stockView() : v.seg === "count" ? stocktakeView() : receiveView());
};
ACT.invSeg = d => { INV().seg = d.s; render(); };

/* ============================ الأرصدة ============================ */
function stockRowsHtml() {
  const v = INV(); const q = normAr(v.q);
  const list = S.products.filter(p => (v.cat === "الكل" || (p.category || "بدون تصنيف") === v.cat) && (!q || normAr(p.name).includes(q) || normAr(p.code).includes(q)));
  if (!list.length) return `<div class="empty"><div class="big">📦</div>لا توجد أصناف</div>`;
  return list.map(p => {
    const st = stockOf(p), low = st <= LOW_STOCK;
    return `<div class="item" ${isAdmin() ? `data-act="editProduct" data-code="${esc(p.code)}"` : ""}>
      <div class="row">${p.image_url ? `<img src="${esc(p.image_url)}" style="width:46px;height:46px;border-radius:12px;object-fit:cover" alt="">` : `<div style="width:46px;height:46px;border-radius:12px;background:var(--mint);display:grid;place-items:center;font-size:20px">📦</div>`}
        <div class="grow"><div class="t"><span>${esc(p.name)}</span><span class="badge ${st <= 0 ? "b-bad" : low ? "b-warn" : "b-ok"}">${fmt(st)} ${esc(p.unit)}</span></div>
        <div class="m">${esc(p.code)} · ${esc(p.category || "بدون تصنيف")}${isSuper() ? ` · سعر افتراضي ${fmt(p.base_price)}` : ""}</div></div></div></div>`;
  }).join("");
}
function stockView() {
  const v = INV(); const cats = ["الكل", ...categories()];
  const totalQty = S.products.reduce((s, p) => s + Math.max(0, stockOf(p)), 0);
  return `<div class="stats"><div class="stat"><div class="n">${fmt(S.products.length)}</div><div class="l">عدد الأصناف</div></div><div class="stat green"><div class="n">${fmt(totalQty)}</div><div class="l">إجمالي الكميات بالمخزن</div></div></div>
    <div class="field"><input type="search" data-in="invSearch" placeholder="🔎 بحث بالاسم أو الكود" value="${esc(v.q)}"></div>
    <div class="chips scroll mb">${cats.map(c => `<button class="chip ${v.cat === c ? "on" : ""}" data-act="invCat" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    ${isAdmin() ? `<button class="btn block mb" data-act="editProduct" data-code="">➕ إضافة صنف جديد</button>` : ""}
    <div id="stockList">${stockRowsHtml()}</div>`;
}
INP.invSearch = val => { INV().q = val; $("#stockList").innerHTML = stockRowsHtml(); };
ACT.invCat = d => { INV().cat = d.c; render(); };

/* ---------- نموذج الصنف ---------- */
let _pImg = null;
ACT.editProduct = d => {
  if (!isAdmin()) return;
  const ex = d.code ? productByCode(d.code) : null; _pImg = ex?.image_url || null;
  const opening = ex ? (S.openingRows.find(o => o.product_id === ex.id)?.qty ?? 0) : 0;
  let unit = ex?.unit || "كرتونة";
  const cats = categories();
  openSheet(`<h2>${ex ? "تعديل صنف" : "إضافة صنف جديد"}</h2>
    <div class="field"><label>كود الصنف</label><input type="text" id="pCode" ${ex ? "disabled" : ""} value="${esc(ex?.code || "")}" placeholder="مثال: WF-14" dir="ltr"></div>
    <div class="field"><label>اسم الصنف</label><input type="text" id="pName" value="${esc(ex?.name || "")}"></div>
    <div class="field"><label>التصنيف (Category)</label><input type="text" id="pCat" list="catList" value="${esc(ex?.category || "")}" placeholder="ويفر، فاميلي، ميكس..."><datalist id="catList">${cats.map(c => `<option value="${esc(c)}">`).join("")}</datalist></div>
    <div class="field"><label>الوحدة</label><div class="chips" id="unitChips">${UNITS.map(u => `<button class="chip ${unit === u ? "on" : ""}" data-u="${u}">${u}</button>`).join("")}</div></div>
    <div class="row"><div class="field grow"><label>عدد العلب في الكرتونة</label><input type="number" id="pUpc" min="1" value="${ex?.units_per_carton || 4}"></div>
      <div class="field grow"><label>الرصيد الافتتاحي (${esc(branchName(S.branchId))})</label><input type="number" id="pOpen" value="${opening}"></div></div>
    ${isSuper() ? `<div class="field"><label>السعر الافتراضي للكرتونة (لو التاجر ملوش سعر خاص)</label><input type="number" id="pPrice" value="${ex?.base_price ?? 0}"></div>` : ""}
    <div class="field"><label>صورة (اختياري)</label><input type="file" id="pImgFile" accept="image/*"><div id="pImgPrev" class="mt">${_pImg ? `<img src="${esc(_pImg)}" style="width:80px;height:80px;border-radius:12px;object-fit:cover">` : ""}</div></div>
    <div class="row"><button class="btn ghost grow" id="pCancel">إلغاء</button><button class="btn grow" id="pSave">حفظ</button></div>
    ${ex ? `<button class="btn danger block mt" id="pDel">🗑️ حذف الصنف</button>` : ""}`,
    s => {
      $$("[data-u]", s).forEach(b => b.onclick = () => { unit = b.dataset.u; $$("[data-u]", s).forEach(x => x.classList.toggle("on", x === b)); });
      $("#pImgFile", s).onchange = async e => { const f = e.target.files[0]; if (!f) return; _pImg = await resizeImage(f, 420, .8); $("#pImgPrev", s).innerHTML = `<img src="${_pImg}" style="width:80px;height:80px;border-radius:12px;object-fit:cover">`; };
      $("#pCancel", s).onclick = closeSheet;
      $("#pSave", s).onclick = async () => {
        const code = (ex?.code || $("#pCode", s).value.trim()), name = $("#pName", s).value.trim();
        if (!code || !name) { toast("اكتب الكود والاسم"); return; }
        const row = { code, name, category: $("#pCat", s).value.trim(), unit, units_per_carton: Math.max(1, Math.round(num($("#pUpc", s).value)) || 4), image_url: _pImg };
        if (isSuper()) row.base_price = num($("#pPrice", s).value);
        let prod;
        if (ex) { const { data, error } = await sb.from("products").update(row).eq("id", ex.id).select().single(); if (error) { toast(error.message); return; } prod = data; }
        else { row.sort_no = S.products.length + 1; const { data, error } = await sb.from("products").insert(row).select().single(); if (error) { toast(error.code === "23505" ? "الكود ده موجود بالفعل" : error.message); return; } prod = data; }
        if (S.branchId) { const { error } = await sb.from("opening_stock").upsert({ branch_id: S.branchId, product_id: prod.id, qty: num($("#pOpen", s).value) }); if (error) toast("الصنف اتحفظ لكن الرصيد الافتتاحي: " + error.message); }
        await Promise.all([GLOBAL_TABLES.products(), BRANCH_TABLES.opening_stock()]); S.ver++;
        logActivity(ex ? "تعديل صنف" : "إضافة صنف", `${code} - ${name}`);
        closeSheet(); toast("تم الحفظ"); render();
      };
      const del = $("#pDel", s); if (del) del.onclick = async () => {
        closeSheet();
        if (!(await askDeletePassword(`حذف الصنف ${ex.name}`))) return;
        const { error } = await sb.from("products").delete().eq("id", ex.id); if (error) { toast(error.message); return; }
        await GLOBAL_TABLES.products(); S.ver++; logActivity("حذف صنف", ex.code); toast("تم الحذف"); render();
      };
    });
};

/* ============================ الجرد ============================ */
function stkRows() {
  const v = INV(); const q = normAr(v.q);
  return S.products.filter(p => (v.cat === "الكل" || (p.category || "بدون تصنيف") === v.cat) && (!q || normAr(p.name).includes(q) || normAr(p.code).includes(q)));
}
function stocktakeView() {
  const v = INV(); const cats = ["الكل", ...categories()];
  const subs = [["report", "تقرير الجرد"]]; if (isSuper()) { subs.push(["count", "الجرد الفعلي"], ["log", "السجل"]); }
  if (!subs.find(x => x[0] === v.stk)) v.stk = "report";
  const bar = `<div class="chips mb">${subs.map(([k, l]) => `<button class="chip ${v.stk === k ? "on" : ""}" data-act="stkSub" data-s="${k}">${l}</button>`).join("")}</div>`;
  if (v.stk === "log") return bar + stocktakeLog();
  const filters = `<div class="field"><input type="search" data-in="stkSearch" placeholder="🔎 بحث بالاسم أو الكود" value="${esc(v.q)}"></div>
    <div class="chips scroll mb">${cats.map(c => `<button class="chip ${v.cat === c ? "on" : ""}" data-act="invCat" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
  if (v.stk === "count") return bar + filters + `<div id="stkBody">${stkCountHtml()}</div>
    <div class="field mt"><label>ملاحظة (اختياري)</label><input type="text" data-in="stkNote" value="${esc(v.note)}"></div>
    <button class="btn red block" data-act="stkSave">💾 حفظ الجرد الفعلي</button>`;
  return bar + filters + `<div class="row mb noprint"><button class="btn line grow" data-act="stkPrint">🖨️ طباعة / PDF</button>${can("export") ? `<button class="btn line grow" data-act="stkExport">📊 Excel</button>` : ""}</div>
    <div id="stkBody">${stkReportDoc()}</div>`;
}
ACT.stkSub = d => { INV().stk = d.s; render(); };
INP.stkSearch = val => { const v = INV(); v.q = val; $("#stkBody").innerHTML = v.stk === "count" ? stkCountHtml() : stkReportDoc(); if (v.stk === "count") bindCounts(); };
INP.stkNote = val => { INV().note = val; };
function stkReportDoc() {
  const rows = groupedItemRows(stkRows().map(p => ({ name: p.name, category: p.category || "بدون تصنيف", code: p.code, st: stockOf(p), unit: p.unit })), 2, r => `<tr><td class="l">${esc(r.name)} <span class="tiny">${esc(r.code)}</span></td><td>${fmt(r.st)} ${esc(r.unit)}</td></tr>`);
  return docShell("تقرير جرد المخزون", "", [["التاريخ", todayStr()], ["الفرع", branchName(S.branchId)]], `<table><tr><th>الصنف</th><th>الرصيد بالنظام</th></tr>${rows}</table>`, `<div class="sign"><div>أمين المخزن</div><div>المراجع</div><div>المدير</div></div>`);
}
ACT.stkPrint = () => printDoc("printArea", "stock-report-" + todayStr());
ACT.stkExport = () => {
  const rows = [["الكود", "الصنف", "التصنيف", "الوحدة", "الرصيد بالنظام"]]; stkRows().forEach(p => rows.push([p.code, p.name, p.category || "", p.unit, stockOf(p)]));
  exportWorkbook([{ name: "جرد", rows }], `stocktake-${branchName(S.branchId)}-${todayStr()}`);
};
function diffBadge(d) { return d === 0 ? `<span class="badge b-ok">مطابق</span>` : d < 0 ? `<span class="badge b-bad">عجز ${fmt(-d)}</span>` : `<span class="badge b-warn">زيادة ${fmt(d)}</span>`; }
function stkCountHtml() {
  const v = INV(); const list = stkRows();
  return list.map(p => { const sys = stockOf(p), raw = v.counts[p.code]; const has = raw !== undefined && raw !== "";
    return `<div class="item"><div class="t"><span>${esc(p.name)}</span><span class="tiny">بالنظام: ${fmt(sys)} ${esc(p.unit)}</span></div>
      <div class="row mt"><input type="number" class="cnt" data-code="${esc(p.code)}" placeholder="الكمية الفعلية" value="${has ? esc(raw) : ""}" inputmode="decimal"><span id="d-${esc(p.code)}">${has ? diffBadge(num(raw) - sys) : ""}</span></div></div>`; }).join("") || `<div class="empty">لا توجد أصناف</div>`;
}
function bindCounts() { $$(".cnt").forEach(i => i.oninput = () => { const v = INV(); v.counts[i.dataset.code] = i.value; const p = productByCode(i.dataset.code); const el = document.getElementById("d-" + i.dataset.code); if (el) el.innerHTML = i.value === "" ? "" : diffBadge(num(i.value) - stockOf(p)); }); }
new MutationObserver(() => bindCounts()).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
ACT.stkSave = async () => {
  if (!isSuper()) return; const v = INV(); const items = [];
  S.products.forEach(p => { const raw = v.counts[p.code]; if (raw === undefined || raw === "") return; const actual = num(raw), system = stockOf(p); items.push({ code: p.code, name: p.name, category: p.category || "", unit: p.unit, system, actual, diff: round2(actual - system) }); });
  if (!items.length) { toast("اكتب الكمية الفعلية لصنف واحد على الأقل"); return; }
  if (!(await confirmBox(`حفظ الجرد الفعلي لعدد ${items.length} صنف؟`))) return;
  const number = await nextNumber("stocktake");
  const shortage = items.reduce((s, i) => s + (i.diff < 0 ? -i.diff : 0), 0), surplus = items.reduce((s, i) => s + (i.diff > 0 ? i.diff : 0), 0);
  const { data, error } = await sb.from("stocktakes").insert({ branch_id: S.branchId, number, date: todayStr(), by_name: S.me.username, note: v.note || null, items, shortage, surplus }).select().single();
  if (error) { toast(error.message); return; }
  S.stocktakes.unshift(data); S.ver++; v.counts = {}; v.note = ""; v.stk = "log";
  logActivity("جرد فعلي", `${number} - ${items.length} صنف`); toast("تم حفظ الجرد"); render();
};
function stocktakeLog() {
  if (!S.stocktakes.length) return `<div class="empty"><div class="big">📋</div>لا يوجد جرد محفوظ</div>`;
  return S.stocktakes.map(r => `<div class="item" data-act="openStk" data-id="${r.id}"><div class="t"><span>${esc(r.number)}</span><span class="tiny">${ltr(r.date)}</span></div>
    <div class="m">${(r.items || []).length} صنف · <span style="color:var(--red)">عجز ${fmt(r.shortage)}</span> · <span style="color:var(--amber)">زيادة ${fmt(r.surplus)}</span> · ${esc(r.by_name || "")}</div></div>`).join("");
}
function stkDoc(r) {
  const rows = groupedItemRows(r.items || [], 4, i => `<tr><td class="l">${esc(i.name)}</td><td>${fmt(i.system)}</td><td>${fmt(i.actual)}</td><td style="color:${i.diff < 0 ? "#b00" : i.diff > 0 ? "#a60" : "#070"}">${i.diff > 0 ? "+" : ""}${fmt(i.diff)}</td></tr>`);
  return docShell("جرد فعلي", r.number, [["التاريخ", r.date], ["الفرع", branchName(r.branch_id)], ["بواسطة", r.by_name], r.note ? ["ملاحظة", r.note] : null],
    `<table><tr><th>الصنف</th><th>النظام</th><th>الفعلي</th><th>الفرق</th></tr>${rows}</table>`, `<div class="tot"><span>عجز: ${fmt(r.shortage)}</span><span>زيادة: ${fmt(r.surplus)}</span></div>`);
}
ACT.openStk = d => { const r = S.stocktakes.find(x => x.id === d.id); if (r) openViewer(stkDoc(r) + `<div class="sticky noprint"><div class="row"><button class="btn line grow" data-act="printNow" data-n="stocktake-${esc(r.number)}">🖨️ طباعة / PDF</button>
  <button class="btn danger" data-act="delStk" data-id="${r.id}">🗑️ حذف</button></div></div>`); };
ACT.delStk = d => deleteRow("stocktakes", d.id, "stocktakes", "جرد");

/* ============================ استلام مرتجعات المناديب ============================ */
function aggregateReturns(deliveries) {
  const m = {};
  deliveries.forEach(d => (d.lines || []).forEach(l => {
    if (!(l.returnQty > 0)) return;
    const q = l.packMode ? l.returnQty / l.upc : l.returnQty;
    const a = m[l.code] || (m[l.code] = { code: l.code, name: l.name, unit: l.unit, price: l.price || 0, qty: 0, packMode: false, upc: l.upc, reasons: {} });
    a.qty += q; if (l.packMode) a.packMode = true; if (l.reason) a.reasons[l.reason] = 1;
  }));
  return Object.values(m).map(a => { const qty = round3(a.qty); return { code: a.code, name: a.name, unit: a.unit, price: a.price, qty, packQty: a.packMode ? Math.round(qty * a.upc) : null, unitsPerCarton: a.packMode ? a.upc : null, reason: Object.keys(a.reasons).join("، ") }; });
}
const lineUnit = l => l.packMode ? "علبة" : (l.unit || "");
function receiveView() {
  const pend = S.unloads.filter(u => u.status === "pending");
  const done = S.unloads.filter(u => u.status === "received").slice(0, 8);
  const held = {}; S.deliveries.filter(d => d.ret_status === "held").forEach(d => { (held[d.rep_name] = held[d.rep_name] || []).push(d); });
  const dels = S.deliveries.slice(0, 25);
  const stTxt = { none: "تم التسليم", held: "مرتجع مع المندوب", unloaded: "تم التفريغ", received: "تم الاستلام بالمخزن" };
  return `<div class="sec" style="margin-top:0">📮 بانتظار الاستلام</div>
    ${pend.map(u => `<div class="item"><div class="t"><span>${esc(u.rep_name)}</span><span class="tiny">${fmtTime(u.created_at)}</span></div>
      ${(u.items || []).map(i => `<div class="m">• ${esc(i.name)}: <b>${qtyLabel(i)}</b></div>`).join("")}
      <div class="m">أذون: ${esc((u.voucher_numbers || []).join("، "))}</div>
      <button class="btn green sm mt" data-act="recvConfirm" data-id="${u.id}">✅ تأكيد الاستلام وإضافة للمخزون</button></div>`).join("") || `<div class="muted">لا يوجد تفريغ بانتظار الاستلام</div>`}
    <div class="sec">🚚 مرتجع لسه مع المناديب</div>
    ${Object.keys(held).map(r => `<div class="item"><div class="t"><span>${esc(r)}</span></div>${aggregateReturns(held[r]).map(i => `<div class="m">• ${esc(i.name)}: ${qtyLabel(i)}</div>`).join("")}</div>`).join("") || `<div class="muted">لا يوجد</div>`}
    <div class="sec">📋 سجل تسليمات المناديب</div>
    ${dels.map(d => `<div class="item"><div class="t"><span>إذن #${esc(d.voucher_number)}</span><span class="badge ${d.ret_status === "none" || d.ret_status === "received" ? "b-ok" : "b-warn"}">${stTxt[d.ret_status] || ""}</span></div>
      <div class="m">${esc(d.rep_name || "")} ← ${esc(d.merchant_label || "")} · ${ltr(d.date)}</div>
      ${(d.lines || []).map(l => `<div class="m">${esc(l.name)}: ✅ ${fmt(l.delivered)}${l.returnQty > 0 ? ` · ↩️ ${fmt(l.returnQty)} (${esc(l.reason || "")})` : ""} ${esc(lineUnit(l))}</div>`).join("")}</div>`).join("") || `<div class="muted">لا توجد تسليمات بعد</div>`}
    ${done.length ? `<div class="sec">✔️ آخر تفريغات اتستلمت</div>${done.map(u => `<div class="item"><div class="t"><span>${esc(u.rep_name)}</span><span class="tiny">${fmtTime(u.received_at)}</span></div><div class="m">مرتجع ${esc(u.return_number || "")} · استلمه ${esc(u.received_by || "")}</div></div>`).join("")}` : ""}`;
}
ACT.recvConfirm = async d => {
  if (!can("receive")) { toast("ليس لديك صلاحية"); return; }
  const u = S.unloads.find(x => x.id === d.id); if (!u || u.status !== "pending") return;
  if (!(await confirmBox("تأكيد استلام المرتجع وإضافته للمخزون؟\n" + u.items.map(i => `${i.name}: ${qtyLabel(i)}`).join("\n")))) return;
  const number = await nextNumber("return");
  const items = u.items.map(i => ({ code: i.code, name: i.name, unit: i.unit, price: i.price || 0, qty: i.qty, reason: i.reason || "مرتجع مندوب", packQty: i.packQty || null, unitsPerCarton: i.unitsPerCarton || null }));
  const { error } = await sb.from("returns").insert({ branch_id: u.branch_id, number, date: todayStr(), rep_name: u.rep_name, merchant_label: "مرتجع مندوب (تفريغ)", voucher_number: (u.voucher_numbers || []).join("، "), items, qty: items.reduce((s, i) => s + num(i.qty), 0), unload_id: u.id, created_by_name: S.me.username });
  if (error) { toast(error.message); return; }
  await sb.from("unloads").update({ status: "received", received_by: S.me.username, received_at: new Date().toISOString(), return_number: number }).eq("id", u.id);
  if ((u.delivery_ids || []).length) await sb.from("rep_deliveries").update({ ret_status: "received" }).in("id", u.delivery_ids);
  logActivity("استلام مرتجع مندوب", `${u.rep_name} - ${number}`);
  await Promise.all([BRANCH_TABLES.returns(), BRANCH_TABLES.unloads(), BRANCH_TABLES.rep_deliveries()]); S.ver++;
  toast("تم الاستلام وإضافة المرتجع للمخزون"); render();
};
