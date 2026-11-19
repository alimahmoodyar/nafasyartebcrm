import {requireAccess,accessResponse} from '@/lib/authorization';
import {readPayrollPaymentBatch} from '@/lib/personnel-payroll-read';
import {hrActor,hrFail} from '@/lib/personnel';
import * as XLSX from 'xlsx';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request){try{
 const u=await requireAccess(),a=await hrActor(u),q=new URL(request.url).searchParams,{items,total}=await readPayrollPaymentBatch(a,q.get('periodId')||'');
 if(!items.length||items.some(r=>r.error))hrFail('پیش از دریافت فهرست، فیش‌های آماده و شبای معتبر لازم است.',409);
 if(q.get('format')==='print'){
  const esc=(v:any)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  return new Response('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فهرست پرداخت حقوق</title><style>body{font:14px/1.8 Tahoma;margin:20px;color:#173846}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ccd5de;text-align:right}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:10mm}</style><h1>فهرست پرداخت حقوق</h1><p>مبالغ ریال · این فهرست سند واریز نیست.</p><table><thead><tr><th>نام و نام خانوادگی</th><th>مبلغ نهایی</th><th>شماره شبا</th></tr></thead><tbody>'+items.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+BigInt(r.amount).toLocaleString('fa-IR')+'</td><td dir="ltr">'+esc(r.iban)+'</td></tr>').join('')+'</tbody></table><p>جمع '+BigInt(total).toLocaleString('fa-IR')+' ریال · تعداد '+items.length+'</p></html>',{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox"}});
 }
 if(q.get('format')!=='xlsx')hrFail('قالب خروجی معتبر نیست.');
 const sheet=XLSX.utils.aoa_to_sheet([['نام و نام خانوادگی','مبلغ نهایی (ریال)','شماره شبا'],...items.map(r=>[r.name,r.amount,r.iban]),['جمع',total,'']]);
 // All supplied values stay text, including long amounts and any name starting
 // with '='; no formula, rounding, leading-zero loss or bank-specific layout.
 sheet['!cols']=[{wch:35},{wch:25},{wch:32}];sheet['!rtl']=true;const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,'فهرست پرداخت');
 const bytes=XLSX.write(workbook,{type:'array',bookType:'xlsx'});
 return new Response(bytes,{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="payroll-payment-list.xlsx"'}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت فهرست پرداخت انجام نشد.'},{status:503,headers})}}
