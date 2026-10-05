import {moneyMicro,moneyText,costRead,costWrite} from './costing';
export const apRead=(u:any)=>!u.permissions.salesAgentId&&!u.permissions.serviceAgentId&&!u.permissions.hospitalCenterId&&(costRead(u)||u.permissions.supplyRoles?.some((r:string)=>['domestic','foreign','finance','ceo'].includes(r)));
export const apFinance=(u:any)=>apRead(u)&&costWrite(u);
export const apBuyer=(u:any,route:string)=>apRead(u)&&(u.isAdmin||u.permissions.supplyRoles?.includes(route));
export const apVisible=(u:any,c:any)=>apRead(u)&&(costRead(u)||u.permissions.supplyRoles?.some((r:string)=>['finance','ceo'].includes(r))||apBuyer(u,c.data.route));
export const apHelp=[
 'شروع از پرداخت یا فاکتور: پرونده مشترک با هویت تأمین‌کننده و مسیر خرید بسازید. پرداخت واقعی با مرجع بانکی ثبت می‌شود؛ تخصیص آن به فاکتور، اقدام مستقل مالی است. گزارش پرداخت قدیمی سفارش خودکار پرداخت جدید محسوب نمی‌شود.',
 'مبالغ دفتر بدهی و پرداخت ریال است. برای خرید ارزی مبلغ ارز، نرخ و مرجع تبدیل در مدرک ثبت شود؛ مبلغ ریالی نهایی را مالی تأیید می‌کند. این دفتر جای ثبت تفاوت تسعیر در حسابداری نیست.',
 'هر ردیف فاکتور به سفارش و رسیدهای واقعی وصل می‌شود. پیش از رسیدن کالا می‌توان فاکتور ثبت کرد. انبار و کیفیت از مسیر فعلی کار می‌کنند و نتیجه زنده در این پرونده دیده می‌شود.',
 'مالی با تعیین حساب و مبنای شناسایی، بدهی را تأیید می‌کند؛ نقص مدرک یا اختلاف دریافت بدهی را حذف نمی‌کند. اجازه پرداخت جداست و به تکمیل مدارک، دریافت/کیفیت و شرایط همان خرید وابسته است.',
 'برای پیش‌پرداخت قراردادی، برنامه پرداخت مستقل با مرجع قرارداد ثبت و توسط مالی آزاد شود. برای فاکتور، اقساط باید با کل بدهی برابر باشند؛ مبالغ تخصیص‌یافته به ترتیب سررسید از صف کم می‌شوند.',
 'ثبت فاکتور و پرداخت، کارهای ناقص را خودکار به کارتابل بازرگانی یا مالی می‌فرستد. برای نقص خاص می‌توان مسئول و موعد مشخص ثبت کرد؛ نبود کاربر مجاز آشکارا نمایش داده می‌شود.',
 'اسناد ناقص مسئول و موعد دارند و به کارتابل می‌روند. پاسخ کارتابل به تنهایی مانع پرداخت را رفع نمی‌کند؛ مالی پس از بررسی مدرک آن را می‌بندد. ثبت نقص یا تغییر منابع، مجوز قبلی را نیازمند بازبینی می‌کند.',
 'دستیار ابتدا این پرونده‌ها، سفارش و پرداخت‌ها را بخواند. مبلغ کل/واحد، ریال/تومان/ارز، هدف خرید، تأمین‌کننده، وقوع پرداخت، فاکتور، دریافت و شرایط خرید را فقط اگر نامشخص‌اند بپرسد. هر نوشتن پس از نمایش خلاصه و تأیید انجام شود؛ مبلغ مشابه دلیل کافی برای تطبیق نیست.',
 'ثبت در این بخش دفتر کنترلی بدهی و پرداخت است؛ پرداخت بانکی و سند سپیدار ایجاد نمی‌شود و بهای بچ فقط از تسویه خرید موجود تأیید می‌شود. اصلاح اشتباه با ابطال مستند و حفظ سابقه است؛ حذف مالی انجام نمی‌شود.'
];
export const active=(a:any[])=>a.filter(x=>!x.voided);
export function applied(c:any,kind:'invoiceId'|'paymentId',id:string){return active(c.allocations).filter((x:any)=>x[kind]===id).reduce((n:bigint,x:any)=>n+moneyMicro(x.amount),BigInt(0));}
export function invoiceMatch(c:any,i:any,rows:any[]){
 const blockers:string[]=[],lines=i.lines.map((l:any)=>{const o=rows.find(x=>x.type==='purchase_order'&&x.id===l.orderId);const receipts=l.receiptIds.map((id:string)=>rows.find(x=>x.type==='receipt'&&x.id===id));
 if(!o||o.data.state==='cancelled')blockers.push('سفارش نامعتبر یا لغوشده');
 if(!receipts.length||receipts.some((r:any)=>!r||r.data.purchaseOrderId!==l.orderId))blockers.push('رسید کالا کامل نیست');
 const received=receipts.reduce((n:number,r:any)=>n+(r?.data.quantity||0),0),accepted=receipts.reduce((n:number,r:any)=>n+(r?.data.accepted||0),0),rejected=receipts.reduce((n:number,r:any)=>n+(r?.data.rejected||0),0);
 if(received!==l.quantity)blockers.push('مغایرت تعداد فاکتور و دریافت');if(rejected)blockers.push('کالای مردود نیازمند تعیین تکلیف');if(receipts.some((r:any)=>r&&!['stored','rejected'].includes(r.data.state)))blockers.push('دریافت، کیفیت یا جانمایی کامل نیست');
 return {orderId:l.orderId,partCode:o?.data.partCode,ordered:o?.data.quantity,invoice:l.quantity,received,accepted,rejected,receipts:receipts.map((r:any)=>r?{id:r.id,revision:r.revision,state:r.data.state}:null)};
 });
 return {lines,blockers:[...new Set(blockers)]};
}
export function releaseBasis(c:any,i:any,rows:any[]){return JSON.stringify({invoice:{...i,release:undefined},match:invoiceMatch(c,i,rows),issues:active(c.issues).filter((x:any)=>x.state!=='resolved'),orders:i.lines.map((l:any)=>{const o=rows.find(x=>x.id===l.orderId);return {id:l.orderId,revision:o?.revision}})});}
export function apView(c:any,rows:any[]){
 const issues=active(c.issues).filter((x:any)=>x.state!=='resolved');
 const invoices=active(c.invoices).map((i:any)=>{const match=invoiceMatch(c,i,rows),paid=applied(c,'invoiceId',i.id),remaining=moneyMicro(i.amount)-paid;
 const pendingAdvance=active(c.advances).some((a:any)=>!a.closed&&(!a.orderId||i.lines.some((l:any)=>l.orderId===a.orderId))&&active(c.payments).filter((p:any)=>p.advanceId===a.id).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount),BigInt(0))<moneyMicro(a.amount));
 const discrepancyReviewed=!!i.dispute&&i.dispute.match===JSON.stringify(match);const blockers=[...(pendingAdvance?['مانده برنامه پیش‌پرداخت این خرید را پیش از اجازه تسویه ببندید']:[]),...match.blockers.filter((b:string)=>!(discrepancyReviewed&&['مغایرت تعداد فاکتور و دریافت','کالای مردود نیازمند تعیین تکلیف'].includes(b))),...(issues.length?['مدرک یا پیگیری باز']:[]),...(!i.evidence?['مدرک فاکتور ناقص است']:[]),...(!i.recognition?['بدهی هنوز تأیید نشده']:[])];
 const released=!!i.release&&i.release.basis===releaseBasis(c,i,rows)&&!blockers.length;let credit=paid;const disputed=i.dispute?moneyMicro(i.dispute.amount):BigInt(0);let payable=remaining>disputed?remaining-disputed:BigInt(0);
 const queue=[...(i.schedule||[])].sort((a:any,b:any)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id)).map((s:any)=>{const amount=moneyMicro(s.amount),used=credit>amount?amount:credit;credit-=used;const rest=amount-used,available=rest>payable?payable:rest;payable-=available;return {...s,remaining:moneyText(available),held:moneyText(rest-available),released,blockers:!released?[...blockers,...(!i.release||i.release.basis!==releaseBasis(c,i,rows)?['نیازمند تأیید اجازه پرداخت']:[])]:[]};});
 return {...i,match,disputed:moneyText(disputed),paid:moneyText(paid),remaining:moneyText(remaining),blockers,released,queue};});
 const payments=active(c.payments).map((p:any)=>({...p,allocated:moneyText(applied(c,'paymentId',p.id)),available:moneyText(moneyMicro(p.amount)-applied(c,'paymentId',p.id))}));
 const advances=active(c.advances).map((a:any)=>{const paid=payments.filter((p:any)=>p.advanceId===a.id).reduce((n:bigint,p:any)=>n+moneyMicro(p.amount),BigInt(0));return {...a,remaining:moneyText(a.closed?BigInt(0):moneyMicro(a.amount)-paid),released:!!a.release&&!issues.length&&(!a.orderId||rows.some(o=>o.id===a.orderId&&o.type==='purchase_order'&&o.data.state!=='cancelled'&&o.revision===a.release.orderRevision))};});
 return {invoices,payments,advances,issues,liability:moneyText(invoices.filter((i:any)=>i.recognition).reduce((n:bigint,i:any)=>n+moneyMicro(i.remaining),BigInt(0))),unallocated:moneyText(payments.reduce((n:bigint,p:any)=>n+moneyMicro(p.available),BigInt(0)))};
}
