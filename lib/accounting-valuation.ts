import {moneyMicro,moneyText} from './costing';
type Allocation={kind:'inventory'|'wip'|'finished'|'cogs'|'expense'|'derecognized';amount:string;dimensions:Record<string,string>};
const pooled=(stage:string)=>['raw','semi','line'].includes(stage)||['worker:','project:','warehouse_transit:'].some(prefix=>stage.startsWith(prefix));
const parse=(v:any)=>typeof v==='string'?JSON.parse(v):v;
/** Analytic propagation of ONE receipt's contribution. Other receipts contribute quantity,
 * not a fictitious zero actual price. Sum conservation is checked before any posting. */
function replayReceiptValue(src:any,batchId:string,amount:string,projection:Map<string,bigint>){
 const root=src.batches.find((b:any)=>b.id===batchId);if(!root)throw Error('بچ مبنای ارزش پیدا نشد.');const rootQuantity=root.quantity;if(!Number.isSafeInteger(rootQuantity)||rootQuantity<=0)throw Error('مقدار مبنای ارزش معتبر نیست.');const original=moneyMicro(amount),pools=new Map<string,{q:number;v:bigint}>(),devices=new Map<string,bigint>(),derecognized=new Map<string,bigint>(),heldReturns=new Map<string,bigint>();let entered=BigInt(0),enteredQuantity=0;
 const entities=src.entities.map((e:any)=>({...e,data:parse(e.data)}));const batches=new Map<string,any>(src.batches.map((b:any)=>[b.id,b]));const byOperation=new Map<string,any[]>();for(const e of src.entries){const rows=byOperation.get(e.operation_id)||[];rows.push(e);byOperation.set(e.operation_id,rows);}
 const lots=new Map<string,any>(entities.filter((e:any)=>e.type==='routine_lot').map((e:any)=>[e.id,e.data]));
 const jobs=new Map<string,any>(entities.filter((e:any)=>e.type==='routine_job').map((e:any)=>[e.id,e.data]));
 const outputs=new Map<string,any>(entities.filter((e:any)=>e.type==='worker_output').map((e:any)=>[e.id,e.data]));
 const batchLot=(b:any)=>b?.routineLotId||jobs.get(b?.routineJobId)?.lotId||'';
 const lotInputs=new Map<string,bigint>(),lotInjected=new Map<string,bigint>(),quarantined=new Map<string,{q:number;v:bigint}>();
 const outputEntries=new Map<string,any[]>();
 for(const op of src.operations){if(!['routine_quality','worker_receive_output','flow_routine_output'].includes(op.kind))continue;for(const e of byOperation.get(op.id)||[]){const lotId=batchLot(batches.get(e.item_id));if(e.delta>0&&lotId&&(pooled(e.warehouse)||e.warehouse==='quarantine')){const rows=outputEntries.get(lotId)||[];rows.push({...e,key:op.id+':'+e.item_id+':'+e.warehouse});outputEntries.set(lotId,rows);}}}
 for(const op of [...src.operations].sort((a:any,b:any)=>a.created.localeCompare(b.created)||a.sequence-b.sequence)){
  const entries=byOperation.get(op.id)||[],body=parse(op.payload),groups=new Map<string,{delta:number;entries:any[]}>();for(const e of entries){const batch=batches.get(e.item_id);if(!batch||!pooled(e.warehouse))continue;const key=batch.partCode+'|'+batch.unit,g=groups.get(key)||{delta:0,entries:[]};g.delta+=e.delta;g.entries.push(e);groups.set(key,g);}
  let consumed=BigInt(0);const positive:any[]=[];
  for(const [key,g]of groups){if(!g.delta)continue;const pool=pools.get(key)||{q:0,v:BigInt(0)};if(g.delta<0){const quantity=-g.delta;if(pool.q<quantity)throw Error('توالی موجودی برای محاسبه میانگین ناقص است: '+key);const value=quantity===pool.q?pool.v:pool.v*BigInt(quantity)/BigInt(pool.q);pool.q-=quantity;pool.v-=value;if(value>BigInt(0)&&entries.some((e:any)=>e.delta>0&&batches.has(e.item_id)&&!pooled(e.warehouse)&&!e.warehouse.startsWith('supplier_return:')))throw Error('تعیین ارزش جابه‌جایی نامنطبق یا ضایعات به رسیدگی مالی نیاز دارد: '+op.id);consumed+=value;}else positive.push({key,g,pool});pools.set(key,pool);}
  const outputKinds=['flow_routine_output','routine_output','worker_receive_output'];const manufactured=outputKinds.includes(op.kind);
  const job=jobs.get(body.jobId),output=outputs.get(body.outputId||body.id),lotId=body.lotId||job?.lotId||output?.lotId||entities.find((e:any)=>e.type==='routine_lot'&&(e.data.movements||[]).some((m:any)=>m.operationId===op.id))?.id;
  const nativeLot=manufactured&&lotId&&lots.has(lotId);
  if(nativeLot){lotInputs.set(lotId,(lotInputs.get(lotId)||BigInt(0))+consumed);consumed=BigInt(0);}
  if(consumed>BigInt(0)&&op.kind==='purchase_return_dispatch'){const key=body.returnId||op.id;heldReturns.set(key,(heldReturns.get(key)||BigInt(0))+consumed);consumed=BigInt(0);}
  if(op.kind==='purchase_return_accept_return'){const key=body.returnId||op.id,held=heldReturns.get(key)||BigInt(0);heldReturns.delete(key);derecognized.set(key,(derecognized.get(key)||BigInt(0))+held);}
  if(consumed>BigInt(0)&&op.kind==='purchase_return_accept_return'){const key=body.returnId||op.id;derecognized.set(key,(derecognized.get(key)||BigInt(0))+consumed);consumed=BigInt(0);}
  if(consumed>BigInt(0)&&!manufactured){let did=body.deviceId||src.orders.find((o:any)=>o.id===body.orderId)?.device_id||'';
   if(!did&&['project_finalize','project_execution_finalize'].includes(op.kind)){for(const project of entities.filter((e:any)=>e.type==='build_project')){const links=(project.data.movements||[]).filter((m:any)=>m.operationId===op.id&&m.kind==='consume');const units=[...new Set(links.map((m:any)=>m.unitId))];if(units.length===1)did=project.data.units?.find((u:any)=>u.id===units[0])?.deviceId||'';}}
   if(!did||!['flow_build','flow_repair','finish','worker_receive_finished','project_finalize','project_execution_finalize'].includes(op.kind))throw Error('مصرف با تبار نامشخص نیازمند رسیدگی مالی است: '+op.id);devices.set(did,(devices.get(did)||BigInt(0))+consumed);
  }
  if(manufactured&&consumed>BigInt(0)&&positive.length!==1)throw Error('خروجی ساخت چندگانه یا نامشخص نیازمند تخصیص مستند است.');
  for(const {key,g,pool}of positive){let value=manufactured?consumed:BigInt(0);for(const e of g.entries.filter((e:any)=>e.delta>0)){
   const projected=projection.get(op.id+':'+e.item_id+':'+e.warehouse)||BigInt(0);if(projected){value+=projected;const lid=batchLot(batches.get(e.item_id));lotInjected.set(lid,(lotInjected.get(lid)||BigInt(0))+projected);}
   const quarantine=entries.filter((x:any)=>x.item_id===e.item_id&&x.warehouse==='quarantine'&&x.delta<0).reduce((n:number,x:any)=>n-x.delta,0);
   if(e.item_id===batchId&&quarantine){const q=Math.min(e.delta,quarantine);enteredQuantity+=q;if(enteredQuantity>rootQuantity)throw Error('ورود تکراری ارزش بچ به موجودی قابل مصرف.');const next=original*BigInt(enteredQuantity)/BigInt(rootQuantity);value+=next-entered;entered=next;}
   else if(quarantine){const held=quarantined.get(e.item_id);if(held){const q=Math.min(e.delta,quarantine);if(q>held.q)throw Error('تبار آزادسازی خروجی ساخت ناقص است.');const take=q===held.q?held.v:held.v*BigInt(q)/BigInt(held.q);value+=take;held.q-=q;held.v-=take;}}
  }
   pool.q+=g.delta;pool.v+=value;pools.set(key,pool);
  }
  for(const e of entries.filter((e:any)=>e.delta>0&&e.warehouse==='quarantine')){const projected=projection.get(op.id+':'+e.item_id+':'+e.warehouse)||BigInt(0);if(projected){const old=quarantined.get(e.item_id)||{q:0,v:BigInt(0)};old.q+=e.delta;old.v+=projected;quarantined.set(e.item_id,old);const lid=batchLot(batches.get(e.item_id));lotInjected.set(lid,(lotInjected.get(lid)||BigInt(0))+projected);}}
 }
 const nextProjection=new Map<string,bigint>();
 for(const [lid,value]of lotInputs){if(value===BigInt(0))continue;const lot=lots.get(lid),rows=outputEntries.get(lid)||[];
  if(!lot.cost){const outputIds=new Set(rows.map(r=>r.item_id));if(src.operations.some((op:any)=>{const es=byOperation.get(op.id)||[];return es.some((e:any)=>outputIds.has(e.item_id)&&e.delta<0&&es.filter((x:any)=>x.item_id===e.item_id).reduce((n:number,x:any)=>n+x.delta,0)<0)}))throw Error('بهای بچ نیمه‌ساخته پیش از مصرف خروجی باید در مالی تأیید شود: '+lid);continue;}
  const quantity=rows.reduce((n:number,r:any)=>n+r.delta,0);if(!quantity||quantity!==lot.received*1000||lot.pending||lot.ready?.some((n:number)=>n)||lot.rework?.some((n:number)=>n))throw Error('تبار مقدار خروجی بچ مصوب کامل نیست: '+lid);
  let assigned=BigInt(0);rows.forEach((r:any,i:number)=>{const v=i===rows.length-1?value-assigned:value*BigInt(r.delta)/BigInt(quantity);assigned+=v;nextProjection.set(r.key,v);});
 }
 const result:Allocation[]=[];const add=(kind:Allocation['kind'],value:bigint,dimensions:Record<string,string>)=>{if(value>BigInt(0))result.push({kind,amount:moneyText(value),dimensions:{batch:batchId,...dimensions}});};
 add('inventory',original-entered,{custody:'quarantine'});for(const [pool,value]of pools)add('inventory',value.v,{pool});for(const [id,value]of quarantined)add('inventory',value.v,{producedBatch:id,custody:'quarantine'});
 for(const [lid,value]of lotInputs){const remaining=value-(lotInjected.get(lid)||BigInt(0));if(remaining<BigInt(0))continue;add('wip',remaining,{routineLot:lid});}
 for(const [did,value]of devices){const build=entities.find((e:any)=>e.type==='build'&&e.id===did),sale=entities.find((e:any)=>e.type==='sale'&&(e.data.deviceIds||[]).includes(did)&&e.id===build?.data.saleId),invoice=entities.find((e:any)=>e.type==='sales_invoice'&&e.id===sale?.data.invoiceId);
  if(build?.data.state==='delivered'){if(!sale||!invoice||!invoice.data.reference?.trim()||invoice.data.voided||invoice.data.openingId||!(sale.data.state==='delivered'||sale.data.handedOverDeviceIds?.includes(did)))throw Error('فاکتور معتبر و تأیید تحویل برای شناسایی فروش این سریال کامل نیست: '+did);add('cogs',value,{device:did,sale:sale.id,invoice:invoice.id});}
  else {const finished=src.entries.some((e:any)=>e.item_id===did&&e.delta>0&&['line_finished','product_transit','finished','in_transit'].includes(e.warehouse));add(finished?'finished':'wip',value,{device:did});}
 }
 for(const [reference,value]of heldReturns)add('inventory',value,{return:reference,custody:'supplier_return'});
 for(const [reference,value]of derecognized)add('derecognized',value,{return:reference});
 return {result,nextProjection};
}

