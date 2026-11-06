import {GET as receiptReport} from '@/app/api/receipt-report/route';
import {printableForm,escapeForm as e,formHeaders} from '@/lib/form-control-print';
import {publicBatchLabel} from '@/lib/batch-public-label';
import {accessResponse} from '@/lib/authorization';
export async function GET(request:Request,context:{params:Promise<{code:string}>}){
 try{
 const {code}=await context.params,{summary:s,recordId}=await publicBatchLabel(code),q=new URL(request.url).searchParams;
 // JSON is the exact public projection, not a shortcut to the private report.
 if(q.get('format')==='json')return Response.json(s,{headers:formHeaders});
 let denied=false,login=false;
 if(q.get('details')==='1'){
  const target=new URL('/api/receipt-report',request.url);target.searchParams.set('id',recordId);
  const result=await receiptReport(new Request(target));
  if(![401,403].includes(result.status))return result;
  denied=result.status===403;login=result.status===401;
 }
 const rows=[['نام کالا',s.name],['کد کالا',s.partCode],['شماره بچ',s.batchCode],['تاریخ ورود',s.receiptDay],['مقدار اولیه دریافت (نه موجودی فعلی)',String(s.initialQuantity)+' '+s.unit],...(s.expiry?[['تاریخ انقضا',s.expiry]]:[])];
 return printableForm('اطلاعات ثابت لیبل بچ',`<h1>اطلاعات ثابت لیبل بچ</h1><table><tbody>${rows.map(([label,value])=>`<tr><th>${e(label)}</th><td>${e(value||'ثبت نشده')}</td></tr>`).join('')}</tbody></table><p>${e(s.notice)}</p><section><h2>اطلاعات تکمیلی</h2><p>وضعیت فعلی، موجودی، محل، نتیجهٔ کنترل کیفیت و سوابق داخلی فقط پس از ورود و بررسی دسترسی قابل مشاهده‌اند.</p>${denied?'<p>حساب فعلی اجازهٔ مشاهدهٔ جزئیات داخلی این بچ را ندارد.</p>':''}${login?'<p>برای مشاهدهٔ اطلاعات تکمیلی وارد سامانه شوید.</p>':''}<a href="${login?'/?batch='+encodeURIComponent(code):'/b/'+encodeURIComponent(code)+'?details=1'}">${login?'ورود به سامانه و ادامهٔ مشاهده بچ':'مشاهدهٔ اطلاعات تکمیلی با دسترسی مجاز'}</a></section>`);
 }catch(err){return accessResponse(err)||Response.json({error:'اطلاعات لیبل در دسترس نیست.'},{status:503,headers:formHeaders})}
}
