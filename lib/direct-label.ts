// Geometry comes from the authorized preview, in physical millimetres.
export function directLabelPanel(width:number,height:number,selector:string){
 return `<section class="direct-label" data-width="${width}" data-height="${height}" data-selector="${selector}">
 <style>@media print{.direct-label{display:none!important}}.direct-label{margin-block:12px}.direct-label button,.direct-label select{font:inherit;padding:6px 12px}</style>
 <label style="display:inline-flex;align-items:center;gap:6px;flex-direction:row;flex-wrap:wrap"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 9V3h12v6M6 17H3V9h18v8h-3"/><path d="M6 14h12v7H6zM17 11h1"/></svg>انتخاب چاپگر <select data-printer disabled><option value="">در حال شناسایی…</option></select></label>
 <button type="button" data-connect>جست‌وجوی دوبارهٔ چاپگرها</button>
 <span data-controls hidden>
 <button type="button" data-test>چاپ آزمایشی یک لیبل</button>
 <button type="button" data-send>ارسال لیبل‌ها به چاپگر</button>
 <details><summary>تنظیم نقطهٔ شروع چاپ</summary><label>جابه‌جایی به راست (میلی‌متر)<input type="number" data-x step="0.125" min="-15" max="15" value="0"></label>
 <label>جابه‌جایی به پایین (میلی‌متر)<input type="number" data-y step="0.125" min="-15" max="15" value="0"></label></details></span>
 <span data-status role="status"></span> <details data-install><summary>نصب رابط چاپ برای ویندوز</summary>
 <p>روی کامپیوتری که چاپگر به آن وصل است، فایل نسخهٔ ۱٫۱٫۰ را دریافت کنید، از حالت فشرده خارج کنید و HamnafasPrintSetup.exe را اجرا کنید. سپس به همین صفحه برگردید و «جست‌وجوی دوبارهٔ چاپگرها» را بزنید.</p>
 <a href="/label-printer/HamnafasPrint-1.1.0.zip" download>دریافت نصب‌کنندهٔ ویندوز · نسخهٔ ۱٫۱٫۰</a></details>
 </section><script defer src="/label-printer/direct.js"></script>`;
}