/** Closed routine lots redistribute only this receipt's material contribution.
 * Labor/overhead retain their separate source; no full semi cost is counted twice. */
export function traceReceiptValue(src:any,batchId:string,amount:string):Allocation[]{
 let projection=new Map<string,bigint>();
 const signature=(map:Map<string,bigint>)=>JSON.stringify([...map].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,v.toString()]));
 for(let pass=0;pass<32;pass++){const {result,nextProjection}=replayReceiptValue(src,batchId,amount,projection);if(signature(projection)===signature(nextProjection)){if(result.reduce((n,a)=>n+moneyMicro(a.amount),BigInt(0))!==moneyMicro(amount))throw Error('تبار ارزش با مبلغ مبنا تراز نیست.');return result;}projection=nextProjection;}
 throw Error('چرخه یا عمق نامعتبر در تبار تولید نیمه‌ساخته؛ رسیدگی مالی لازم است.');
}

/** Bounded, ordered pages; a large/legacy trace becomes an explicit exception. */
export async function valuationSources(db:D1Database){
 async function page(query:string){const out:any[]=[];let offset=0;for(;;){const rows=(await db.prepare(query+' LIMIT 500 OFFSET ?').bind(offset).all()).results as any[];out.push(...rows);if(out.length>50000)throw Error('حجم تبار بیش از محدوده پردازش است؛ رسیدگی مالی لازم است.');if(rows.length<500)return out;offset+=500;}}
 const [batches,entries,operations,entities,orders]=await Promise.all([
  page("SELECT b.batch_id id,b.part_code partCode,b.unit,json_extract(r.payload,'$.routineLotId') routineLotId,json_extract(r.payload,'$.routineJobId') routineJobId,json_extract(r.payload,'$.quantity') quantity FROM inventory_batches b JOIN records r ON r.id=b.batch_id ORDER BY b.batch_id"),page('SELECT * FROM inventory_entries ORDER BY id'),page("SELECT rowid sequence,id,kind,created,json_object('deviceId',json_extract(payload,'$.deviceId'),'orderId',json_extract(payload,'$.orderId'),'projectId',json_extract(payload,'$.projectId'),'unitId',json_extract(payload,'$.unitId'),'jobId',json_extract(payload,'$.jobId'),'lotId',json_extract(payload,'$.lotId'),'outputId',json_extract(payload,'$.outputId'),'returnId',json_extract(payload,'$.returnId')) payload FROM inventory_operations WHERE EXISTS(SELECT 1 FROM inventory_entries e WHERE e.operation_id=inventory_operations.id) ORDER BY rowid"),page("SELECT id,type,json_object('state',json_extract(data,'$.state'),'saleId',json_extract(data,'$.saleId'),'invoiceId',json_extract(data,'$.invoiceId'),'deviceIds',json_extract(data,'$.deviceIds'),'handedOverDeviceIds',json_extract(data,'$.handedOverDeviceIds'),'reference',json_extract(data,'$.reference'),'voided',json_extract(data,'$.voided'),'openingId',json_extract(data,'$.openingId'),'units',json_extract(data,'$.units'),'movements',json_extract(data,'$.movements'),'received',json_extract(data,'$.received'),'pending',json_extract(data,'$.pending'),'ready',json_extract(data,'$.ready'),'rework',json_extract(data,'$.rework'),'cost',CASE WHEN json_extract(data,'$.cost') IS NOT NULL THEN 1 END,'lotId',json_extract(data,'$.lotId'),'jobId',json_extract(data,'$.jobId')) data,revision FROM flow_entities WHERE type IN ('build','sale','sales_invoice','build_project','routine_lot','routine_job','worker_output') ORDER BY id"),page('SELECT id,device_id FROM production_orders ORDER BY id')]);
 return {batches:batches.map(b=>({...b,quantity:Math.round(Number(b.quantity)*1000)})),entries,operations,entities,orders};
}

