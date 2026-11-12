import {storage} from './storage';
import {fail} from './after-sales';
import {transportScanMatches,type TransportScanItem} from './transport-scan-contract';
export async function transportScanItems(items:TransportScanItem[]){
 const db=storage(),batches=new Map<string,any>(),ids=JSON.stringify([...new Set(items.map(item=>item.batchId).filter(Boolean))]);
 if(ids!=='[]'){
  const receipts=await db.prepare("SELECT id,data FROM flow_entities WHERE type='receipt' AND id IN (SELECT value FROM json_each(?))").bind(ids).all();
  const records=await db.prepare("SELECT id,payload FROM records WHERE kind='batch' AND id IN (SELECT value FROM json_each(?))").bind(ids).all();
  for(const row of records.results as any[])batches.set(row.id,JSON.parse(row.payload));
  for(const row of receipts.results as any[])batches.set(row.id,JSON.parse(row.data));
 }
 return items.map(item=>{const batch=batches.get(item.batchId||'')||{};return {...item,batchCode:batch.code||item.batchCode||'',name:item.name||batch.part||item.model||item.partCode||''}});
}
export async function checkTransportScans(items:TransportScanItem[],input:unknown){
 if(!Array.isArray(input)||input.length>100||input.some(code=>typeof code!=='string'||!code.trim()||code.length>3000))fail('فهرست اسکن معتبر نیست.');
 const resolved=await transportScanItems(items),seen=new Set<number>();
 return (input as string[]).map(code=>{const matches=transportScanMatches(resolved,code);if(matches.length!==1)fail(matches.length?'کد کالا به چند ردیف می‌خورد؛ سریال یا بچ را اسکن کنید.':'کد اسکن‌شده در این مأموریت نیست.');const index=matches[0];if(seen.has(index))fail('یک قلم مأموریت دوباره اسکن شده است.');seen.add(index);const item=resolved[index];return {index,code,serial:item.serial||'',partCode:item.partCode||'',batchId:item.batchId||'',quantity:item.quantity||0}});
}
