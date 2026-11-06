import {storedMaterialPhoto,materialPhotoBytes,photoBase64} from '@/lib/material-photos';
import {AccessError} from '@/lib/authorization';
import {GET as receiptReport} from '@/app/api/receipt-report/route';
import {printableForm,escapeForm as e,formHeaders} from '@/lib/form-control-print';
import {publicBatchLabel} from '@/lib/batch-public-label';
import {accessResponse} from '@/lib/authorization';
export async function GET(request:Request,context:{params:Promise<{code:string}>}){
 try{
 const {code}=await context.params,{summary:s,recordId,materialId,photoId}=await publicBatchLabel(code),q=new URL(request.url).searchParams;
 if(q.has('photo')){if(!photoId||q.get('photo')!==photoId)throw new AccessError('تصویر مرجع این بچ پیدا نشد.',404);const photo=await storedMaterialPhoto(photoId);if(!photo?.data.active||photo.data.materialId!==materialId)throw new AccessError('تصویر مرجع این بچ پیدا نشد.',404);const bytes=await materialPhotoBytes(photo,q.get('full')!=='1');if(q.get('format')==='vision')return Response.json({summary:{batchCode:s.batchCode,name:s.name,title:'تصویر مرجع کالا'},content:[{type:'image',data:photoBase64(bytes),mimeType:'image/jpeg'}]},{headers:formHeaders});return new Response(bytes,{headers:{...formHeaders,'Content-Type':'image/jpeg','Content-Length':String(bytes.length),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});}
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
 const response=printableForm('اطلاعات عمومی بچ',`<h1>اطلاعات عمومی بچ</h1>${s.photo?`<figure style="margin:16px 0;text-align:center"><a href="${e(s.photo.fullUrl)}" target="_blank" rel="noopener noreferrer"><img src="${e(s.photo.url)}" alt="تصویر مرجع کالا" style="max-width:100%;width:280px;max-height:280px;object-fit:contain"></a><figcaption>تصویر مرجع کالا — برای بزرگ‌نمایی لمس کنید</figcaption></figure>`:'<p>برای این کالا تصویر مرجع ثبت نشده است.</p>'}<table><tbody>${rows.map(([label,value])=>`<tr><th>${e(label)}</th><td>${e(value||'ثبت نشده')}</td></tr>`).join('')}</tbody></table><section><h2>محل پیش‌فرض نگهداری از شناسنامه</h2>${s.defaultLocations.length?s.defaultLocations.map(l=>`<p>${e(l.warehouse)} · ${e(l.location)}</p>`).join(''):'<p>در شناسنامه ثبت نشده است.</p>'}<h2>محل واقعیِ این بچ</h2>${s.actualLocations.map(l=>`<p>${e(l.warehouse)} · ${e(l.location)}</p>`).join('')}<p>${e(s.locationNotice)}</p></section><p>${e(s.notice)}</p><section><h2>اطلاعات تکمیلی</h2><p>وضعیت فعلی، موجودی، نتیجهٔ کنترل کیفیت و سوابق داخلی فقط پس از ورود و بررسی دسترسی قابل مشاهده‌اند.</p>${denied?'<p>حساب فعلی اجازهٔ مشاهدهٔ جزئیات داخلی این بچ را ندارد.</p>':''}${login?'<p>برای مشاهدهٔ اطلاعات تکمیلی وارد سامانه شوید.</p>':''}<a href="${login?'/?batch='+encodeURIComponent(code):'/b/'+encodeURIComponent(code)+'?details=1'}">${login?'ورود به سامانه و ادامهٔ مشاهده بچ':'مشاهدهٔ اطلاعات تکمیلی با دسترسی مجاز'}</a></section>`);response.headers.set('Content-Security-Policy',(response.headers.get('Content-Security-Policy')||'')+"; img-src 'self'");return response;
 }catch(err){return accessResponse(err)||Response.json({error:'اطلاعات لیبل در دسترس نیست.'},{status:503,headers:formHeaders})}
}