/** Pre-invoice credits cancel the unbilled quantity at its established basis.
 * That settled portion is frozen while the later invoice values the surviving goods. */
export function valueForPosition(src:any,position:any,amount=position.amount):Allocation[]{const raw=traceReceiptValue(src,position.receiptId,amount),fixed=position.frozenReturns||[];if(!fixed.length)return raw;const keys=new Set(fixed.map((f:any)=>f.returnId)),frozen=fixed.reduce((n:bigint,f:any)=>n+moneyMicro(f.amount),BigInt(0)),total=moneyMicro(amount);if(frozen>total)throw Error('ارزش تثبیت‌شده برگشت از مبنای کل بیشتر است.');const rest=raw.filter(a=>!(a.kind==='derecognized'&&keys.has(a.dimensions.return))),weight=rest.reduce((n,a)=>n+moneyMicro(a.amount),BigInt(0)),remaining=total-frozen;if(!weight&&remaining>BigInt(0))throw Error('مقدار باقی‌مانده برای ارزش‌گذاری پیدا نشد.');let assigned=BigInt(0);const result=rest.map((a,i)=>{const value=i===rest.length-1?remaining-assigned:remaining*moneyMicro(a.amount)/weight;assigned+=value;return {...a,amount:moneyText(value)}});for(const f of fixed)result.push({kind:'derecognized',amount:f.amount,dimensions:{batch:position.receiptId,return:f.returnId}});return result.filter(a=>moneyMicro(a.amount)>BigInt(0));}
