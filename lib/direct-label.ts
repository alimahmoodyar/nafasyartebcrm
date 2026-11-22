// Geometry comes from the authorized preview, in physical millimetres.
export function directLabelPanel(width:number,height:number,selector:string){
 return `<section class="direct-label" data-width="${width}" data-height="${height}" data-selector="${selector}">
 <style>@media print{.direct-label{display:none!important}}.direct-label{margin-block:12px}.direct-label button,.direct-label select{font:inherit;padding:6px 12px}</style>
 <button type="button" data-connect>چاپ مستقیم لیبل</button>
 <span data-controls hidden><label>چاپگر <select data-printer></select></label>
 <button type="button" data-test>چاپ آزمایشی یک لیبل</button>
 <button type="button" data-send>ارسال لیبل‌ها به چاپگر</button>
 <details><summary>تنظیم نقطهٔ شروع چاپ</summary><label>جابه‌جایی به راست (میلی‌متر)<input type="number" data-x step="0.125" min="-15" max="15" value="0"></label>
 <label>جابه‌جایی به پایین (میلی‌متر)<input type="number" data-y step="0.125" min="-15" max="15" value="0"></label></details></span>
 <span data-status role="status"></span> <details data-install><summary>نصب رابط چاپ برای ویندوز</summary>
 <p>روی کامپیوتری که چاپگر به آن وصل است، فایل نسخهٔ ۱٫۰٫۰ را دریافت و اجرا کنید. سپس به همین صفحه برگردید و «چاپ مستقیم لیبل» را بزنید.</p>
 <a href="/label-printer/HamnafasLabelSetup-1.0.0.exe" download>دریافت نصب‌کنندهٔ ویندوز · نسخهٔ ۱٫۰٫۰</a></details>
 </section><script defer src="/label-printer/direct.js"></script>`;
}
