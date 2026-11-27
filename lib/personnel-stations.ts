import {AccessError,requireAccess,accessResponse} from './authorization';
import {storage} from './storage';
import {boundedBody} from './firmware-storage';
import {sha256} from './firmware';
import {hrActor} from './personnel';
import {dayAt,addDay} from './duties';

const kind='attendance_station';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
type Row={id:string;revision:number;data:string};
type Station={name:string;location:string;mode:'in'|'out'|'both';state:'pending'|'active'|'revoked';ticketHash?:string;tokenHash?:string;expiresAt?:string;createdBy:string;linkedAt?:string;revokedAt?:string;revokedBy?:string};
const safe=(id:string,s:Station)=>({id,name:s.name,location:s.location,mode:s.mode,state:s.state,linkedAt:s.linkedAt||null});
const digest=(value:string)=>sha256(new TextEncoder().encode(value));
function randomSecret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')}
function input(value:unknown,max:number){
 if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail('اطلاعات ایستگاه کامل نیست.');
 return (value as string).trim();
}
export async function stationHr(){
 const user=await requireAccess(),actor=await hrActor(user);
 if(!actor.admin&&!actor.has('hr'))fail('مدیریت ایستگاه فقط برای واحد اداری است.',403);
 return user.userId;
}
export async function stationBody(req:Request){
 const raw=await boundedBody(req,4096);
 try{const body=JSON.parse(new TextDecoder().decode(raw));if(body&&typeof body==='object'&&!Array.isArray(body))return body}catch{}
 return fail('اطلاعات درخواست معتبر نیست.');
}
export async function stationResponse(run:()=>Promise<unknown>){
 try{return Response.json(await run(),{headers})}catch(e){return accessResponse(e)||Response.json({error:'ثبت یا دریافت اطلاعات ایستگاه کامل نشد. دوباره تلاش کنید.'},{status:503,headers})}
}
function cursor(request:Request){return (new URL(request.url).searchParams.get('after')||'').slice(0,220)}
async function stationRow(id:string){
 return await storage().prepare('SELECT id,data,revision FROM flow_entities WHERE id=? AND type=?').bind(id,kind).first<Row>();
}
export async function listStations(request:Request){
 await stationHr();
 const rows=(await storage().prepare('SELECT id,data FROM flow_entities WHERE type=? AND id>? ORDER BY id LIMIT 101').bind(kind,cursor(request)).all<Row>()).results;
 return {stations:rows.slice(0,100).map(r=>safe(r.id,JSON.parse(r.data))),next:rows.length>100?rows[99].id:null};
}
export async function createTicket(body:any){
 const actor=await stationHr(),name=input(body.name,100),location=input(body.location,100);
 if(!['in','out','both'].includes(body.mode))fail('نوع ایستگاه معتبر نیست.');
 const key=body.id===undefined?crypto.randomUUID():input(body.id,36);if(!uuid.test(key))fail('شناسه نصب معتبر نیست.');
 const id='station:'+key,secret=randomSecret(),now=new Date().toISOString(),expiresAt=new Date(Date.now()+600000).toISOString();
 const data:Station={name,location,mode:body.mode,state:'pending',expiresAt,ticketHash:await digest(secret),createdBy:actor};
 const result=await storage().prepare(`INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)
 ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated WHERE flow_entities.type=excluded.type AND json_extract(flow_entities.data,'$.state')='pending' AND json_extract(flow_entities.data,'$.createdBy')=json_extract(excluded.data,'$.createdBy')`).bind(id,kind,JSON.stringify(data),now,now).run();
 if(!result.meta.changes)fail('این ایستگاه قبلاً متصل شده است.',409);
 return {ticket:key+'.'+secret,station:safe(id,data),expiresAt};
}
function credential(raw:unknown){
 const match=typeof raw==='string'&&/^([0-9a-f-]{36})\.([0-9a-f]{64})$/i.exec(raw);
 if(!match||!uuid.test(match[1]))return fail('اعتبار اتصال ایستگاه پذیرفته نشد.',401);
 return {key:match[1],id:'station:'+match[1],secret:match[2]};
}
export async function linkStation(body:any){
 const {id,key,secret}=credential(body.ticket),row=await stationRow(id);
 const data:Station|null=row?JSON.parse(row.data):null,now=new Date().toISOString();
 if(!data||!row||data.state!=='pending'||!data.expiresAt||data.expiresAt<=now||data.ticketHash!==await digest(secret))return fail('اجازهٔ نصب منقضی یا قبلاً استفاده شده است.',401);
 const token=randomSecret();delete data.ticketHash;delete data.expiresAt;
 Object.assign(data,{state:'active',linkedAt:now,tokenHash:await digest(token)});
 const changed=await storage().prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND type=? AND revision=?').bind(JSON.stringify(data),now,id,kind,row.revision).run();
 if(!changed.meta.changes)fail('اجازهٔ نصب قبلاً مصرف شده است.',409);
 return {station:safe(id,data),token:key+'.'+token};
}
export async function revokeStation(body:any){
 const actor=await stationHr(),id=input(body.id,100),now=new Date().toISOString();
 const result=await storage().prepare(`UPDATE flow_entities SET data=json_set(json_remove(data,'$.tokenHash','$.ticketHash','$.expiresAt'),'$.state','revoked','$.revokedAt',?,'$.revokedBy',?),revision=revision+1,updated=? WHERE id=? AND type=? AND json_extract(data,'$.state')!='revoked'`).bind(now,actor,now,id,kind).run();
 if(!result.meta.changes)fail('ایستگاه فعالی پیدا نشد.',404);return {revoked:true,id};
}
export async function employeeRoster(request:Request){
 await stationHr();
 const id=input(new URL(request.url).searchParams.get('stationId'),100),row=await stationRow(id);
 if(!row||JSON.parse(row.data).state!=='active')fail('ایستگاه فعال پیدا نشد.',404);
 const today=dayAt();
 const rows=(await storage().prepare(`SELECT id,json_extract(data,'$.memberId') memberId,json_extract(data,'$.name') name FROM flow_entities WHERE type='hr_employee'
 AND json_extract(data,'$.state')='active' AND json_extract(data,'$.start')<=? AND coalesce(nullif(json_extract(data,'$.end'),''),?)>=?
 AND id>? ORDER BY id LIMIT 101`).bind(today,today,today,cursor(request)).all<{id:string;memberId:string;name:string}>()).results;
 return {people:rows.slice(0,100).map(r=>({id:r.memberId,name:r.name})),next:rows.length>100?rows[99].id:null};
}

