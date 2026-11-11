import {storage} from './storage';
import {storedAccessPermissions,type Session} from './permissions';
import {serviceCommercialPermissions} from './service-commercial-contract';
import type {ProfileWork} from './role-profiles';
import {dayAt,addDay} from './duties';
export function commercialPending(rows:any[]){return rows.flatMap(r=>r.data.domain!=='home'?[]:r.type==='as_commercial_request'&&r.data.state==='pending'?[{row:r,role:r.data.kind==='credit'?'manager':'finance',title:r.data.kind==='credit'?'تأیید حد اعتبار · '+r.data.agentName:'تأیید قیمت قطعه · '+r.data.name}]:r.type==='as_service_catalog_request'&&r.data.state==='pending'?[{row:r,role:'ceo',title:'تأیید فهرست قطعات مجاز · '+r.data.productName}]:r.type==='as_service_work'&&r.data.state==='pending_rate'?[{row:r,role:'ceo',title:'تصویب فی دقیقه و ضریب اجرت · '+r.data.name}]:[]);}
export function commercialProfileWork(u:Session,rows:any[]):ProfileWork[]{const rights=serviceCommercialPermissions(u);return commercialPending(rows).filter(s=>rights[s.role as keyof typeof rights]).map(s=>({id:s.row.id+':commercial',title:s.title,section:'after-sales',target:(s.row.type==='as_service_catalog_request'?'service-parts:':'service-commercial:')+s.row.id,sourceId:s.row.id,state:'pending'}));}
export async function syncServiceCommercialTasks(){
 const db=storage(),rows=(await db.prepare("SELECT * FROM flow_entities WHERE type IN ('as_commercial_request','as_service_work','as_service_catalog_request')").all()).results.map((r:any)=>({...r,data:JSON.parse(r.data)})),members=(await db.prepare("SELECT id,name,permissions FROM app_members WHERE status='active'").all()).results;
 const wanted=new Set<string>(),now=new Date().toISOString(),stmts:D1PreparedStatement[]=[];
 for(const step of commercialPending(rows))for(const m of members){const p=storedAccessPermissions(String(m.permissions)),u:Session={userId:String(m.id),name:String(m.name),email:'',isAdmin:false,permissions:p},rights=serviceCommercialPermissions(u);if(!rights[step.role as keyof typeof rights])continue;
  const id='service-commercial:'+step.row.id+':'+m.id;wanted.add(id);
  const data={title:step.title,instructions:'از اعتبار و تعرفه خدمات خانگی، درخواست را باز کنید و تصمیم را با دلیل ثبت کنید.',sourceSection:'after-sales',sourceId:(step.row.type==='as_service_catalog_request'?'service-parts:':'service-commercial:')+step.row.id,serviceCommercial:true,serviceDomain:'home',positionName:step.role==='ceo'?'مدیرعامل':step.role==='finance'?'مدیر مالی':'مدیر خدمات پس از فروش خانگی',evidence:'text',remindHours:24,escalateHours:24,history:[],answer:''};
  stmts.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,'workflow',?,NULL,?,'open',?,1,?,?) ON CONFLICT(id) DO UPDATE SET state='open',data=excluded.data,revision=duty_runs.revision+1,updated=excluded.updated WHERE duty_runs.state IN ('completed','cancelled') OR duty_runs.data<>excluded.data").bind(id,'service-commercial:'+step.row.id,String(m.id),addDay(dayAt(),1)+'T12:30:00Z',JSON.stringify(data),now,now));
 }
 const prior=(await db.prepare("SELECT id FROM duty_runs WHERE template_id LIKE 'service-commercial:%' AND state NOT IN ('completed','cancelled')").all()).results;
 for(const r of prior)if(!wanted.has(String(r.id)))stmts.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE id=?").bind(now,r.id));
 if(stmts.length)await db.batch(stmts);
}
