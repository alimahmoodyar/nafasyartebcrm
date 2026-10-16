import {storage} from './storage';
import {AccessError,can} from './authorization';
import {flowRole,warehouseAccess} from './material-flow';
import {qualityAccess} from './quality-storage';
import {controlledForms,controlledInputs,type FormControl,type FormRecord} from './form-control-contract';
import type {Session} from './permissions';
export async function controlledDocuments(){return (await storage().prepare("SELECT * FROM flow_entities WHERE type='qms_record' AND json_extract(data,'$.kind')='document'").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));}
export function documentControl(docs:any[],target:string,productId='',today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'})):FormControl|null{
 const eligible=docs.filter(r=>!r.data.private&&r.data.formTarget===target&&r.data.formRevision&&r.data.values?.code&&r.data.values?.effective<=today&&['approved','superseded'].includes(r.data.state)&&(!r.data.productId||r.data.productId===productId));
 const specific=eligible.filter(r=>r.data.productId===productId&&productId),pool=specific.length?specific:eligible.filter(r=>!r.data.productId);
 const current=pool.sort((a,b)=>b.data.values.effective.localeCompare(a.data.values.effective)||b.data.version-a.data.version)[0];
 return current?{documentId:current.id,code:current.data.values.code,revision:current.data.formRevision,documentVersion:current.data.version,effective:current.data.values.effective}:null;
}
export function formRecordAccess(u:Session,target:string){
 if(!controlledForms[target])return false;
 if(u.permissions.hospitalCenterId||u.permissions.salesAgentId||u.permissions.serviceAgentId)return false;
 if(u.isAdmin)return true;
 if(target.startsWith('fulfillment.'))return warehouseAccess(u,'finished')||target!=='fulfillment.dispatch'&&flowRole(u,'production');
 if(target==='quality.final')return flowRole(u,'qc')||flowRole(u,'production')||can(u,'device','read')&&can(u,'event','read');
 if(target==='production.bom')return can(u,'product','read');
 if(['production.opening','production.move'].includes(target))return can(u,'batch','read');
 if(target.startsWith('production.'))return can(u,'event','read')&&can(u,'device','read')&&can(u,'batch','read');
 return controlledForms[target].roles.some(r=>flowRole(u,r));
}
const labels:Record<string,string>={packaged:'بسته‌بندی تأییدشده',handoffId:'تحویل تولید',saleId:'حواله فروش',carrierId:'تحویل‌گیرنده تدارکات',handedOver:'تحویل فیزیکی تأییدشده',receiptReference:'مرجع رسید تحویل',code:'کد کالا',name:'نام',unit:'واحد',specs:'مشخصات فنی',fields:'معیارهای کنترل',label:'عنوان معیار',type:'نوع پاسخ',min:'حد پایین',max:'حد بالا',required:'الزامی',materialId:'کالا',warehouse:'انبار',warehouseId:'انبار',warehouseOwner:'مسئول انبار',qcOwner:'مسئول کیفیت',locations:'محل‌های نگهداری',active:'فعال',day:'تاریخ',quantity:'تعداد / مقدار',invoiceQuantity:'تعداد فاکتور',purchaseOrderId:'سفارش خرید',discrepancyNotes:'شرح مغایرت',supplier:'تأمین‌کننده',maker:'سازنده',manufacturerLot:'بچ سازنده',purchase:'مرجع خرید',notes:'توضیح',expiry:'انقضا',receiptId:'محموله',accepted:'مقدار قبول',values:'نتیجه معیارها',location:'محل',planId:'برنامه',requestId:'درخواست مواد',allocations:'بچ‌های مصرفی',batchId:'بچ',reason:'علت',productId:'محصول',capacity:'ظرفیت',smallLabels:'تعداد برچسب کوچک',sourcingPlanId:'برنامه مصوب',count:'تعداد',design:'طراحی',firmware:'نرم‌افزار',deviceIds:'دستگاه‌ها',deviceId:'دستگاه',assembler:'مونتاژکار',oldBatchId:'بچ خارج‌شده',newBatchId:'بچ جایگزین',cause:'علت مردودی',from:'مبدأ',to:'مقصد',bomId:'BOM',orderId:'برگ تولید',operator:'مسئول تولید',lines:'ردیف‌های BOM',partCode:'کد قطعه',partName:'نام قطعه',title:'عنوان فرم',verdict:'نتیجه نهایی',templateId:'فرم آزمون',previousVersion:'نسخه مبنا'};
const choices:Record<string,string>={pass:'قبول',fail:'مردود',number:'عدد',text:'متن',result:'قبول / رد',raw:'مواد اولیه',line:'خط تولید',semi:'نیمه‌ساخته',quarantine:'قرنطینه',nonconforming:'نامنطبق',finished:'محصول نهایی',part:'قطعه',assembly:'مونتاژ',design:'طراحی',test:'آزمون',unknown:'نامشخص'};
/** A successful operation's displayed answers and document identity are archived atomically. */
export async function captureForm(op:string,target:string,body:any,u:Session,productId='',criteria:any[]=[],extra:{label:string;value:string}[]=[]){
 if(!controlledForms[target])return [];
 body=Object.fromEntries(Object.entries(body).filter(([key])=>controlledInputs[target]?.includes(key)));
 const rowFields:Record<string,string[]>={fields:['label','type','unit','min','max','required'],allocations:['batchId','location','quantity','partCode','warehouse'],lines:['partCode','name','unit','quantity']};
 for(const [key,allowed] of Object.entries(rowFields))if(Array.isArray(body[key]))body[key]=body[key].map((r:any)=>Object.fromEntries(Object.entries(r).filter(([k])=>allowed.includes(k))));
 const db=storage(),at=new Date().toISOString();
 // Product scope is derived from the validated subject, not a client-supplied code or revision.
 if(!productId&&body.deviceId){const device:any=await db.prepare("SELECT payload FROM records WHERE kind='device' AND id=?").bind(body.deviceId).first();productId=device?JSON.parse(device.payload).product||'':'';}
 if(!productId&&target==='production.finish'){const order:any=await db.prepare('SELECT r.payload FROM production_orders o JOIN records r ON r.id=o.device_id WHERE o.id=?').bind(body.orderId).first();productId=order?JSON.parse(order.payload).product||'':'';}
 const docs=await controlledDocuments(),control=documentControl(docs,target,productId),rows:{label:string;value:string}[]=[...extra];
 const references=new Map<string,string>();
 const gather=(v:any,key='')=>{if(typeof v==='string'&&(key.endsWith('Id')||key==='deviceIds'||['warehouseOwner','qcOwner'].includes(key)))references.set(v,'');else if(Array.isArray(v))v.forEach(x=>gather(x,key));else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>gather(x,k))};gather(body);
 // Batch lookups keep large material-allocation forms within database query limits.
 const ids=[...references.keys()].filter(v=>v&&v.length<=200);
 for(let start=0;start<ids.length;start+=50){const chunk=ids.slice(start,start+50),marks=chunk.map(()=>'?').join(',');
  const records=(await db.prepare("SELECT id,kind,payload FROM records WHERE kind IN ('product','device','batch') AND id IN ("+marks+")").bind(...chunk).all()).results as any[];
  for(const r of records){const d=JSON.parse(r.payload);references.set(r.id,[d.code,d.name||d.part||d.model].filter(Boolean).join(' · ')||r.id);}
  const entities=(await db.prepare("SELECT id,type,data FROM flow_entities WHERE type IN ('material','material_warehouse','receipt','request','plan','sourcing_plan') AND id IN ("+marks+")").bind(...chunk).all()).results as any[];
  for(const r of entities){const d=JSON.parse(r.data);references.set(r.id,[d.code,d.name||d.productName||d.batchId||r.id].filter(Boolean).join(' · '));}
  const members=(await db.prepare("SELECT id,name FROM app_members WHERE id IN ("+marks+")").bind(...chunk).all()).results as any[];for(const m of members)references.set(m.id,m.name);
 }
 function walk(v:any,path:string,depth=0){if(depth>8)return;if(Array.isArray(v)){v.forEach((x,i)=>walk(x,path+' '+(i+1),depth+1));return;}if(v&&typeof v==='object'){for(const [k,x] of Object.entries(v)){const label=path==='نتیجه معیارها'?criteria.find(f=>f.key===k)?.label:(k==='id'||k==='confirmed'||k==='mode'||k==='revision'||k==='requestId'&&target==='quality.final'?undefined:labels[k]);if(label)walk(x,path?path+' / '+label:label,depth+1);}return;}if(path)rows.push({label:path,value:typeof v==='boolean'?v?'بله':'خیر':v==null||v===''?'—':references.get(String(v))||(/نوع پاسخ$|نتیجه نهایی$|علت مردودی$|مبدأ$|مقصد$/.test(path)||criteria.some(f=>f.type==='result'&&path.endsWith('/ '+f.label))?choices[String(v)]:undefined)||String(v)});}
 // Only known business fields enter printable records; never trust client-supplied document metadata.
 walk(body,'');
 const data:FormRecord={target,title:controlledForms[target].title,productId,control,at,by:u.name,rows};
 const guardId='form-control:'+op;
 return [db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'form_control','{}',?,?,CASE WHEN (SELECT COUNT(*) FROM flow_entities WHERE type='qms_record' AND json_extract(data,'$.kind')='document')=? AND (SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE type='qms_record' AND json_extract(data,'$.kind')='document')=? THEN 1 ELSE 0 END)").bind(guardId,u.userId,at,docs.length,docs.reduce((n,r)=>n+r.revision,0)),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'form_record',?,1,?,?)").bind('form-report:'+op,JSON.stringify(data),at,at)];
}
export async function readFormRecord(u:Session,id:string){const r:any=await storage().prepare("SELECT data FROM flow_entities WHERE id=? AND type='form_record'").bind('form-report:'+id).first();if(!r)throw new AccessError('این ثبت گزارش کدگذاری‌شده ندارد؛ برای سوابق قدیمی کد امروز جایگزین نمی‌شود.',404);const d=JSON.parse(r.data) as FormRecord;if(!formRecordAccess(u,d.target))throw new AccessError('دسترسی مشاهده این فرم را ندارید.',403);if(d.target==='quality.final')await qualityAccess();return d;}
