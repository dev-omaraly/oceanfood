/* لو مكتبة من vendor/ ما اتحمّلتش، حمّلها من CDN (ملف خارجي علشان الـ CSP يمنع أي سكربت inline) */
(function () {
  var s = document.currentScript; if (!s) return;
  if (!window[s.getAttribute("data-check")]) document.write('<script src="' + s.getAttribute("data-src") + '"><\/script>');
})();
