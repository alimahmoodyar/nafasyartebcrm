// Run after `pnpm build`: exercises the real bundled HTTP route in workerd.
// Fixtures live only in Miniflare's temporary database; no server state is used.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const built=path.join(root,'dist','server');
assert.ok(fs.existsSync(path.join(built,'index.js')),'Run pnpm build before this worker regression test.');
const {Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const permissions={read:[],write:[],eventStages:[],personnelRoles:['treasury'],roleAssignment:{roles:['treasurer']}};
const wrapper=`
import app from './index.js';
let initialized;
async function initialize(db){
 await db.exec('CREATE TABLE app_identity(id TEXT PRIMARY KEY,subject TEXT); CREATE TABLE app_members(id TEXT PRIMARY KEY,email TEXT,name TEXT,unit TEXT,status TEXT,subject TEXT,permissions TEXT,created TEXT,updated TEXT); CREATE TABLE password_accounts(member_id TEXT); CREATE TABLE flow_entities(id TEXT PRIMARY KEY,type TEXT,data TEXT,revision INTEGER,created TEXT,updated TEXT);');
 const now=new Date().toISOString();
 for(const member of [
  {id:'audit-treasurer',email:'treasurer@example.test',name:'Audit treasurer',permissions:${JSON.stringify(permissions)}},
  {id:'audit-calendar',email:'calendar@example.test',name:'Audit calendar employee',permissions:{read:[],write:[],eventStages:[]}},
  {id:'audit-manager',email:'manager@example.test',name:'Audit manager',permissions:{read:[],write:[],eventStages:[]}},
  {id:'audit-external',email:'external@example.test',name:'Audit representative',permissions:{read:[],write:[],eventStages:[],salesRoles:['agent'],salesAgentId:'outside'}}
 ])await db.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'company','active',?,?,?,?)").bind(member.id,member.email,member.name,member.id,JSON.stringify(member.permissions),now,now).run();
}
async function linkedFixtures(db){
 const now=new Date().toISOString();
 const rows=[
  ['audit-employee','hr_employee',{memberId:'audit-treasurer',managerId:'manager',name:'Audit treasurer',code:'T01',state:'active',start:'2026-01-01',end:'',leaveMinutes:480,unit:'Finance',title:'Treasurer',location:'Office',employment:'Contract'}],
  ['audit-ruling','hr_ruling',{memberId:'audit-treasurer',title:'My published ruling',state:'published',monthlyBase:'100000'}],
  ['audit-private-ruling','hr_ruling',{memberId:'another-employee',title:'Another employee private ruling',state:'draft',text:'PRIVATE-OTHER-EMPLOYEE'}],
  ['audit-payroll','hr_payroll',{memberId:'audit-treasurer',title:'My payslip',state:'paid',published:true,net:'90000',payments:[]}],
  ['audit-advance','hr_request',{memberId:'audit-treasurer',kind:'advance',state:'hr',amount:'1000',payments:[]}],
  ['audit-position','position',{name:'Treasurer duties',active:true,members:['audit-treasurer'],responsibilities:'Track authorized payments'}],
  ['audit-duty-template','duty_template',{positionId:'audit-position',active:true,title:'Review payment documents',instructions:'Review the assigned payment documents'}]
 ];
 for(const [id,type,data]of rows)await db.prepare('INSERT OR IGNORE INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(data),now,now).run();
}
async function calendarFixtures(db){
 const now=new Date().toISOString();
 const rows=[
  ['audit-calendar-employee','hr_employee',{memberId:'audit-calendar',managerId:'audit-manager',name:'Audit calendar employee',code:'C01',state:'active',start:'2026-03-21',end:'',leaveMinutes:0,unit:'Finance',title:'Employee',location:'Office',employment:'Contract'}],
  ['audit-calendar-shift','hr_shift',{title:'Published eight-hour shift',state:'published',startTime:'08:00',endTime:'16:00',breakMinutes:0,weekdays:[0,1,2,3,4,6],holidays:[]}],
  ['audit-calendar-assignment','hr_assignment',{memberId:'audit-calendar',shiftId:'audit-calendar-shift',start:'2026-03-21',end:'2036-12-31',state:'published'}]
 ];
 for(const [id,type,data]of rows)await db.prepare('INSERT OR IGNORE INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(id,type,JSON.stringify(data),now,now).run();
}
export default {async fetch(request,env,ctx){
 initialized||=initialize(env.DB);await initialized;
 if(request.headers.get('x-audit-linked')==='yes')await linkedFixtures(env.DB);
 if(request.headers.get('x-audit-calendar')==='yes')await calendarFixtures(env.DB);
 return app.fetch(request,env,ctx);
}};
`;
const modules=[
 {type:'ESModule',path:path.join(built,'personnel-audit-entry.js'),contents:wrapper},
 ...fs.readdirSync(built,{recursive:true}).filter(p=>/\.m?js$/.test(p)).map(p=>({type:'ESModule',path:path.join(built,p)}))
];
const config=JSON.parse(fs.readFileSync(path.join(built,'wrangler.json'),'utf8'));
const options={
 modulesRoot:built,cf:false,
 compatibilityDate:config.compatibility_date,
 compatibilityFlags:config.compatibility_flags,
 bindings:{TRACE_OWNER_EMAIL:'owner@example.test'},
 d1Databases:{DB:'personnel-worker-audit'},d1Persist:false,
 r2Buckets:{BUCKET:'personnel-worker-audit'},r2Persist:false,
 cachePersist:false
};
const mf=new Miniflare({...options,modules});
const identities={
 admin:{'oai-authenticated-user-id':'audit-owner','oai-authenticated-user-email':'owner@example.test'},
 treasury:{'oai-authenticated-user-id':'audit-treasurer','oai-authenticated-user-email':'treasurer@example.test'},
 calendar:{'oai-authenticated-user-id':'audit-calendar','oai-authenticated-user-email':'calendar@example.test'},
 external:{'oai-authenticated-user-id':'audit-external','oai-authenticated-user-email':'external@example.test'}
};
async function get(identity,query='',extra={}){
 const response=await mf.dispatchFetch('http://audit.example.test/api/personnel'+query,{headers:{...identities[identity],...extra}});
 return {status:response.status,data:await response.json()};
}
function checkPortal(result){
 assert.equal(result.status,200,JSON.stringify(result.data));
 assert.match(result.data.today,/^\d{4}-\d{2}-\d{2}$/);
 assert.match(result.data.start,/^\d{4}-\d{2}-\d{2}$/);
 assert.match(result.data.end,/^\d{4}-\d{2}-\d{2}$/);
 assert.ok(Array.isArray(result.data.records));
 assert.ok(Array.isArray(result.data.positions));
 for(const kind of ['leave','advance','loan'])assert.ok(result.data.kinds[kind],kind+' must be available to the portal');
}
// Restore the former alias only in memory. A source-level VM mock cannot catch
// the bundled module initialization order which made this alias undefined.
async function checkPreviousAliasFails(){
 let restored=false;
 const negativeModules=modules.map(module=>{
  if(module.contents||!module.path.includes(path.join('_next','static')))return module;
  let contents=fs.readFileSync(module.path,'utf8');
  const exported=/sreq:\(\)=>([\w$]+)/.exec(contents);
  if(!exported)return module;
  const name=exported[1],escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const declaration=new RegExp('function '+escaped+'\\(([^)]*)\\)\\{return ([\\w$]+)\\(([^)]*)\\)\\}').exec(contents);
  assert.ok(declaration,'The compiled sreq wrapper must defer its dependency');
  contents=contents.replace(declaration[0],'var '+name+'='+declaration[2]+';');
  restored=true;return {...module,contents};
 });
 assert.ok(restored,'Could not find the bundled sales validation wrapper for the negative control');
 const negative=new Miniflare({...options,modules:negativeModules});
 try{
  const response=await negative.dispatchFetch('http://audit.example.test/api/personnel',{headers:identities.treasury});
  assert.equal(response.status,503,'The former static alias must reproduce the personnel failure');
  assert.ok((await response.json()).error);
  console.log('Negative control passed: restoring the former static validation alias reproduces HTTP 503.');
 }finally{await negative.dispose();}
}
(async()=>{
 try{
  assert.equal((await get()).status,401,'An anonymous request must remain unauthorized');
  const admin=await get('admin');checkPortal(admin);assert.equal(admin.data.admin,true);assert.equal(admin.data.records.length,0);
  const treasury=await get('treasury');checkPortal(treasury);assert.equal(treasury.data.me,'audit-treasurer');assert.equal(treasury.data.admin,false);assert.deepEqual(treasury.data.roles,['treasury']);assert.equal(treasury.data.records.length,0);assert.equal(treasury.data.profileStatus.state,'missing');assert.equal(treasury.data.profileStatus.ready,false);assert.equal(treasury.data.jobResponsibilities[0].name,'خزانه‌دار');assert.ok(!JSON.stringify(treasury.data.jobResponsibilities).includes('grants'));assert.equal(treasury.data.documentStatus.ruling.state,'missing');
  assert.equal((await get('external')).status,403,'A representative must not receive personnel data');
  assert.equal((await get('treasury','?from=invalid')).status,400,'Date validation must still reject an invalid date');
  assert.equal((await get('treasury','?leaveMonth=2026-02-30')).status,400,'Calendar month validation must reject impossible ISO days in the bundled route');
  const linked=await get('treasury','',{'x-audit-linked':'yes'});checkPortal(linked);
  for(const id of ['audit-employee','audit-ruling','audit-payroll','audit-advance'])assert.ok(linked.data.records.some(r=>r.id===id),'Missing own record: '+id);
  assert.ok(!JSON.stringify(linked.data).includes('PRIVATE-OTHER-EMPLOYEE'),'Another employee private ruling must remain hidden');
  assert.equal(linked.data.positions[0].name,'Treasurer duties');assert.equal(linked.data.positions[0].tasks[0].title,'Review payment documents');
  assert.equal(linked.data.balances.find(b=>b.memberId==='audit-treasurer').availableMinutes,480);
  assert.equal(linked.data.leaveSummary.memberId,'audit-treasurer');assert.equal(linked.data.leaveSummary.status,'ready');assert.equal(linked.data.leaveSummary.accountingMode,'legacy');assert.equal(linked.data.leaveSummary.remainingDays,null,'Missing assignment must not fabricate a legacy day balance');assert.ok(linked.data.leaveSummary.message);
  assert.equal(linked.data.advances.find(a=>a.memberId==='audit-treasurer').pending,'1000');assert.equal(linked.data.profileStatus.ready,true);assert.equal(linked.data.profileStatus.services.finance.ready,true);assert.equal(linked.data.profileStatus.services.leave.ready,false);assert.equal(linked.data.documentStatus.ruling.state,'published');assert.equal(linked.data.documentStatus.payroll.state,'published');assert.ok(linked.data.personalWork.summary.error);
  const calendar=await get('calendar','?memberId=audit-treasurer',{'x-audit-calendar':'yes'});checkPortal(calendar);assert.equal(calendar.data.profileStatus.services.leave.ready,true);const leave=calendar.data.leaveSummary;assert.equal(leave.memberId,'audit-calendar');assert.equal(leave.status,'ready');assert.equal(leave.accountingMode,'monthly');assert.equal(leave.monthlyEntitlementDays,2.5);assert.equal(leave.yearUsedDays,0);assert.equal(leave.monthUsedDays,0);assert.equal(leave.pendingDays,0);assert.equal(leave.remainingDays,leave.solarMonth*2.5,'Credit uses the current Persian year/month in the bundled runtime');assert.ok(leave.calendar.days.some(day=>day.status==='working'));assert.ok(leave.calendar.days.some(day=>day.status==='off'));for(const date of leave.calendar.days){if(date.status==='working')assert.equal(date.minutes,480);else assert.equal(date.minutes,0);}assert.equal(calendar.data.balances.find(b=>b.memberId==='audit-calendar').availableMinutes,leave.remainingDays*480);
  const adminAfter=await get('admin','?memberId=audit-calendar');checkPortal(adminAfter);assert.equal(adminAfter.data.leaveSummary.memberId,'');assert.equal(adminAfter.data.leaveSummary.status,'unavailable','An administrator without a staff profile must not adopt another employee summary');assert.ok(!JSON.stringify(adminAfter.data.leaveSummary).includes('Audit calendar employee'));
  console.log('Personnel bundled workerd regression passed: admin, empty treasurer, linked records, monthly leave/calendar and safe legacy opening, own-only aggregates, duties, privacy and date validation.');
 }finally{await mf.dispose();}
 await checkPreviousAliasFails();
})().catch(error=>{console.error(error);process.exitCode=1;});