const enrollmentId=async(stationId:string,memberId:string)=>'station-member:'+await digest(stationId+'|'+memberId);
export async function enrollMember(body:any){
 const actor=await stationHr(),stationId=input(body.stationId,100),memberId=input(body.memberId,220),id=await enrollmentId(stationId,memberId),now=new Date().toISOString(),today=dayAt();
 const db=storage(),data={stationId,memberId,enrolledAt:now,enrolledBy:actor};
 const result=await db.prepare(`INSERT INTO flow_entities(id,type,data,revision,created,updated)
 SELECT ?,'attendance_station_member',?,1,?,? WHERE EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type=? AND json_extract(data,'$.state')='active')
 AND EXISTS(SELECT 1 FROM flow_entities WHERE type='hr_employee' AND json_extract(data,'$.memberId')=? AND json_extract(data,'$.state')='active'
 AND json_extract(data,'$.start')<=? AND coalesce(nullif(json_extract(data,'$.end'),''),?)>=?)
 ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,revision=flow_entities.revision+1 WHERE flow_entities.type='attendance_station_member'`).bind(id,JSON.stringify(data),now,now,stationId,kind,memberId,today,today,today).run();
 if(!result.meta.changes)fail('ثبت چهره برای این فرد یا ایستگاه مجاز نیست.',409);
 return {enrolled:true};
}
const punchForMember="type='hr_punch' AND json_extract(data,'$.memberId')=?";
const closedPeriod=`SELECT 1 FROM flow_entities p WHERE p.type='hr_period' AND json_extract(p.data,'$.state')!='draft'
 AND json_extract(p.data,'$.start')<=? AND json_extract(p.data,'$.end')>=?
 AND EXISTS(SELECT 1 FROM json_each(p.data,'$.memberIds') WHERE value=?)
 AND (NOT coalesce(json_extract(p.data,'$.payrollV2'),0) OR EXISTS(SELECT 1 FROM json_each(p.data,'$.work') WHERE key=?))`;
