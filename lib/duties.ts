import {storage} from './storage';
import {AccessError} from './authorization';
import type {Session} from './permissions';
export const taskText=(v:unknown,max=4000)=>{if(typeof v!=='string'||v.length>max)throw new AccessError('متن معتبر نیست.',400);return v.trim()};
export const taskRequired=(v:unknown,max=200)=>{const s=taskText(v,max);if(!s)throw new AccessError('فیلد الزامی خالی است.',400);return s};
export const dayAt=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const addDay=(day:string,n:number)=>new Date(new Date(day+'T12:00:00Z').getTime()+n*86400000).toISOString().slice(0,10);
export function validDay(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
function persian(day:string){return Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(day+'T12:00:00Z')).filter(x=>['year','month','day'].includes(x.type)).map(x=>[x.type,Number(x.value)]));}
export function scheduled(t:any,day:string){if(day<t.startDate)return false;const weekday=new Date(day+'T12:00:00Z').getUTCDay();if(t.cadence==='once')return day===t.startDate;if(t.cadence==='daily')return t.weekdays.includes(weekday);if(t.cadence==='weekly')return weekday===t.weekday;const p=persian(day),next=persian(addDay(day,1));return p.day===t.monthDay||next.month!==p.month&&p.day<t.monthDay;}
export async function memberId(u:Session){const r:any=await storage().prepare("SELECT id FROM app_members WHERE status='active' AND (subject=? OR id=?)").bind(u.userId,u.userId.startsWith('local:')?u.userId.slice(6):u.userId).first();return r?.id||'';}
export async function taskAccess(id:string,u:Session,write=false){const r:any=await storage().prepare('SELECT * FROM duty_runs WHERE id=?').bind(id).first();const mid=await memberId(u);if(!r||!u.isAdmin&&r.assignee!==mid&&r.supervisor!==mid)throw new AccessError('وظیفه پیدا نشد یا دسترسی ندارید.',404);if(write&&!u.isAdmin&&r.assignee!==mid)throw new AccessError('پاسخ فقط توسط مسئول وظیفه ثبت می‌شود.',403);return {...r,data:JSON.parse(r.data)};}
export const notice=(task:string,recipient:string,phase:string,message:string,now:string)=>storage().prepare('INSERT OR IGNORE INTO duty_notices(id,task_id,recipient,phase,message,created) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),task,recipient,phase,message,now);
export async function tickDuties(nowDate=new Date(),source='server'){
 const db=storage(),now=nowDate.toISOString(),today=dayAt(nowDate);let generated=0;
 const defs=(await db.prepare("SELECT * FROM flow_entities WHERE type='duty_template' AND json_extract(data,'$.active')=1 ORDER BY id").all()).results;
 for(const row of defs as any[]){const t=JSON.parse(row.data),pos:any=await db.prepare("SELECT * FROM flow_entities WHERE id=? AND type='position'").bind(t.positionId).first();if(!pos)continue;const position=JSON.parse(pos.data);if(!position.active)continue;
 const active=(await db.prepare("SELECT id FROM app_members WHERE status='active'").all()).results.map((r:any)=>r.id);const members=position.members.filter((id:string)=>active.includes(id));
 let day=t.lastDay?addDay(t.lastDay,1):t.startDate;let last=t.lastDay;const statements:D1PreparedStatement[]=[];let count=0;
 for(let step=0;step<31&&day<=today;step++,day=addDay(day,1)){last=day;if(!scheduled(t,day))continue;const due=new Date(day+'T'+t.time+':00+03:30').toISOString();for(const mid of members){const runId=row.id+':'+day+':'+mid,snapshot={title:t.title,instructions:t.instructions,evidence:t.evidence,positionName:position.name,templateRevision:row.revision,remindHours:t.remindHours,escalateHours:t.escalateHours,history:[],answer:'',extensionRequested:'',sourceSection:t.sourceSection};statements.push(db.prepare("INSERT OR IGNORE INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?,?,?,?,?,?,'open',?,1,?,?)").bind(runId,row.id,day,mid,position.supervisor||null,due,JSON.stringify(snapshot),now,now));count++;}}
 if(last===undefined||last===t.lastDay)continue;
 const op=crypto.randomUUID();try{await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'duty_tick','{}','scheduler',?,CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?) THEN 1 ELSE 0 END)").bind(op,now,row.id,row.revision,pos.id,pos.revision),...statements,db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify({...t,lastDay:last}),now,row.id,row.revision)]);generated+=count;}catch(e){if(!/constraint|guard/i.test(String(e)))throw e;}
 }
 const active=(await db.prepare("SELECT * FROM duty_runs WHERE state IN ('open','blocked','submitted')").all()).results;
 for(const r of active as any[]){const d=JSON.parse(r.data),due=Date.parse(r.due),late=nowDate.getTime()-due;const statements:D1PreparedStatement[]=[];
 if(r.state==='submitted')statements.push(notice(r.id,r.supervisor||'@admin','review:'+r.revision,'پاسخ «'+d.title+'» در انتظار بررسی است.',now));else{
 statements.push(notice(r.id,r.assignee,'assigned','وظیفه: '+d.title,now));
 if(late>=-2*3600000&&late<0)statements.push(notice(r.id,r.assignee,'near:'+r.due,'مهلت «'+d.title+'» نزدیک است.',now));
 if(late>=0){const bucket=Math.min(6,Math.floor(late/(d.remindHours*3600000)));statements.push(notice(r.id,r.assignee,'late:'+r.due+':'+bucket,'مهلت «'+d.title+'» گذشته است؛ پاسخ یا علت تأخیر را ثبت کنید.',now));if(late>=d.escalateHours*3600000)statements.push(notice(r.id,r.supervisor||'@admin','escalate:'+r.due,'وظیفه «'+d.title+'» از مهلت پیگیری عبور کرده است.',now));}
 }
 // Each notice is conditional on the version read, avoiding a late reminder after completion/extension.
 if(statements.length){const op=crypto.randomUUID();try{await db.batch([db.prepare("INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,'duty_reminder','{}','scheduler',?,CASE WHEN EXISTS(SELECT 1 FROM duty_runs WHERE id=? AND revision=?) THEN 1 ELSE 0 END)").bind(op,now,r.id,r.revision),...statements]);}catch(e){if(!/constraint|guard/i.test(String(e)))throw e;}}
 }
 await db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES('duty_scheduler','duty_scheduler',?,1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated").bind(JSON.stringify({lastTick:now,source,generated}),now,now).run();return {generated,at:now};
}
