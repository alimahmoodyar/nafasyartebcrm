import type {PostingLine} from './accounting-contract';

const registries:Record<string,string[]>={party:['supplier','sales_agent','as_agent','party'],bank:['treasury_account','sales_receiving_account'],project:['build_project'],contract:['business_contract','as_service_contract'],asset:['asset_item']};
export async function accountingDetailChoices(db:D1Database,kind:string,query:string){
 const q=query.slice(0,120);if(kind==='employee')return (await db.prepare("SELECT id,title FROM (SELECT id,json_extract(data,'$.name') title FROM flow_entities WHERE type='hr_employee' UNION ALL SELECT id,name title FROM app_members m WHERE NOT EXISTS(SELECT 1 FROM flow_entities e WHERE e.type='hr_employee' AND json_extract(e.data,'$.memberId')=m.id)) WHERE (?='' OR instr(lower(title),lower(?))>0) ORDER BY title,id LIMIT 50").bind(q,q).all()).results;
 const types=registries[kind];if(!types)throw Error('نوع تفصیل معتبر نیست.');return (await db.prepare("SELECT id,type,coalesce(json_extract(data,'$.name'),json_extract(data,'$.title'),json_extract(data,'$.number'),json_extract(data,'$.contractNumber'),id) title FROM flow_entities WHERE type IN ("+types.map(()=>'?').join(',')+") AND (?='' OR instr(lower(data),lower(?))>0) ORDER BY title,id LIMIT 50").bind(...types,q,q).all()).results;
}
export type DetailGuard={condition:string;args:any[]};
/** Resolve the existing master identity, never create a parallel financial party. */
export async function validateDetailReferences(db:D1Database,lines:PostingLine[],accounts:any[]):Promise<DetailGuard[]>{
 const checks:DetailGuard[]=[],seen=new Set<string>();
 for(const line of lines){const account=accounts.find(a=>a.id===line.accountId);if(!account)throw Error('حساب تفصیل پیدا نشد.');const schema=typeof account.details==='string'?JSON.parse(account.details):account.details;
  for(let i=0;i<3;i++){const id=line.details[i],kind=schema[i]?.kind;if(!id)continue;const key=kind+':'+id;if(seen.has(key))continue;seen.add(key);
   if(typeof id!=='string'||id.length>300)throw Error('شناسه تفصیل معتبر نیست.');
   if(kind==='employee'){const person:any=await db.prepare("SELECT id,revision FROM flow_entities WHERE id=? AND type='hr_employee'").bind(id).first();if(person)checks.push({condition:"EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='hr_employee' AND revision=?)",args:[id,person.revision]});else{const row:any=await db.prepare('SELECT id,revision FROM app_members WHERE id=?').bind(id).first();if(!row)throw Error('تفصیل پرسنل باید به فرد ثبت‌شده متصل باشد.');checks.push({condition:'EXISTS(SELECT 1 FROM app_members WHERE id=? AND revision=?)',args:[id,row.revision]});}}
   else {const types=registries[kind];if(!types)throw Error('نوع تفصیل پشتیبانی نمی‌شود.');const row:any=await db.prepare('SELECT type,revision FROM flow_entities WHERE id=? AND type IN ('+types.map(()=>'?').join(',')+')').bind(id,...types).first();if(!row)throw Error('تفصیل '+(i+1)+' با نوع '+kind+' در اطلاعات پایه پیدا نشد.');checks.push({condition:'EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type=? AND revision=?)',args:[id,row.type,row.revision]});}
  }
 }
 return checks;
}
