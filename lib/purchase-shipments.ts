import {storage} from './storage';
import {AccessError} from './authorization';
import {supplierRows,supplierEntity,supplierCommercial} from './suppliers';
import {hasSupply} from './sourcing';
import {taskRequired as req,taskText as txt,validDay,dayAt} from './duties';
import {packingPrediction} from './shipment-contract';
export const shipmentFail=(m:string,status=400):never=>{throw new AccessError(m,status)};
export const shipmentVisible=(u:any,route:string)=>!u.permissions.salesAgentId&&!u.permissions.serviceAgentId&&!u.permissions.hospitalCenterId&&supplierCommercial(u,route);
export const shipmentWrite=(u:any,route:string)=>shipmentVisible(u,route)&&(hasSupply(u,route)||hasSupply(u,'commerce_manager'));
export async function shipmentRows(){return supplierRows('purchase_shipment');}
export async function shipmentBy(u:any,id:string){const s=await supplierEntity(id,'purchase_shipment');if(!shipmentVisible(u,s.data.route))shipmentFail('پرونده در دسترس نیست.',404);return s;}
const number=(v:any,zero=false)=>{if(typeof v!=='string'||!/^\d{1,9}(\.\d{1,6})?$/.test(v)||!Number.isFinite(Number(v))||Number(v)<0||!zero&&Number(v)===0)shipmentFail('مقدار عددی معتبر و مثبت لازم است.');return v;};
const date=(v:any)=>{const d=req(v,10);if(!validDay(d)||d>dayAt())shipmentFail('تاریخ معتبر تا امروز لازم است.');return d;};
export async function shipmentLines(u:any,supplierId:string,input:any[],actual=false,base?:any[]){
 if(!Array.isArray(input)||!input.length||input.length>60||new Set(input.map(l=>l.linkId)).size!==input.length)shipmentFail('۱ تا ۶۰ ردیف کالای غیرتکراری لازم است.');
 const supplier=await supplierEntity(supplierId,'supplier');if(!shipmentVisible(u,supplier.data.route))shipmentFail('مجوز مسیر خرید ندارید.',403);
 const lines=[];for(const raw of input){const link=await supplierEntity(req(raw.linkId),'supplier_material'),m=await supplierEntity(link.data.materialId,'material');if(link.data.supplierId!==supplierId)shipmentFail('کالا به تأمین‌کننده محموله متصل نیست.');const prior=base?.find(l=>l.linkId===link.id);if(base&&!prior)shipmentFail('کالای پکینگ در ثبت سفارش اولیه نیست.');
 const l:any={linkId:link.id,materialId:m.id,code:m.data.code,name:m.data.name,unit:prior?.unit||m.data.unit,generalSpecs:prior?.generalSpecs??m.data.specs??'',supplierSpecs:prior?.supplierSpecs??link.data.supplierSpecs??'',supplierCode:prior?.supplierCode??link.data.supplierCode??'',materialRevision:prior?.materialRevision??m.revision,linkRevision:prior?.linkRevision??link.revision,packaging:req(raw.packaging,500),quantity:number(raw.quantity),unitPrice:number(raw.unitPrice,true)};
 if(!l.generalSpecs||!l.supplierSpecs)shipmentFail('مشخصات عمومی و مشخصات محصول تأمین‌کننده را تکمیل کنید.');
 for(const k of ['netKg','grossKg','volumeM3'])l[k]=number(raw[k]);if(Number(l.grossKg)<Number(l.netKg))shipmentFail('وزن ناخالص کمتر از خالص است.');
 if(!actual)l.prediction=packingPrediction((await shipmentRows()).filter(s=>shipmentVisible(u,s.data.route)),l);lines.push(l);
 }return {supplier,lines};
}
export async function applyShipment(u:any,b:any){
 const id=req(b.id,80),mode=req(b.mode,30);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)||b.confirmed!==true)shipmentFail('شناسه و تأیید صریح لازم است.');
 const db=storage(),signature=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(id).first();if(prior){if(prior.actor!==u.userId||prior.payload!==signature)shipmentFail('شناسه قبلاً استفاده شده است.',409);return {saved:true,repeated:true};}
 const now=new Date().toISOString(),checks:any[]=[],writes:any[]=[];const guard=(e:any)=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN guard ELSE 0 END WHERE id=?').bind(e.id,e.revision,id));
 const put=(eid:string,type:string,data:any,old?:any)=>writes.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,eid,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(eid,type,JSON.stringify(data),now,now));
 let target=id;const notes=req(b.notes,3000);
 if(mode==='specifications'){
 const link=await supplierEntity(req(b.linkId),'supplier_material'),supplier=await supplierEntity(link.data.supplierId,'supplier'),m=await supplierEntity(link.data.materialId,'material');if(!shipmentWrite(u,supplier.data.route))shipmentFail('مجوز بازرگانی مسیر لازم است.',403);if(b.revision!==link.revision||b.materialRevision!==m.revision)shipmentFail('مشخصات تغییر کرده است.',409);guard(link);guard(supplier);guard(m);const generalSpecs=req(b.generalSpecs,10000),supplierSpecs=req(b.supplierSpecs,10000);
 put(id,'purchase_specification',{linkId:link.id,materialId:m.id,supplierId:supplier.id,route:supplier.data.route,generalSpecs,supplierSpecs,previousGeneralSpecs:m.data.specs||'',previousSupplierSpecs:link.data.supplierSpecs||'',day:date(b.day),actor:u.userId,notes});
 if(generalSpecs!==m.data.specs)put(m.id,'material',{...m.data,specs:generalSpecs},m);put(link.id,'supplier_material',{...link.data,supplierSpecs,status:'pending'},link);target=link.id;
 }else{
 const old=b.shipmentId?await shipmentBy(u,req(b.shipmentId)):null;if(old&&b.revision!==old.revision)shipmentFail('پرونده تغییر کرده است.',409);if(old){guard(old);target=old.id;}
 if(mode==='create'){
 if(old)shipmentFail('برای ایجاد محموله جدید شناسه پرونده نفرستید.');const {supplier,lines}=await shipmentLines(u,req(b.supplierId),b.lines);if(!shipmentWrite(u,supplier.data.route))shipmentFail('مجوز بازرگانی مسیر لازم است.',403);guard(supplier);for(const l of lines){guard({id:l.linkId,revision:l.linkRevision});guard({id:l.materialId,revision:l.materialRevision});}
 if(!['IRR','IRT','USD','EUR','CNY'].includes(b.currency))shipmentFail('ارز معتبر لازم است.');put(id,'purchase_shipment',{supplierId:supplier.id,supplierName:supplier.data.name,route:supplier.data.route,currency:b.currency,title:req(b.title,200),reference:req(b.reference,200),state:'draft',initial:{day:date(b.day),lines},history:[{mode,actor:u.userId,at:now,notes}]});
 }else{
 if(!old)shipmentFail('محموله لازم است.');if(!shipmentWrite(u,old.data.route))shipmentFail('مجوز بازرگانی مسیر لازم است.',403);const data={...old.data,history:[...old.data.history,{mode,actor:u.userId,at:now,notes}]},files=[...await supplierRows('shipment_file'),...await supplierRows('foreign_file')];
 const evidence=(kind:string)=>{const f=files.find(f=>f.id===b.documentId&&f.data.shipmentId===old.id&&f.data.kind===kind);if(!f)shipmentFail('مدرک تاریخ‌دار همین مرحله و محموله لازم است.');guard(f);return {id:f!.id,sha256:f!.data.sha256,day:f!.data.issuedOn};};
 if(mode==='register'&&!old.data.registration){data.registration={day:date(b.day),reference:req(b.reference,200),document:evidence('registration'),lines:old.data.initial.lines};data.state=old.data.actual?(old.data.amendments?.length?'amended':'loaded'):'registered';}
 else if(mode==='permit'&&old.data.registration&&!old.data.permit){const day=date(b.day);if(day<old.data.registration.day)shipmentFail('مجوز قبل از ثبت سفارش نیست.');data.permit={day,reference:req(b.reference,200),document:evidence('permit')};data.state=old.data.actual?(old.data.amendments?.length?'amended':'loaded'):'permitted';}
 else if(mode==='historical'&&old.data.state==='draft'){const {lines}=await shipmentLines(u,old.data.supplierId,b.lines,true,old.data.initial.lines);data.actual={day:date(b.day),lines,document:evidence('packing'),historical:true};data.state='loaded';}
 else if(mode==='actual'&&!old.data.actual){const day=date(b.day);const {lines}=await shipmentLines(u,old.data.supplierId,b.lines,true,old.data.initial.lines);data.actual={day,lines,document:evidence('packing')};data.state='loaded';}
 else if(mode==='amend'&&['loaded','amended'].includes(old.data.state)){const day=date(b.day);if(day<old.data.actual.day)shipmentFail('اصلاح قبل از بارگیری نیست.');const amendment={day,reference:req(b.reference,200),document:evidence('registration'),lines:old.data.actual.lines,notes};data.amendments=[...(old.data.amendments||[]),amendment];data.state='amended';}
 else shipmentFail('مرحله با وضعیت فعلی سازگار نیست.',409);put(old.id,'purchase_shipment',data,old);
 }
 }
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'shipment_'+mode,signature,u.userId,now),...checks,...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'shipment_'+mode,JSON.stringify({operationId:id,notes}),now)]);return {saved:true,id:target};
}
