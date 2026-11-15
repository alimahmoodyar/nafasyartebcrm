import {storage} from './storage';
import {AccessError} from './authorization';
import {salesStaff} from './sales-access';
import {salesVisible} from './sales';
import {firmwareBucket} from './firmware-storage';
import {sha256} from './firmware';
import {renderWord} from './proforma-word';
import {validDay,dayAt} from './duties';
import {salesPaymentDays} from './sales-payment-terms';
const fail=(m:string,s=400):never=>{throw new AccessError(m,s)};
export const wordDocumentResponse=(bytes:Uint8Array)=>new Response(bytes as BodyInit,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="proforma.docx"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function scopedWordOrder(u:any,id:string){
 if(!salesStaff(u))fail('خروجی پیش‌فاکتور با کارشناس یا مدیر فروش است.',403);
 const db=storage(),r:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='sales_order'").bind(id).first();if(!r)fail('سفارش در دسترسی شما نیست.',404);
 const order={...r,data:JSON.parse(r.data)},a:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='sales_agent'").bind(order.data.agentId).first();if(!a||!await salesVisible(u,{...a,data:JSON.parse(a.data)},'read'))fail('سفارش در دسترسی شما نیست.',404);
 return {order,agent:{...a,data:JSON.parse(a.data)}};
}
export async function routineOrderWord(u:any,q:URLSearchParams,mode:string,id:string){
 const db=storage(),{order,agent}=await scopedWordOrder(u,q.get('orderId')||'');
 if(!['sales_approved','approved'].includes(order.data.state)||order.data.deliveryMode==='consignment')fail('پیش‌فاکتور فروش پس از بررسی فروش صادر می‌شود؛ سفارش لغوشده یا امانی قابل صدور نیست.');
 const prior:any=await db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='sales_proforma_document'").bind(id).first();if(prior){const d=JSON.parse(prior.data);if(d.orderId!==order.id||d.intakeId||d.actor!==u.userId)fail('شناسه به عملیات دیگری تعلق دارد.',409);const obj=await firmwareBucket().get(d.objectKey);if(!obj)fail('خروجی قبلی موجود نیست.',503);return wordDocumentResponse(new Uint8Array(await obj!.arrayBuffer()));}
 if(Number(q.get('revision'))!==order.revision)fail('نسخه سفارش تغییر کرد؛ سوابق و پیش‌نمایش را تازه کنید.',409);
 const validUntil=q.get('validUntil')||'';if(!validDay(validUntil)||validUntil<dayAt())fail('تاریخ اعتبار معتبر و منقضی‌نشده تعیین کنید.');
 const products:any[]=[];for(const line of order.data.lines){const p:any=await db.prepare("SELECT id,payload FROM records WHERE id=? AND kind='product'").bind(line.productId).first();if(!p)fail('شناسنامه محصول در دسترس نیست.');const data=JSON.parse(p.payload);if(data.productionMode==='project')fail('برای محصول سفارشی، پیش‌فاکتور را از مشخصات نهایی سفارش ساخت صادر کنید.');products.push({...p,data});}
 const unique=[...new Set(order.data.lines.map((l:any)=>l.productId))],productId=unique.length===1?String(unique[0]):'',scopes=productId?[productId,'']:[''];
 let template:any=null;for(const scope of scopes){const row:any=await db.prepare("SELECT * FROM flow_entities WHERE type='sales_word_template' AND json_extract(data,'$.productId')=? AND json_extract(data,'$.published')=1 ORDER BY CAST(json_extract(data,'$.version') AS INTEGER) DESC,created DESC,id DESC LIMIT 1").bind(scope).first();if(row){template={...row,data:JSON.parse(row.data)};break;}}
 if(!template)fail(productId?'مدیر فروش قالب محصول یا قالب عمومی را منتشر کند.':'مدیر فروش قالب عمومی سفارش چندمحصولی را منتشر کند.');
 const obj=await firmwareBucket().get(template.data.objectKey);if(!obj)fail('اصل قالب موجود نیست.',503);
 const fmt=(v:any)=>BigInt(v).toLocaleString('fa-IR'),terms=order.data.salesTerms;
 if(!terms||!Number.isInteger(terms.cashBps))fail('شرایط پرداخت مصوب سفارش موجود نیست.');
 const items=order.data.lines.map((l:any)=>{if(!Number.isSafeInteger(l.quantity)||l.quantity<1||!/^\d+$/.test(String(l.unitNet??l.unitPrice)))fail('قیمت یا تعداد سفارش کامل نیست.');return {شرح:l.name||products.find(p=>p.id===l.productId)?.data.name,تعداد:String(l.quantity),قیمت_واحد:fmt(l.unitNet??l.unitPrice),جمع:fmt(BigInt(l.unitNet??l.unitPrice)*BigInt(l.quantity))};});
 if(order.data.lines.reduce((n:bigint,l:any)=>n+BigInt(l.unitNet??l.unitPrice)*BigInt(l.quantity),BigInt(0))!==BigInt(order.data.amount))fail('جمع اقلام با مبلغ سفارش سازگار نیست؛ سفارش را بررسی کنید.');
 const data={نام_مشتری:agent.data.name,نام_محصول:products.map(p=>p.data.name).join('، '),شماره_پیش_فاکتور:order.data.code,تاریخ:new Date().toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran'}),اعتبار_پیش_فاکتور:new Date(validUntil+'T12:00:00Z').toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran'}),تخفیف:fmt(order.data.discount||'0'),مشخصات_نهایی_سفارش:products.map(p=>[p.data.name,p.data.model,p.data.group].filter(Boolean).join(' · ')).join('\n'),مدت_تولید:'',شرایط_پرداخت:terms.cashBps/100+'٪ نقد'+(terms.cashBps<10000?'؛ باقی‌مانده '+(order.data.dispatchPaymentDays??salesPaymentDays(terms,order.data.day||dayAt()))+' روز'+(order.data.dispatchPaymentDays!==undefined?' از خروج هر محموله':' از تاریخ فاکتور'):''),مبلغ_کل:fmt(order.data.amount),اقلام:items};
 const imageRow:any=productId?await db.prepare("SELECT data FROM flow_entities WHERE type='sales_word_image' AND json_extract(data,'$.productId')=? ORDER BY CAST(json_extract(data,'$.version') AS INTEGER) DESC LIMIT 1").bind(productId).first():null,image=imageRow?JSON.parse(imageRow.data):null,imageObj=image?await firmwareBucket().get(image.objectKey):null;
 const result=renderWord(new Uint8Array(await obj!.arrayBuffer()),data,imageObj?{bytes:new Uint8Array(await imageObj.arrayBuffer()),extension:image.extension}:undefined,template.data.kind||'routine');
 if(mode==='preview')return wordDocumentResponse(result);
 const now=new Date().toISOString(),hash=await sha256(result.slice().buffer),key='proforma/issued/'+id+'-'+crypto.randomUUID()+'.docx';await firmwareBucket().put(key,result);
 try{const d={orderId:order.id,productId,templateId:template.id,templateVersion:template.data.version,orderRevision:order.revision,validUntil,actor:u.userId,objectKey:key,filename:'proforma.docx',size:result.length,sha256:hash,at:now};
  await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'proforma_issue',?,?,?,1)").bind(id,JSON.stringify({orderId:order.id,revision:order.revision,templateId:template.id,validUntil}),u.userId,now),db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(order.id,order.revision,agent.id,agent.revision,id),...products.map(p=>db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?) THEN guard ELSE 0 END WHERE id=?').bind(p.id,p.payload,id)),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'sales_proforma_document',?,1,?,?)").bind(id,JSON.stringify(d),now,now),db.prepare("INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,'proforma_issue',?,?)").bind(crypto.randomUUID(),u.userId,id,JSON.stringify({orderId:order.id,templateId:template.id,sha256:hash}),now)]);
 }catch(e){await firmwareBucket().delete(key).catch(()=>{});throw e;}
 return wordDocumentResponse(result);
}
