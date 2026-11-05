import {requireAccess,checkOrigin,AccessError,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {storage} from '@/lib/storage';
import {supplyLock} from '@/lib/sourcing';
import {warehouseDeletionPlan} from '@/lib/warehouse-deletion';
const json=(value:any)=>Response.json(value,{headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}});
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
export async function GET(request:Request){try{
 const u=await requireAccess();if(!u.isAdmin)fail('حذف و بررسی انبار فقط برای مدیر سامانه مجاز است.',403);
 const id=new URL(request.url).searchParams.get('warehouseId')||'';if(!id||id.length>200)fail('انبار را انتخاب کنید.');
 return json((await warehouseDeletionPlan(id)).review);
}catch(e){return accessResponse(e)||Response.json({error:'بررسی حذف انبار ممکن نشد.'},{status:503});}}
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();if(!u.isAdmin)fail('حذف انبار فقط برای مدیر سامانه مجاز است.',403);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,4000)));
 if(typeof b.id!=='string'||! /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(b.id)||typeof b.warehouseId!=='string'||!b.warehouseId||b.warehouseId.length>200||!Number.isInteger(b.revision)||b.revision<1||b.confirmed!==true)fail('شناسه، نسخه و تأیید صریح حذف انبار لازم است.');
 const db=storage(),signature=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(b.id).first();
 if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه عملیات قبلاً برای درخواست دیگری استفاده شده است.',409);return json({saved:true,deleted:true,repeated:true});}
 const plan=await warehouseDeletionPlan(b.warehouseId);if(plan.warehouse.revision!==b.revision||plan.review.deleted)fail('تعریف انبار تغییر کرده یا قبلاً حذف شده است؛ صفحه را تازه کنید.',409);
 if(!plan.review.canDelete)fail(plan.review.blockers.join(' '),409);
 const now=new Date().toISOString(),checks=await supplyLock(db,b.id),writes:D1PreparedStatement[]=[];
 const guard=(condition:string,...args:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+condition+' THEN guard ELSE 0 END WHERE id=?').bind(...args,b.id));
 for(const c of plan.checks)guard('NOT ('+c.sql+')',...c.args);
 for(const w of [...plan.targets,...plan.unlink])guard("EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='material_warehouse' AND revision=?)",w.id,w.revision);
 for(const w of plan.targets){const data={...w.data,active:false,directReceiptEnabled:false,deletedAt:now,deletedBy:u.userId,deletionOperationId:b.id};writes.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,w.id,w.revision),db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,w.id,'delete_empty_warehouse',JSON.stringify(w.data),JSON.stringify(data),now));}
 for(const w of plan.unlink){const data={...w.data,quarantineWarehouseId:''};writes.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,w.id,w.revision),db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,w.id,'unlink_deleted_quarantine',JSON.stringify(w.data),JSON.stringify(data),now));}
 await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'warehouse_delete',?,?,?,1)").bind(b.id,signature,u.userId,now),...checks,...writes]);
 return json({saved:true,deleted:true,warehouseIds:plan.targets.map(w=>w.id)});
}catch(e){const denied=accessResponse(e);if(denied)return denied;return Response.json({error:'حذف ثبت نشد؛ موجودی یا وضعیت انبار هم‌زمان تغییر کرده است. صفحه را تازه کنید.'},{status:409});}}
