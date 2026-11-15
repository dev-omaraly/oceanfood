/* =====================================================================
   01-core.js — أدوات عامة: تنسيق، نوافذ، تصدير، أيقونات
===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ltr = s => `<bdi dir="ltr">${esc(s)}</bdi>`;
const fmt = n => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
const round2 = n => Math.round(n * 100) / 100;
const isNative = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

const pad2 = n => String(n).padStart(2, "0");
const dateStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => dateStr(new Date());
const fmtTime = ts => ts ? new Date(ts).toLocaleString("en-GB") : "";
const normAr = x => String(x || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[\u064B-\u0652]/g, "").trim();

/* ---------- الفترات (للتقارير) ---------- */
const PERIODS = { day: "يوم", week: "أسبوع", month: "شهر", quarter: "ربع سنة", half: "نصف سنة", year: "سنة", all: "الكل" };
function periodRange(p, anchor) {
  const d = new Date(anchor + "T00:00:00");
  let s, e;
  if (p === "day") { s = e = new Date(d); }
  else if (p === "week") { const k = (d.getDay() + 1) % 7; s = new Date(d); s.setDate(d.getDate() - k); e = new Date(s); e.setDate(s.getDate() + 6); }
  else if (p === "month") { s = new Date(d.getFullYear(), d.getMonth(), 1); e = new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  else if (p === "quarter") { const q = Math.floor(d.getMonth() / 3) * 3; s = new Date(d.getFullYear(), q, 1); e = new Date(d.getFullYear(), q + 3, 0); }
  else if (p === "half") { const q = d.getMonth() < 6 ? 0 : 6; s = new Date(d.getFullYear(), q, 1); e = new Date(d.getFullYear(), q + 6, 0); }
  else if (p === "year") { s = new Date(d.getFullYear(), 0, 1); e = new Date(d.getFullYear(), 11, 31); }
  else return { start: "0000-00-00", end: "9999-99-99" };
  return { start: dateStr(s), end: dateStr(e) };
}
function shiftAnchor(p, anchor, dir) {
  const d = new Date(anchor + "T00:00:00");
  if (p === "day") d.setDate(d.getDate() + dir);
  else if (p === "week") d.setDate(d.getDate() + 7 * dir);
  else if (p === "month") d.setMonth(d.getMonth() + dir);
  else if (p === "quarter") d.setMonth(d.getMonth() + 3 * dir);
  else if (p === "half") d.setMonth(d.getMonth() + 6 * dir);
  else if (p === "year") d.setFullYear(d.getFullYear() + dir);
  return dateStr(d);
}
const inRange = (ds, r) => ds && ds >= r.start && ds <= r.end;

/* ---------- أيقونات SVG ---------- */
const IC = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 13h7M9 17h7"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>',
  ret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  inn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M4 3h16"/></svg>',
  rep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
};

