import {storage} from './storage';
import {AccessError} from './authorization';
import {shortageSnapshot} from './replenishment';
import {scaled} from './production';
import {dayAt} from './duties';

const flowMark="SELECT COUNT(*) n,COALESCE(SUM(revision),0) revision FROM flow_entities WHERE id<>'sourcing-lock'";
const entriesMark='SELECT COUNT(*) n FROM inventory_entries';
const batchesMark="SELECT COALESCE(json_group_array(json_object('id',id,'payload',payload)),'[]') signature FROM (SELECT id,payload FROM records WHERE kind='batch' AND json_extract(payload,'$.partCode')=? AND json_extract(payload,'$.unit')=? ORDER BY id)";
export async function directPurchasePreview(material:any,input:unknown){
 let entered:number;try{entered=scaled(input);}catch(e){throw new AccessError((e as Error).message,400);}
 const db=storage(),flow:any=await db.prepare(flowMark).first(),entries:any=await db.prepare(entriesMark).first(),batches:any=await db.prepare(batchesMark).bind(material.data.code,material.data.unit).first();
 const stock=await shortageSnapshot(material),free=stock.free,deducted=Math.min(entered,free),snapshot={materialId:material.id,materialRevision:material.revision,unit:material.data.unit,enteredQuantity:entered,freeStock:free,deductedQuantity:deducted,afterDeduction:entered-deducted,stock:stock.stock,reserved:stock.reserved,production:stock.production,incoming:stock.incoming,quarantine:stock.quarantine,asOf:new Date().toISOString()};
 const basis={materialId:material.id,revision:material.revision,day:dayAt(),entered,free,fingerprint:stock.fingerprint};
 const token=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(basis))))).map(n=>n.toString(16).padStart(2,'0')).join('');
 return {snapshot,token,marker:{flow,entries,batches:batches.signature,code:material.data.code,unit:material.data.unit}};
}
export async function manualPurchaseDecision(material:any,body:any,actor:string,at:string){
 const mode=body.stockTreatment??'full';if(!['full','subtract'].includes(mode))throw new AccessError('روش ارسال مقدار درخواست معتبر نیست.',400);
 const preview=await directPurchasePreview(material,body.quantity);
 if(mode==='subtract'&&body.stockPreviewToken!==preview.token)throw new AccessError('موجودی یا مقدار درخواست تغییر کرده است؛ پیشنهاد موجودی را تازه و دوباره تأیید کنید.',409);
 const finalQuantity=mode==='subtract'?preview.snapshot.afterDeduction:preview.snapshot.enteredQuantity;
 if(finalQuantity<=0)throw new AccessError('با کسر موجودی، مقدار خرید صفر می‌شود؛ درخواست خرید ارسال نشد. برای خرید اضافه، گزینه ارسال همان مقدار را انتخاب کنید.',400);
 return {...preview,finalQuantity,decision:{...preview.snapshot,stockTreatment:mode,deductedQuantity:mode==='subtract'?preview.snapshot.deductedQuantity:0,finalQuantity,by:actor,at}};
}
// Guards execute before business writes and after the existing sourcing-lock update.
// The global lock row is excluded from the flow marker; normal inventory movement
// and concurrent reservations/QC/material changes must invalidate the snapshot.
export function directPurchaseGuards(db:D1Database,id:string,m:Awaited<ReturnType<typeof directPurchasePreview>>['marker']){return [
 db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT COUNT(*) FROM flow_entities WHERE id<>'sourcing-lock')=? AND (SELECT COALESCE(SUM(revision),0) FROM flow_entities WHERE id<>'sourcing-lock')=? AND (SELECT COUNT(*) FROM inventory_entries)=? THEN guard ELSE 0 END WHERE id=?").bind(m.flow.n,m.flow.revision,m.entries.n,id),
 db.prepare("UPDATE inventory_operations SET guard=CASE WHEN ("+batchesMark.replace(' signature FROM',' FROM')+")=? THEN guard ELSE 0 END WHERE id=?").bind(m.code,m.unit,m.batches,id)
 ];}
