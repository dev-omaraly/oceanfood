/* =====================================================================
   06-history.js — السجل: أذون / مرتجعات / وارد
===================================================================== */
const H = () => (S.sub.hist = S.sub.hist || { seg: "v", from: "", to: "", q: "" });

function histList() {
  const h = H(); const src = h.seg === "v" ? S.vouchers : h.seg === "r" ? S.returns : S.incoming;
  let l = src.filter(x => (!h.from || x.date >= h.from) && (!h.to || x.date <= h.to));
  const q = normAr(h.q);
  if (q) l = l.filter(x => normAr([x.number, x.rep_name, x.merchant_label, x.supervisor_name, x.supplier, x.voucher_number].join(" ")).includes(q));
  return l;
}
function histRows(l) {
  const h = H();
  if (!l.length) return `<div class="empty"><div class="big">🗂️</div>لا توجد نتائج</div>`;
  return l.slice(0, 120).map(x => {
    const items = (x.items || []).map(i => `${i.name} ×${fmt(i.qty)}`).join("، ");
    if (h.seg === "v") return `<div class="item" data-act="openVoucher" data-id="${x.id}"><div class="t"><span>إذن #${esc(x.number)}</span><span style="color:var(--brand2)">${fmt(x.total)}</span></div>
      <div class="m">${esc(x.rep_name || "")} ← ${esc(x.merchant_label || "")} · ${ltr(x.date)}</div>${x.supervisor_name ? `<div class="m">👷 ${esc(x.supervisor_name)}</div>` : ""}<div class="m">${esc(items)}</div></div>`;
    if (h.seg === "r") return `<div class="item" data-act="openReturn" data-id="${x.id}"><div class="t"><span>مرتجع ${esc(x.number)}</span><span>${fmt(x.qty)}</span></div>
      <div class="m">${esc(x.rep_name || "")} · ${ltr(x.date)}${x.voucher_number ? ` · من إذن #${esc(x.voucher_number)}` : ""}</div><div class="m">🏪 ${esc(x.merchant_label || "-")}</div><div class="m">${esc(items)}</div></div>`;
    return `<div class="item" data-act="openIncoming" data-id="${x.id}"><div class="t"><span>وارد ${esc(x.number)}</span><span>${fmt(x.total_qty)}</span></div>
      <div class="m">${ltr(x.date)}${x.supplier ? " · " + esc(x.supplier) : ""}</div><div class="m">${esc(items)}</div></div>`;
  }).join("") + (l.length > 120 ? `<div class="tiny center">عرض أول 120 نتيجة من ${l.length} — استخدم البحث أو الفلتر</div>` : "");
}
VIEWS.history = function () {
  if (!S.branchId && !isSuper()) return `<div class="empty">لا يوجد فرع</div>`;
  const h = H(); const l = histList();
  return `<div class="seg"><button class="${h.seg === "v" ? "on" : ""}" data-act="hseg" data-s="v">🧾 أذون الصرف</button><button class="${h.seg === "r" ? "on" : ""}" data-act="hseg" data-s="r">↩️ المرتجعات</button><button class="${h.seg === "i" ? "on" : ""}" data-act="hseg" data-s="i">📥 الوارد</button></div>
    <div class="card">
      <div class="between mb"><button class="btn ghost sm" data-act="hday" data-d="-1">‹ اليوم السابق</button><b style="font-size:13px">${h.from && h.from === h.to ? h.from : "فترة / الكل"}</b><button class="btn ghost sm" data-act="hday" data-d="1">اليوم التالي ›</button></div>
      <div class="row"><div class="field grow" style="margin:0"><label>من</label><input type="date" data-ch="hFrom" value="${h.from}"></div><div class="field grow" style="margin:0"><label>إلى</label><input type="date" data-ch="hTo" value="${h.to}"></div></div>
      ${(h.from || h.to) ? `<button class="btn line sm block mt" data-act="hclear">✖ مسح الفلتر</button>` : ""}
    </div>
    <div class="field"><input type="search" data-in="hSearch" placeholder="🔎 بحث (رقم، مندوب، تاجر، مشرف)" value="${esc(h.q)}"></div>
    ${can("export") ? `<button class="btn line block mb" data-act="hexport">📊 تصدير Excel (${l.length})</button>` : ""}
    <div id="histList">${histRows(l)}</div>`;
};
ACT.hseg = d => { H().seg = d.s; render(); };
ACT.hclear = () => { const h = H(); h.from = h.to = ""; render(); };
ACT.hday = d => { const h = H(); const base = h.from || todayStr(); const dt = new Date(base + "T00:00:00"); dt.setDate(dt.getDate() + Number(d.d)); h.from = h.to = dateStr(dt); render(); };
CHG.hFrom = v => { H().from = v; render(); }; CHG.hTo = v => { H().to = v; render(); };
INP.hSearch = v => { H().q = v; $("#histList").innerHTML = histRows(histList()); };