/* ---------- Toast ---------- */
function toast(msg, ms = 2600) {
  const root = $("#toast"); const d = document.createElement("div");
  d.textContent = msg; root.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

/* ---------- Sheets (نوافذ سفلية) ---------- */
function openSheet(html, mount) {
  const root = $("#sheetRoot");
  root.innerHTML = `<div class="ovl" id="ovl"><div class="sheet"><div class="grab"></div>${html}</div></div>`;
  $("#ovl").addEventListener("mousedown", e => { if (e.target.id === "ovl") closeSheet(); });
  if (mount) mount($(".sheet", root));
}
function closeSheet() { $("#sheetRoot").innerHTML = ""; }

function confirmBox(msg, okText = "تأكيد", danger = false) {
  return new Promise(res => {
    openSheet(`<h2>تأكيد</h2><div style="white-space:pre-line;margin-bottom:14px">${esc(msg)}</div>
      <div class="row"><button class="btn ghost grow" id="cbNo">إلغاء</button><button class="btn ${danger ? "red" : ""} grow" id="cbYes">${esc(okText)}</button></div>`,
      s => { $("#cbNo", s).onclick = () => { closeSheet(); res(false); }; $("#cbYes", s).onclick = () => { closeSheet(); res(true); }; });
  });
}
function askText(title, { label = "", type = "text", value = "", note = "", okText = "حفظ" } = {}) {
  return new Promise(res => {
    openSheet(`<h2>${esc(title)}</h2>${note ? `<div class="muted mb">${esc(note)}</div>` : ""}
      <div class="field"><label>${esc(label)}</label><input type="${type}" id="atVal" value="${esc(value)}" autocomplete="off"></div>
      <div class="row"><button class="btn ghost grow" id="atNo">إلغاء</button><button class="btn grow" id="atYes">${esc(okText)}</button></div>`,
      s => {
        const i = $("#atVal", s); setTimeout(() => i.focus(), 60);
        $("#atNo", s).onclick = () => { closeSheet(); res(null); };
        const ok = () => { const v = i.value; closeSheet(); res(v); };
        $("#atYes", s).onclick = ok; i.addEventListener("keydown", e => { if (e.key === "Enter") ok(); });
      });
  });
}

/* ---------- ملفات: حفظ / مشاركة (ويب + تطبيق الأندرويد) ---------- */
const errMsg = e => String((e && (e.message || e.errorMessage || e.code)) || e || "خطأ غير معروف");
const isCancel = e => /cancel/i.test(errMsg(e));
function nativePlugin(name) {
  const C = window.Capacitor; if (!C) return null;
  try { if (C.Plugins && C.Plugins[name]) return C.Plugins[name]; } catch (e) { }
  try { if (C.registerPlugin) return C.registerPlugin(name); } catch (e) { }
  return null;
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}
async function webSaveFile(filename, base64, mime) {
  const blob = b64ToBlob(base64, mime);
  try {
    const f = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: filename }); return; }
  } catch (e) { if (isCancel(e)) return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function saveBase64File(filename, base64, mime) {
  filename = String(filename).replace(/[\\/:*?"<>|\s]+/g, "-");
  if (!isNative()) return webSaveFile(filename, base64, mime);
  const FS = nativePlugin("Filesystem"), Share = nativePlugin("Share");
  if (!FS) { try { return await webSaveFile(filename, base64, mime); } catch (e) { } throw new Error("إضافة الملفات (Filesystem) مش موجودة في التطبيق — ثبّت أحدث APK"); }
  const ascii = filename.replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-") || ("file-" + Date.now());
  const tries = [["CACHE", filename], ["CACHE", ascii], ["DOCUMENTS", ascii]].filter((t, i, a) => a.findIndex(x => x[0] === t[0] && x[1] === t[1]) === i);
  let lastErr = null;
  for (const [dir, name] of tries) {
    let uri;
    try { uri = (await FS.writeFile({ path: name, data: base64, directory: dir })).uri; }
    catch (e) { lastErr = e; console.error("writeFile", dir, e); continue; }
    if (Share) {
      try { await Share.share({ title: name, url: uri, dialogTitle: "مشاركة / حفظ" }); return; }
      catch (e) { if (isCancel(e)) return; lastErr = e; console.error("share", e); }
    }
    if (dir === "DOCUMENTS") { toast("اتحفظ الملف في Documents باسم " + name, 5000); return; }
  }
  try { return await webSaveFile(filename, base64, mime); } catch (e) { lastErr = lastErr || e; }
  throw lastErr || new Error("فشل حفظ الملف");
}
function exportWorkbook(sheets, filename) {
  if (!window.XLSX) { toast("مكتبة Excel غير متاحة (محتاج إنترنت أول مرة)"); return; }
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows); ws["!cols"] = (s.rows[0] || []).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 30));
  });
  wb.Workbook = { Views: [{ RTL: true }] };
  const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
  saveBase64File(filename + ".xlsx", b64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").catch(e => { console.error(e); toast("تعذر حفظ الملف: " + errMsg(e), 7000); });
}
/* طباعة مستند: متصفح = window.print ، أندرويد = PDF ومشاركة */
async function printDoc(elId, filename) {
  if (!isNative()) { window.print(); return; }
  try {
    if (!window.html2canvas || !window.jspdf) { toast("مكتبة PDF غير متاحة"); return; }
    toast("جاري تجهيز الملف...");
    const el = document.getElementById(elId);
    const scale = el.scrollHeight * 2 > 12000 ? 1 : 2;   // مستند طويل = دقة أقل علشان الموبايل مايخلصش الذاكرة
    const canvas = await html2canvas(el, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const { jsPDF } = window.jspdf; const pdf = new jsPDF("p", "mm", "a4");
    const w = 200, h = canvas.height * w / canvas.width, pageH = 287; let y = 5;
    const img = canvas.toDataURL("image/jpeg", .92);
    if (h <= pageH) pdf.addImage(img, "JPEG", 5, y, w, h);
    else { // مستند طويل: قسّمه صفحات
      let left = h, pos = 5;
      pdf.addImage(img, "JPEG", 5, pos, w, h); left -= pageH;
      while (left > 0) { pos -= pageH; pdf.addPage(); pdf.addImage(img, "JPEG", 5, pos, w, h); left -= pageH; }
    }
    const b64 = pdf.output("datauristring").split(",")[1];
    await saveBase64File(filename + ".pdf", b64, "application/pdf");
  } catch (e) { console.error(e); toast("تعذر تجهيز الملف: " + errMsg(e), 7000); }
}

/* ---------- صور ---------- */
function resizeImage(file, maxDim = 480, quality = .82, keepAlpha = false) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const k = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(keepAlpha ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", quality));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- Firestore-less id ---------- */
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
