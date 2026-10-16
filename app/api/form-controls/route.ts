import {requireAccess,accessResponse,AccessError} from '@/lib/authorization';
import {qactor,qtoday} from '@/lib/qms';
import {controlledForms} from '@/lib/form-control-contract';
import {controlledDocuments,documentControl,formRecordAccess} from '@/lib/form-control';
import {formHeaders,escapeForm as e,printableForm} from '@/lib/form-control-print';
import {storage} from '@/lib/storage';
import {formatDate,formatDateTime} from '@/lib/persian-date';
export async function GET(request:Request){try{
 const u=await requireAccess(),q=new URL(request.url).searchParams,print=q.get('format')==='print';
 if(q.get('view')==='records'){
  const targets=Object.keys(controlledForms).filter(t=>formRecordAccess(u,t));if(!targets.length)throw new AccessError('دسترسی سوابق فرم‌ها ندارید.',403);
  const offset=Number(q.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>1000000)throw new AccessError('صفحه معتبر انتخاب کنید.',400);
  const rows=(await storage().prepare("SELECT id,data FROM flow_entities WHERE type='form_record' AND json_extract(data,'$.target') IN ("+targets.map(()=>'?').join(',')+") ORDER BY created DESC,id DESC LIMIT 101 OFFSET ?").bind(...targets,offset).all()).results as any[];
  const hasMore=rows.length>100,records=rows.slice(0,100).map(r=>{const d=JSON.parse(r.data);return {id:r.id.slice('form-report:'.length),title:d.title,target:d.target,control:d.control,at:d.at,by:d.by};});
  if(!print)return Response.json({records,hasMore,nextOffset:hasMore?offset+100:null},{headers:formHeaders});
  return printableForm('سوابق فرم‌های انبار و تولید',`<h1>سوابق فرم‌های انبار و تولید</h1><p>فقط سوابق ثبت‌شده پس از فعال‌شدن بایگانی نمایش داده می‌شوند؛ کد امروز به سوابق گذشته نسبت داده نمی‌شود.</p><table><thead><tr><th>فرم</th><th>کد</th><th>بازنگری</th><th>ثبت‌کننده</th><th>تاریخ ثبت</th></tr></thead><tbody>${records.map(r=>`<tr><td><a href="/api/form-controls/report?id=${encodeURIComponent(r.id)}">${e(r.title)}</a></td><td><code>${e(r.control?.code||'تعریف نشده')}</code></td><td>${e(r.control?.revision||'—')}</td><td>${e(r.by)}</td><td>${e(formatDateTime(r.at))}</td></tr>`).join('')}</tbody></table>${hasMore?`<a class="no-print" href="?view=records&format=print&offset=${offset+100}">۱۰۰ ثبت بعدی</a>`:''}`);
 }
 await qactor(u);const docs=(await controlledDocuments()).filter(r=>!r.data.private&&r.data.formTarget),products=(await storage().prepare("SELECT id,payload FROM records WHERE kind='product'").all()).results as any[];
 const scopes=new Set(['',...docs.map(r=>r.data.productId||'')]),forms=Object.entries(controlledForms).flatMap(([target,{title}])=>[...scopes].flatMap(productId=>{const versions=docs.filter(r=>r.data.formTarget===target&&(r.data.productId||'')===productId);if(productId&&!versions.length)return [];return [{target,title,productId,product:productId?JSON.parse(products.find(p=>p.id===productId)?.payload||'{}').name||productId:'عمومی',current:documentControl(docs,target,productId,qtoday()),versions:versions.map(r=>({id:r.id,title:r.data.title,code:r.data.values?.code||'',revision:r.data.formRevision||'',version:r.data.version,state:r.data.state,effective:r.data.values?.effective||''}))}];}));
 if(!print)return Response.json({forms},{headers:formHeaders});
 return printableForm('فهرست کد و بازنگری فرم‌ها',`<h1>فهرست کد و بازنگری فرم‌ها</h1><p>کدها در «کیفیت و تحقیق‌وتوسعه ← مدارک و روش‌های اجرایی» تعیین و پس از تأیید مستقل اعمال می‌شوند.</p><table><thead><tr><th>فرم</th><th>دامنه</th><th>کد مصوب جاری</th><th>بازنگری</th><th>تاریخ اجرا</th></tr></thead><tbody>${forms.map(f=>`<tr><td>${e(f.title)}</td><td>${e(f.product)}</td><td><code>${e(f.current?.code||'تعریف نشده')}</code></td><td>${e(f.current?.revision||'—')}</td><td>${f.current?e(formatDate(f.current.effective)):'—'}</td></tr>`).join('')}</tbody></table><h2>سوابق کدگذاری و بازنگری</h2><table><thead><tr><th>مدرک</th><th>کد</th><th>بازنگری</th><th>وضعیت</th></tr></thead><tbody>${docs.map(r=>`<tr><td>${e(r.data.title)}</td><td><code>${e(r.data.values?.code)}</code></td><td>${e(r.data.formRevision)}</td><td>${e(({draft:'پیش‌نویس',review:'در بررسی',approved:'مصوب',superseded:'نسخه پیشین'} as any)[r.data.state]||r.data.state)}</td></tr>`).join('')}</tbody></table>`);
 }catch(err){return accessResponse(err)||Response.json({error:'گزارش فرم‌ها دریافت نشد.'},{status:503,headers:formHeaders});}}
