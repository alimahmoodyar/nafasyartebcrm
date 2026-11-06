import {syncInventoryCounts} from '@/lib/inventory-counts';
import {requireRealAdmin,accessResponse,AccessError,checkOrigin} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {roleProfiles,materialProfileWork,type ProfileWork} from '@/lib/role-profiles';
import {coverage,nextWork} from '@/lib/sourcing';

export async function GET(request:Request){try{
 await requireRealAdmin();await syncInventoryCounts();
 const id=new URL(request.url).searchParams.get('profile');
 const profile=id?roleProfiles.find(p=>p.id===id):undefined;
 if(id&&!profile)throw new AccessError('پروفایل جایگاه پیدا نشد.',404);
 const json=(value:unknown)=>Response.json(value,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 if(!profile)return json({profiles:roleProfiles});
 if(!profile.operational)return json({profile,work:[],unverified:[],personalPreview:true});
 const db=storage(),rows=(await db.prepare("SELECT id,type,data FROM flow_entities WHERE type IN ('receipt','request','sourcing_plan','sourcing_quote','purchase_order','worker_output','scrap_transfer','scrap_sale_request','build','inventory_count','build_project','handoff','worker_nonconforming','line_return','worker_count_round','receipt_observation') ORDER BY id").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)}));
 const work:ProfileWork[]=materialProfileWork(profile.id,rows);
 if(profile.workflowRoles.length){for(const plan of rows.filter(r=>r.type==='sourcing_plan')){
  const steps=nextWork(plan,rows.filter(r=>r.type==='sourcing_quote'&&r.data.planId===plan.id),rows.filter(r=>r.type==='purchase_order'&&r.data.planId===plan.id),await coverage(plan));
  for(const step of steps.filter(s=>profile.workflowRoles.includes(s.role)))work.push({id:plan.id+':'+step.key,title:step.title,section:step.sourceSection||'sourcing',target:step.sourceId||plan.id,sourceId:plan.id,state:plan.data.state});
 }}
 return json({profile,work,unverified:[],personalPreview:false});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت پروفایل نقش انجام نشد.'},{status:500,headers:{'Cache-Control':'no-store'}})}}

export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireRealAdmin(),b=await request.json() as any;
 if(b.confirmed!==true||b.mode!=='production_position'||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.id)||typeof b.title!=='string'||!b.title.trim()||b.title.length>120)throw new AccessError('عنوان جایگاه و تأیید ایجاد لازم است.',400);
 const db=storage(),id='production-position:'+b.id,now=new Date().toISOString(),data={title:b.title.trim(),active:true,createdBy:u.userId},prior:any=await db.prepare('SELECT data FROM flow_entities WHERE id=?').bind(id).first();
 if(prior){if(JSON.stringify(JSON.parse(prior.data))!==JSON.stringify(data))throw new AccessError('شناسه تکراری با اطلاعات متفاوت است.',409);return Response.json({saved:true,repeated:true,id});}
 await db.batch([db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'production_position',?,1,?,?)").bind(id,JSON.stringify(data),now,now),db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'production_position_create',JSON.stringify(data),now)]);
 return Response.json({saved:true,id},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'ایجاد جایگاه انجام نشد.'},{status:400});}}