function parseEvent(b:any){
 const id=input(b.id,36),memberId=input(b.memberId,220),at=input(b.at,32);
 if(!uuid.test(id)||!['in','out'].includes(b.direction))fail('شناسه یا جهت تردد معتبر نیست.');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at)||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at||Date.parse(at)>Date.now())fail('زمان تردد معتبر نیست؛ ساعت ایستگاه را بررسی کنید.');
 return {id,memberId,at,direction:b.direction as 'in'|'out'};
}
// A night shift's after-midnight exit belongs to its starting day, including delayed uploads.
async function workday(memberId:string,at:string,direction:string){
 const db=storage(),instant=Date.parse(at),calendarDay=dayAt(new Date(at)),previous=addDay(calendarDay,-1);
 if(direction==='out'){
  const earlier=await db.prepare(`SELECT data FROM flow_entities WHERE ${punchForMember} AND json_extract(data,'$.at')<? ORDER BY json_extract(data,'$.at') DESC LIMIT 1`).bind(memberId,at).first<{data:string}>();
  if(earlier){
   const p=JSON.parse(earlier.data);
   if(p.direction==='in'&&p.day===previous&&instant-Date.parse(p.at)<86400000)return previous;
  }
 }
 const assignments=(await db.prepare(`SELECT data FROM flow_entities WHERE type='hr_assignment' AND json_extract(data,'$.memberId')=? AND json_extract(data,'$.start')<=? AND json_extract(data,'$.end')>=? LIMIT 2`).bind(memberId,previous,previous).all<{data:string}>()).results;
 if(assignments.length!==1)return calendarDay;
 const change=await db.prepare(`SELECT json_extract(data,'$.shiftId') shiftId FROM flow_entities WHERE type='hr_request' AND json_extract(data,'$.kind')='shift' AND json_extract(data,'$.state')='approved' AND json_extract(data,'$.memberId')=? AND json_extract(data,'$.start')<=? AND json_extract(data,'$.end')>=? ORDER BY created DESC,id DESC LIMIT 1`).bind(memberId,previous,previous).first<{shiftId:string}>();
 const shift=await db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='hr_shift'").bind(change?.shiftId||JSON.parse(assignments[0].data).shiftId).first<{data:string}>();
 if(!shift)return calendarDay;
 const d=JSON.parse(shift.data),weekday=new Date(previous+'T12:00Z').getUTCDay(),rule=d.dayRules?.find((r:any)=>r.weekday===weekday)||d;
 const overnight=rule.endTime<rule.startTime&&(rule.working===true||!d.dayRules&&d.weekdays?.includes(weekday));
 return overnight&&instant<=Date.parse(calendarDay+'T'+rule.endTime+':00+03:30')?previous:calendarDay;
}
export async function authenticatedStation(request:Request){
 const auth=request.headers.get('Authorization');
 if(!auth?.startsWith('Bearer '))return fail('اتصال معتبر ایستگاه لازم است.',401);
 const cred=credential(auth.slice(7)),row=await stationRow(cred.id);
 if(!row)return fail('ایستگاه پیدا نشد.',401);
 const station:Station=JSON.parse(row.data);
 if(station.state!=='active'||station.tokenHash!==await digest(cred.secret))return fail('اتصال این ایستگاه فعال نیست.',401);
 return {row,station};
}
export async function syncPunch(request:Request,b:any){
 const {row,station}=await authenticatedStation(request),db=storage();
 const event=parseEvent(b),{id,at,memberId,direction}=event;
 if(station.mode!=='both'&&station.mode!==direction)fail('جهت تردد برای این ایستگاه مجاز نیست.',403);
 if(!station.linkedAt||at<station.linkedAt)fail('زمان تردد پیش از اتصال ایستگاه است.',409);
 const checkExisting=async()=>{
  const existing=await db.prepare('SELECT type,data FROM flow_entities WHERE id=?').bind(id).first<{type:string;data:string}>();
  if(!existing)return false;
  const d=JSON.parse(existing.data);
  if(existing.type!=='hr_punch'||d.stationId!==row.id||d.memberId!==memberId||d.at!==at||d.direction!==direction)fail('شناسه تردد با رکورد دیگری تداخل دارد.',409);
  return true;
 };
 if(await checkExisting())return {saved:true,id,repeated:true};
 const membershipId=await enrollmentId(row.id,memberId);
 const membership=await db.prepare("SELECT id FROM flow_entities WHERE id=? AND type='attendance_station_member' AND created<=?").bind(membershipId,at).first();
 if(!membership)fail('ثبت چهرهٔ این فرد در زمان تردد برای این ایستگاه تأیید نشده است.',403);
 const day=await workday(memberId,at,direction);
 const employee=await db.prepare(`SELECT id,revision FROM flow_entities WHERE type='hr_employee' AND json_extract(data,'$.memberId')=? AND json_extract(data,'$.state')='active' AND json_extract(data,'$.start')<=? AND coalesce(nullif(json_extract(data,'$.end'),''),?)>=? LIMIT 2`).bind(memberId,day,day,day).all<{id:string;revision:number}>();
 if(employee.results.length!==1)fail('پروندهٔ فعال و یکتای پرسنلی برای این روز پیدا نشد.',409);
 const before=new Date(Date.parse(at)-59999).toISOString(),after=new Date(Date.parse(at)+59999).toISOString();
 const nearby=`SELECT 1 FROM flow_entities WHERE ${punchForMember} AND json_extract(data,'$.at') BETWEEN ? AND ?`;
 if(await db.prepare(nearby+' LIMIT 1').bind(memberId,before,after).first())fail('تردد دیگری در فاصله کمتر از یک دقیقه ثبت شده است.',409);
 const lockArgs=[day,day,memberId,memberId];
 if(await db.prepare(closedPeriod+' LIMIT 1').bind(...lockArgs).first())fail('کارکرد این دوره بسته شده است؛ واحد اداری باید تردد را بررسی کند.',409);
 const now=new Date().toISOString(),actor=row.id,signature=JSON.stringify(event);
 const data={memberId,day,at,direction,source:'station',stationId:row.id,stationName:station.name,location:station.location,reference:station.name+' · '+station.location,receivedAt:now,createdBy:actor,createdAt:now,state:'published',history:[{at:now,actor,name:station.name,mode:'station_punch',state:'published'}]};
 // A single batch also serializes with existing payroll close and manual punch commits.
 try{await db.batch([
  db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'personnel_station_punch',signature,actor,now),
  db.prepare(`UPDATE inventory_operations SET guard=CASE WHEN EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type=? AND revision=?)
   AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='hr_employee' AND revision=?)
   AND EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type='attendance_station_member' AND created<=?)
   AND NOT EXISTS(${closedPeriod}) AND NOT EXISTS(${nearby}) THEN 1 ELSE 0 END WHERE id=?`).bind(row.id,kind,row.revision,employee.results[0].id,employee.results[0].revision,membershipId,at,...lockArgs,memberId,before,after,id),
  db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'hr_punch',?,1,?,?)").bind(id,JSON.stringify(data),now,now),
  db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(id,actor,id,'personnel_station_punch',JSON.stringify({memberId,day,at,direction}),now)
 ])}catch(e){
  if(await checkExisting())return {saved:true,id,repeated:true};
  if(/CHECK constraint failed|UNIQUE constraint failed/i.test(String(e)))fail('هم‌زمان اطلاعات کارکرد تغییر کرد. تردد را دوباره ارسال کنید.',409);
  throw e;
 }
 return {saved:true,id,repeated:false};
}

