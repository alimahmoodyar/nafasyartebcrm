// Operational projections are independent of finance/cost permissions.
const forbidden=/price|cost|amount|margin|profit|payment|paid|discount|budget|expense|commitment|installment|cashbps|currency|exchange|fxrate|unitnet|minimumNet|productionTerms|salesTerms|financial|contractAmount|signature|wage|fee|rial|usd|^value$|^rate$|^shares$|^closes$/i;
export function factorySafe(value:any):any{
 if(Array.isArray(value))return value.map(factorySafe);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([k])=>!forbidden.test(k)).map(([k,v])=>[k,factorySafe(v)]));
}
export function factoryProject(row:any){
 const d=row.data,keys=['title','customer','contract','contractId','warranty','due','state','ownerId','salesOrderId','agentId','buildIntakeId','specificationPending','customerRequirements','units','requests','movements','times','issues','executionVersion','workerAllocations','productionFinalizedAt','durationDays','promisedAt','actualStart','dailyWorks','semiRequirements'];
 const data:any={};for(const k of keys)if(d[k]!==undefined)data[k]=factorySafe(d[k]);
 data.history=(d.history||[]).filter((h:any)=>['customer_specification_approved','start','assign_work','report_work','reserve','issue','request','consume','return','scrap','quality'].includes(h.mode)).map(factorySafe);
 return {id:row.id,type:row.type,revision:row.revision,created:row.created,updated:row.updated,data};
}

export function factoryRecord(d:any){const keys=['id','code','name','model','group','partCode','part','partName','unit','kind','status','expiry','quantity','productionMode','series','brand','batchCode','materialId','productId','created','warehouseId'];return Object.fromEntries(keys.filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));}
