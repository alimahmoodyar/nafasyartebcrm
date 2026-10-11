import {storage} from './storage';
import {guaranteeRoles,gFail,gText} from './guarantees';
export function contractNumber(value:string){return value.trim().replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));}
export function matchingContract(rows:any[],number:string){const matches=rows.filter(r=>r.type==='business_contract'&&contractNumber(r.data.number)===contractNumber(number));return {state:matches.length===1?'matched':matches.length>1?'ambiguous':'missing',record:matches.length===1?matches[0]:null};}
export async function saveBusinessContract(u:any,b:any){
 const db=storage(),memberSnapshot:any=await db.prepare("SELECT json_group_array(json_object('id',id,'status',status,'permissions',permissions,'subject',subject)) AS value FROM (SELECT * FROM app_members ORDER BY id)").first(),roleRows=await db.prepare("SELECT id,revision FROM flow_entities WHERE type='position'").all();
 const roles=await guaranteeRoles(u);if(!roles.treasury&&!roles.manager)gFail('نقش مجاز ثبت قرارداد لازم است.',403);
 if(b.confirmed!==true||! /^[a-f0-9-]{36}$/i.test(b.id))gFail('تأیید و شناسه عملیات لازم است.');
 const payload=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();
 const number=contractNumber(gText(b.number,200)),title=gText(b.title,200),party=gText(b.party,200),notes=gText(b.notes,4000),now=new Date().toISOString();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(number)),id='contract:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 if(prior){if(prior.actor!==u.userId||prior.payload!==payload)gFail('شناسه عملیات تکراری است.',409);return {id,repeated:true};}
 if(await db.prepare('SELECT id FROM flow_entities WHERE id=?').bind(id).first())gFail('این شماره قرارداد قبلاً ثبت شده است.',409);
 const data=JSON.stringify({number,title,party,notes,createdBy:u.userId});
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(b.id,'business_contract_save',payload,u.userId,now),db.prepare("UPDATE inventory_operations SET guard=CASE WHEN (SELECT json_group_array(json_object('id',id,'status',status,'permissions',permissions,'subject',subject)) FROM (SELECT * FROM app_members ORDER BY id))=? THEN 1 ELSE 0 END WHERE id=?").bind(memberSnapshot.value,b.id),...(roleRows.results as any[]).map(r=>db.prepare('UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN 1 ELSE 0 END WHERE id=?').bind(r.id,r.revision,b.id)),db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'business_contract',?,1,?,?)").bind(id,data,now,now),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'business_contract_save',data,now)]);
 return {id,saved:true};
}
