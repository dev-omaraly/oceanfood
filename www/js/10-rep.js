/* =====================================================================
   10-rep.js — شاشة المندوب: تسليم الأذون + تفريغ المرتجع
===================================================================== */
const REP_REASONS = ["رفض العميل", "تالف", "زيادة عن الطلب"];
const RV = () => (S.sub.repv = S.sub.repv || { open: null });
const myDeliveryFor = v => S.deliveries.find(d => d.voucher_id === v.id) || null;

function repBadge(v) {
  const d = myDeliveryFor(v);
  if (!d) return `<span class="badge b-warn">لم يُسلَّم</span>`;
  if (d.ret_status === "none") return `<span class="badge b-ok">تم التسليم</span>`;
  if (d.ret_status === "held") return `<span class="badge b-bad">مرتجع معلّق</span>`;
  if (d.ret_status === "unloaded") return `<span class="badge b-warn">بانتظار أمين المخزن</span>`;
  return `<span class="badge b-ok">تم استلام المرتجع</span>`;
}
function viewRepHome() {
  const rv = RV(); if (rv.open) return repDeliveryHtml();
  if (!S.me.rep_id) return `<div class="empty"><div class="big">🔗</div>اليوزر ده لسه ما اتربطش بمندوب. كلّم الإدارة.</div>`;
  const held = S.deliveries.filter(d => d.rep_id === S.me.rep_id && d.ret_status === "held");
  const items = aggregateReturns(held);
  const waiting = S.unloads.filter(u => u.rep_id === S.me.rep_id && u.status === "pending");
  const list = S.vouchers.slice(0, 40);
  return `<div class="card"><h3>🧾 رقم إذن الصرف</h3><div class="row"><input type="text" id="rpNo" inputmode="numeric" placeholder="اكتب رقم الإذن" class="grow"><button class="btn" data-act="rpOpenNo">فتح</button></div></div>
    <div class="sec">📦 المرتجع اللي معايا (لم يُفرَّغ)</div>
    ${items.length ? `<div class="card">${items.map(i => `<div class="between"><span>${esc(i.name)}</span><b>${qtyLabel(i)}</b></div>`).join("")}<button class="btn block mt" data-act="rpUnload">📤 تفريغ (${held.length} إذن)</button></div>` : `<div class="muted mb">لا يوجد مرتجع معلّق</div>`}
    ${waiting.length ? `<div class="card"><b>⏳ بانتظار تأكيد أمين المخزن:</b> ${waiting.length} تفريغ</div>` : ""}
    <div class="sec">أذوني</div>
    ${list.map(v => `<div class="item" data-act="rpOpen" data-id="${v.id}"><div class="t"><span>إذن #${esc(v.number)}</span>${repBadge(v)}</div><div class="m">${esc(v.merchant_label || "")} · ${ltr(v.date)}</div></div>`).join("") || `<div class="empty"><div class="big">🧾</div>لا توجد أذون على حسابك</div>`}`;
}
function openRepVoucher(v) {
  const d = myDeliveryFor(v);
  const lines = (v.items || []).map(it => {
    const prod = productByCode(it.code) || {}; const packMode = !!it.packQty;
    const ordered = packMode ? Number(it.packQty) : num(it.qty);
    const prev = d && (d.lines || []).find(l => l.code === it.code);
    return { code: it.code, name: it.name, unit: it.unit, price: it.price || 0, ordered, packMode, upc: it.unitsPerCarton || upcOf(prod), delivered: prev ? prev.delivered : ordered, reason: prev ? (prev.reason || "") : "" };
  });
  RV().open = { voucherId: v.id, lines, readonly: !!(d && (d.ret_status === "unloaded" || d.ret_status === "received")) };
  render(); window.scrollTo(0, 0);
}
function repDeliveryHtml() {
  const o = RV().open, v = S.vouchers.find(x => x.id === o.voucherId); if (!v) { RV().open = null; return ""; }
  return `<div class="between mb"><b>إذن #${esc(v.number)} · ${esc(v.merchant_label || "")}</b><button class="btn ghost sm" data-act="rpBack">‹ رجوع</button></div>
    ${o.readonly ? `<div class="card muted">المرتجع اتفرّغ بالفعل، مينفعش التعديل.</div>` : `<div class="muted mb">حدد الكمية اللي التاجر استلمها، والباقي بيتسجل مرتجع.</div>`}
    ${o.lines.map((l, i) => { const ret = l.ordered - l.delivered;
      return `<div class="item"><div class="t"><span>${esc(l.name)}</span><span class="badge b-info">المطلوب ${fmt(l.ordered)} ${esc(lineUnit(l))}</span></div>
      ${o.readonly ? `<div class="m">المستلم: ${fmt(l.delivered)} · المرتجع: ${fmt(ret)} ${esc(lineUnit(l))}</div>` : `
        <div class="stepper mt"><button data-act="rpMinus" data-i="${i}">−</button><input type="number" data-ch="rpVal" data-i="${i}" value="${l.delivered}" min="0" max="${l.ordered}"><button data-act="rpPlus" data-i="${i}">+</button></div>
        <div class="muted center">المستلم من التاجر (${esc(lineUnit(l))})</div>
        ${ret > 0 ? `<div class="center" style="color:var(--red);font-weight:800">مرتجع: ${fmt(ret)} ${esc(lineUnit(l))}</div><div class="chips mt" style="justify-content:center">${REP_REASONS.map(r => `<button class="chip ${(l.reason || REP_REASONS[0]) === r ? "on" : ""}" data-act="rpReason" data-i="${i}" data-r="${esc(r)}">${r}</button>`).join("")}</div>` : ""}`}</div>`; }).join("")}
    ${o.readonly ? "" : `<button class="btn green block" data-act="rpSave">✅ تأكيد التسليم</button>`}`;
}
const rpClamp = (l, x) => Math.max(0, Math.min(l.ordered, Math.round(Number(x)) || 0));
ACT.rpOpen = d => openRepVoucher(S.vouchers.find(v => v.id === d.id));
ACT.rpOpenNo = () => { const n = $("#rpNo").value.trim(); const v = S.vouchers.find(x => String(x.number) === n); if (!v) { toast("مفيش إذن بالرقم ده على حسابك"); return; } openRepVoucher(v); };
ACT.rpBack = () => { RV().open = null; render(); };
ACT.rpMinus = d => { const l = RV().open.lines[+d.i]; l.delivered = rpClamp(l, l.delivered - 1); render(); };
ACT.rpPlus = d => { const l = RV().open.lines[+d.i]; l.delivered = rpClamp(l, l.delivered + 1); render(); };
CHG.rpVal = (v, el) => { const l = RV().open.lines[+el.dataset.i]; l.delivered = rpClamp(l, v); render(); };
ACT.rpReason = d => { RV().open.lines[+d.i].reason = d.r; render(); };
ACT.rpSave = async () => {
  const o = RV().open, v = S.vouchers.find(x => x.id === o.voucherId); if (!v) return;
  const lines = o.lines.map(l => ({ code: l.code, name: l.name, unit: l.unit, price: l.price, ordered: l.ordered, delivered: l.delivered, packMode: l.packMode, upc: l.upc, returnQty: l.ordered - l.delivered, reason: l.ordered > l.delivered ? (l.reason || REP_REASONS[0]) : "" }));
  const hasRet = lines.some(l => l.returnQty > 0);
  const { error } = await sb.from("rep_deliveries").upsert({ branch_id: v.branch_id, voucher_id: v.id, voucher_number: v.number, rep_id: v.rep_id, rep_name: v.rep_name, merchant_label: v.merchant_label, date: todayStr(), lines, ret_status: hasRet ? "held" : "none", created_by_name: S.me.username, updated_at: new Date().toISOString() }, { onConflict: "voucher_id" });
  if (error) { toast("تعذر الحفظ: " + error.message); return; }
  logActivity("تسليم مندوب", `#${v.number} ← ${v.merchant_label}${hasRet ? " (فيه مرتجع)" : ""}`);
  await BRANCH_TABLES.rep_deliveries(); S.ver++; RV().open = null;
  toast(hasRet ? "تم التسجيل - المرتجع معلّق معاك لحد التفريغ" : "تم تسجيل التسليم"); render();
};
ACT.rpUnload = async () => {
  const held = S.deliveries.filter(d => d.rep_id === S.me.rep_id && d.ret_status === "held"); if (!held.length) { toast("مفيش مرتجع معلّق"); return; }
  const items = aggregateReturns(held);
  if (!(await confirmBox("تفريغ المرتجع؟\n" + items.map(i => `${i.name}: ${qtyLabel(i)}`).join("\n")))) return;
  const { data, error } = await sb.from("unloads").insert({ branch_id: S.me.branch_id, rep_id: S.me.rep_id, rep_name: held[0].rep_name, items, delivery_ids: held.map(d => d.id), voucher_numbers: held.map(d => d.voucher_number), status: "pending" }).select().single();
  if (error) { toast(error.message); return; }
  await sb.from("rep_deliveries").update({ ret_status: "unloaded", unload_id: data.id }).in("id", held.map(d => d.id));
  logActivity("تفريغ مرتجعات مندوب", items.map(i => `${i.name} ${qtyLabel(i)}`).join("، "));
  await Promise.all([BRANCH_TABLES.rep_deliveries(), BRANCH_TABLES.unloads()]); S.ver++;
  toast("تم التفريغ - بانتظار تأكيد أمين المخزن"); render();
};