/* ---------- عرض / طباعة / حذف ---------- */
function viewerButtons(name, delAct, id) {
  return `<div class="sticky noprint"><div class="row"><button class="btn line grow" data-act="printNow" data-n="${esc(name)}">🖨️ طباعة / PDF</button>
    ${isAdmin() ? `<button class="btn danger" data-act="${delAct}" data-id="${id}">🗑️ حذف</button>` : ""}</div></div>`;
}
ACT.openVoucher = d => { const v = S.vouchers.find(x => x.id === d.id); if (v) openViewer(voucherDoc(v) + viewerButtons("voucher-" + v.number, "delVoucher", v.id)); };
ACT.openReturn = d => { const v = S.returns.find(x => x.id === d.id); if (v) openViewer(returnDoc(v) + viewerButtons("return-" + v.number, "delReturn", v.id)); };
ACT.openIncoming = d => { const v = S.incoming.find(x => x.id === d.id); if (v) openViewer(incomingDoc(v) + viewerButtons("incoming-" + v.number, "delIncoming", v.id)); };

async function deleteRow(table, id, key, label) {
  if (!isAdmin()) return;
  if (!(await askDeletePassword(label))) return;
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) { toast("تعذر الحذف: " + error.message); return; }
  S[key] = S[key].filter(x => x.id !== id); S.ver++;
  if (table === "vouchers") { S.deliveries = S.deliveries.filter(x => x.voucher_id !== id); }
  logActivity("حذف " + label, "");
  toast("تم الحذف"); S.wiz = null; render();
}
ACT.delVoucher = d => deleteRow("vouchers", d.id, "vouchers", "إذن صرف");
ACT.delReturn = d => deleteRow("returns", d.id, "returns", "مرتجع");
ACT.delIncoming = d => deleteRow("incoming", d.id, "incoming", "وارد");

/* ---------- تصدير Excel ---------- */
ACT.hexport = () => {
  if (!can("export")) return; const h = H(); const l = histList(); const bn = branchName(S.branchId) || "كل الفروع";
  if (h.seg === "v") {
    const rows = [["رقم الإذن", "التاريخ", "الفرع", "المندوب", "التاجر", "المشرف المتعاقد", "الصنف", "التصنيف", "الكمية", "السعر", "الخصم %", "الإجمالي"]];
    l.forEach(v => (v.items || []).forEach(i => rows.push([v.number, v.date, branchName(v.branch_id), v.rep_name, v.merchant_label, v.supervisor_name || "", i.name, i.category || productByCode(i.code)?.category || "", num(i.qty), num(i.price), num(i.discountPct) * 100, round2(lineTotal(i))])));
    exportWorkbook([{ name: "أذون الصرف", rows }], `vouchers-${bn}-${todayStr()}`);
  } else if (h.seg === "r") {
    const rows = [["رقم المرتجع", "التاريخ", "الفرع", "المندوب", "التاجر", "من إذن", "الصنف", "الكمية", "السبب"]];
    l.forEach(r => (r.items || []).forEach(i => rows.push([r.number, r.date, branchName(r.branch_id), r.rep_name, r.merchant_label, r.voucher_number, i.name, num(i.qty), i.reason || ""])));
    exportWorkbook([{ name: "المرتجعات", rows }], `returns-${bn}-${todayStr()}`);
  } else {
    const rows = [["رقم الوارد", "التاريخ", "الفرع", "المورد", "الصنف", "الكمية"]];
    l.forEach(r => (r.items || []).forEach(i => rows.push([r.number, r.date, branchName(r.branch_id), r.supplier || "", i.name, num(i.qty)])));
    exportWorkbook([{ name: "الوارد", rows }], `incoming-${bn}-${todayStr()}`);
  }
};
