(function () {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ar-SA-u-nu-latn", {
      calendar: "gregory",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function certificateMarkup(certificate) {
    const logoUrl = new URL("logo-mark.png", window.location.href).href;
    const name = escapeHtml(certificate.volunteerName);
    const title = escapeHtml(certificate.initiativeTitle);
    const initiativeDate = escapeHtml(formatDate(certificate.initiativeDate));
    const issuedDate = escapeHtml(formatDate(certificate.issuedAt));
    const number = escapeHtml(certificate.certificateNumber);
    const hours = Number(certificate.hours) || 0;
    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>شهادة ${number || name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root { --green: #17482f; --deep: #0f3321; --gold: #b78a3e; --mint: #eef6ef; --ink: #243a2d; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    padding: 56px 24px 40px;
    background: #e9efe9;
    color: var(--ink);
    font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .toolbar {
    position: fixed;
    top: 16px;
    left: 16px;
    display: flex;
    gap: 8px;
    z-index: 10;
  }
  .toolbar button {
    min-height: 40px;
    padding: 0 18px;
    border: 1px solid #cfdccf;
    border-radius: 9px;
    background: #fff;
    color: #1d4b33;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .toolbar button.primary { background: var(--green); border-color: var(--green); color: #fff; }
  .sheet {
    position: relative;
    width: 297mm;
    height: 210mm;
    max-width: 100%;
    margin: 0 auto;
    padding: 14mm;
    background: #fffdf8;
    border: 1px solid #d8e2d6;
    box-shadow: 0 24px 70px rgba(20, 50, 33, .16);
    overflow: hidden;
  }
  .frame {
    position: absolute;
    inset: 7mm;
    border: 2px solid var(--green);
  }
  .frame::after {
    content: "";
    position: absolute;
    inset: 3mm;
    border: 1px solid rgba(183, 138, 62, .55);
  }
  .corner {
    position: absolute;
    width: 26mm;
    height: 26mm;
    border-color: rgba(183, 138, 62, .65);
    border-style: solid;
    border-width: 0;
  }
  .corner.tl { top: 10mm; right: 10mm; border-top-width: 2px; border-right-width: 2px; }
  .corner.tr { top: 10mm; left: 10mm; border-top-width: 2px; border-left-width: 2px; }
  .corner.bl { bottom: 10mm; right: 10mm; border-bottom-width: 2px; border-right-width: 2px; }
  .corner.br { bottom: 10mm; left: 10mm; border-bottom-width: 2px; border-left-width: 2px; }
  .content {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4mm 16mm 2mm;
    text-align: center;
  }
  .brand { display: flex; align-items: center; gap: 4mm; }
  .brand img { width: 46mm; height: auto; }
  .brand-copy { text-align: right; }
  .brand-copy strong { display: block; color: var(--deep); font-size: 15pt; font-weight: 700; }
  .brand-copy small { display: block; margin-top: 2px; color: #6d7d71; font-size: 9pt; letter-spacing: .4px; }
  h1 {
    margin: 7mm 0 0;
    color: var(--green);
    font-size: 30pt;
    font-weight: 700;
    letter-spacing: .5px;
  }
  .rule {
    display: flex;
    align-items: center;
    gap: 4mm;
    margin: 2.5mm 0 7mm;
    width: 70mm;
  }
  .rule i { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--gold)); }
  .rule i:last-child { background: linear-gradient(90deg, var(--gold), transparent); }
  .rule b { width: 3mm; height: 3mm; background: var(--gold); transform: rotate(45deg); }
  .lead { margin: 0; color: #5a6b5f; font-size: 13pt; }
  .name {
    margin: 5mm 0 0;
    padding: 0 10mm 2mm;
    border-bottom: 1.5px solid rgba(183, 138, 62, .5);
    color: var(--deep);
    font-size: 26pt;
    font-weight: 700;
    line-height: 1.5;
  }
  .statement {
    max-width: 200mm;
    margin: 6mm auto 0;
    color: #3a5041;
    font-size: 13pt;
    line-height: 2;
  }
  .statement b { color: var(--green); font-weight: 700; }
  .hours {
    display: inline-flex;
    align-items: baseline;
    gap: 2mm;
    margin-top: 6mm;
    padding: 2mm 8mm;
    border-radius: 999px;
    background: var(--mint);
    color: var(--green);
    font-size: 12pt;
    font-weight: 600;
  }
  .hours strong { font-size: 20pt; }
  .footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10mm;
    width: 100%;
    margin-top: auto;
    padding-top: 8mm;
  }
  .meta { text-align: right; color: #6a7b6f; font-size: 9.5pt; line-height: 1.9; }
  .meta b { color: #33483a; font-weight: 600; }
  .signature { min-width: 62mm; text-align: center; }
  .signature .line { height: 11mm; border-bottom: 1px solid #9fb2a3; }
  .signature span { display: block; margin-top: 2mm; color: #445a49; font-size: 10pt; font-weight: 600; }
  .signature small { display: block; color: #86968a; font-size: 8.5pt; }
  @page { size: A4 landscape; margin: 0; }
  @media print {
    html, body { background: #fff; }
    body { padding: 0; min-height: 0; }
    .toolbar { display: none; }
    .sheet {
      width: 297mm;
      height: 210mm;
      max-width: none;
      margin: 0;
      border: 0;
      box-shadow: none;
    }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="primary" onclick="window.print()">طباعة / حفظ PDF</button>
    <button type="button" onclick="window.close()">إغلاق</button>
  </div>
  <section class="sheet">
    <span class="frame" aria-hidden="true"></span>
    <span class="corner tl" aria-hidden="true"></span>
    <span class="corner tr" aria-hidden="true"></span>
    <span class="corner bl" aria-hidden="true"></span>
    <span class="corner br" aria-hidden="true"></span>
    <div class="content">
      <div class="brand">
        <img src="${logoUrl}" alt="شعار الوحدة التطوعية" />
        <span class="brand-copy">
          <strong>الوحدة التطوعية</strong>
          <small>Nabd Volunteering Association</small>
        </span>
      </div>
      <h1>شهادة شكر وتقدير</h1>
      <div class="rule" aria-hidden="true"><i></i><b></b><i></i></div>
      <p class="lead">تشهد إدارة العمل التطوعي بأن</p>
      <p class="name">${name || "—"}</p>
      <p class="statement">
        قد ساهم بجهود تطوعية مميزة في مبادرة <b>«${title || "—"}»</b><br />
        المنفذة بتاريخ <b>${initiativeDate || "—"}</b>، وقد أظهر التزامًا وروحًا عالية في خدمة المجتمع.
      </p>
      <div class="hours"><strong>${hours}</strong> ساعة تطوعية</div>
      <div class="footer">
        <div class="meta">
          <div>رقم الشهادة: <b>${number || "—"}</b></div>
          <div>تاريخ الإصدار: <b>${issuedDate || "—"}</b></div>
        </div>
        <div class="signature">
          <div class="line"></div>
          <span>إدارة العمل التطوعي</span>
          <small>الوحدة التطوعية</small>
        </div>
      </div>
    </div>
  </section>
  <script>
    window.addEventListener("load", function () {
      var images = Array.prototype.slice.call(document.images);
      Promise.all(images.map(function (image) {
        if (image.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          image.onload = resolve;
          image.onerror = resolve;
        });
      })).then(function () {
        window.setTimeout(function () { window.print(); }, 450);
      });
    });
  </script>
</body>
</html>`;
  }

  function openCertificatePdf(certificate) {
    if (!certificate || !certificate.certificateNumber) {
      window.alert("لا يمكن إصدار الشهادة قبل اعتمادها وتحديد رقمها.");
      return;
    }
    const popup = window.open("", "_blank", "width=1180,height=860");
    if (!popup) {
      window.alert("تعذر فتح نافذة الشهادة. اسمح بالنوافذ المنبثقة ثم حاول مجددًا.");
      return;
    }
    popup.document.open();
    popup.document.write(certificateMarkup(certificate));
    popup.document.close();
  }

  window.NabdCertificates = { open: openCertificatePdf };
})();
