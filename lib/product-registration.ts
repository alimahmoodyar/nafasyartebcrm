import {AccessError} from './authorization';

const sequenceId='product-code-sequence:v1';
const limit=999999999;
const internalCode="('PRD-'||json_extract(data,'$.last'))";
const numberedProducts=`
 SELECT id AS product_id FROM records WHERE kind='product' AND id GLOB 'product:PRD-*'
 UNION ALL
 SELECT target FROM access_audit WHERE action IN ('create_record','delete_record') AND target GLOB 'product:PRD-*'`;
const firstNumber=`(SELECT MAX(1000,COALESCE(MAX(CAST(substr(product_id,13) AS INTEGER)),0))+1
 FROM (${numberedProducts}) WHERE length(substr(product_id,13)) BETWEEN 1 AND 9
 AND substr(product_id,13) NOT GLOB '*[^0-9]*')`;

function registrationSignature(data:Record<string,string>){
 return JSON.stringify(Object.fromEntries(Object.entries(data).filter(([key])=>key!=='code').sort(([a],[b])=>a.localeCompare(b))));
}

export async function registerProduct(db:D1Database,actorId:string,data:Record<string,string>,requestedId:unknown){
 if(requestedId!==undefined&&(typeof requestedId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId)))
  throw new AccessError('شناسه ثبت محصول معتبر نیست.',400);
 const operationId='create-product:'+String(requestedId??crypto.randomUUID()).toLowerCase();
 const signature=registrationSignature(data);

 async function saved(){
  const prior=await db.prepare("SELECT actor,target,after FROM access_audit WHERE id=? AND action='create_record'").bind(operationId).first<{actor:string;target:string;after:string}>();
  if(!prior)return null;
  const original=JSON.parse(prior.after);
  if(prior.actor!==actorId||registrationSignature(original.data)!==signature)
   throw new AccessError('شناسه ثبت محصول برای حساب یا اطلاعات دیگری استفاده شده است.',409);
  const current=await db.prepare("SELECT id,payload,created FROM records WHERE id=? AND kind='product'").bind(prior.target).first<{id:string;payload:string;created:string}>();
  if(!current)throw new AccessError('این ثبت قبلاً انجام شده و محصول دیگر در فهرست موجود نیست.',409);
  return {id:current.id,kind:'product',data:JSON.parse(current.payload),created:current.created};
 }

 const prior=await saved();
 if(prior)return {record:prior,replayed:true};

 const now=new Date().toISOString();
 const currentAllocation="id=? AND type='product_code_sequence' AND json_extract(data,'$.operationId')=? AND json_extract(data,'$.last') BETWEEN 1001 AND "+limit;
 try{
  const writes=await db.batch([
   db.prepare(`INSERT INTO flow_entities(id,type,data,revision,created,updated)
    VALUES(?,'product_code_sequence',json_object('last',CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=?) THEN 1001 ELSE ${firstNumber} END,'operationId',?),1,?,?)
    ON CONFLICT(id) DO UPDATE SET data=json_object('last',json_extract(flow_entities.data,'$.last')+1,'operationId',?),
    revision=flow_entities.revision+1,updated=excluded.updated
    WHERE flow_entities.type='product_code_sequence' AND json_extract(flow_entities.data,'$.last') BETWEEN 1000 AND ?`)
    .bind(sequenceId,sequenceId,operationId,now,now,operationId,limit-1),
   db.prepare(`INSERT INTO records(id,kind,payload,created)
    SELECT 'product:'||${internalCode},'product',json_set(?,'$.code',${internalCode}),? FROM flow_entities WHERE ${currentAllocation}`)
    .bind(JSON.stringify(data),now,sequenceId,operationId),
   db.prepare(`INSERT INTO access_audit(id,actor,target,action,after,at)
    SELECT ?,?,r.id,'create_record',json_object('id',r.id,'kind',r.kind,'data',json(r.payload),'created',r.created),?
    FROM flow_entities s JOIN records r ON r.id='product:'||('PRD-'||json_extract(s.data,'$.last'))
    WHERE s.id=? AND s.type='product_code_sequence' AND json_extract(s.data,'$.operationId')=?
    AND json_extract(s.data,'$.last') BETWEEN 1001 AND ${limit}`).bind(operationId,actorId,now,sequenceId,operationId)
  ]);
  if(!writes[1].meta.changes)throw new AccessError('شمارنده کد محصول نیازمند بررسی است.',409);
  const record=await saved();
  if(!record)throw new AccessError('نتیجه ثبت محصول دریافت نشد؛ با همان اطلاعات دوباره تلاش کنید.',503);
  return {record,replayed:false};
 }catch(error){
  // A concurrent retry of the same request rolls back the second allocation on the audit primary key.
  if(/UNIQUE|constraint/i.test(String(error))){
   const replay=await saved();
   if(replay)return {record:replay,replayed:true};
  }
  throw error;
 }
}
