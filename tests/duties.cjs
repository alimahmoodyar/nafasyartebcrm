const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const originalBatch=db.batch.bind(db);let batchQueue=Promise.resolve();db.batch=stmts=>{const pending=batchQueue.then(()=>originalBatch(stmts));batchQueue=pending.catch(()=>{});return pending;};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}


const tasks=load('app/api/tasks/route.ts'),files=load('app/api/tasks/files/route.ts'),engine=load('lib/duties.ts'),tick=load('app/api/tasks/tick/route.ts'),context=load('lib/mcp/context.ts');
const as=(actor,fn)=>context.mcpActor.run(actor,fn);
const worker={userId:'w',email:'w@test.local',name:'Worker',isAdmin:false,permissions:{read:[],write:[],eventStages:[]}};
const manager={...worker,userId:'m',email:'m@test.local',name:'Manager'};
const outsider={...worker,userId:'o',email:'o@test.local',name:'Other'};
async function op(actor,mode,b,status=200){const r=await as(actor,()=>tasks.POST(request('/api/tasks','POST',{id:crypto.randomUUID(),mode,...b})));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
function latest(id){const r=sql.prepare('SELECT * FROM duty_runs WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)};}
(async()=>{
 identity=owner;const admin=await auth.session();const now=new Date().toISOString(),day=engine.dayAt();
 for(const u of [worker,manager,outsider])sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'Unit','active',?,?,1,?,?)").run(u.userId,u.email,u.name,u.userId,JSON.stringify(u.permissions),now,now);
 const positionId=crypto.randomUUID(),templateId=crypto.randomUUID();const pos={id:positionId,name:'Warehouse officer',unit:'Warehouse',members:['w'],supervisor:'m',active:true};await op(worker,'position',pos,403);await op(admin,'position',pos);
 const template={id:templateId,positionId,title:'Daily report',instructions:'Upload report then explain differences.',cadence:'daily',evidence:'file',startDate:day,time:'16:00',weekdays:[0,1,2,3,4,5,6],weekday:6,monthDay:1,remindHours:4,escalateHours:1,sourceSection:'fulfillment',active:true};await op(admin,'template',template);
 await Promise.all([engine.tickDuties(new Date(day+'T20:00:00Z')),engine.tickDuties(new Date(day+'T20:00:00Z'))]);assert.equal(sql.prepare('SELECT count(*) AS n FROM duty_runs').get().n,1);
 const run=sql.prepare('SELECT id FROM duty_runs').get().id;const noticeCount=sql.prepare('SELECT count(*) AS n FROM duty_notices').get().n;await engine.tickDuties(new Date(day+'T20:00:00Z'));assert.equal(sql.prepare('SELECT count(*) AS n FROM duty_notices').get().n,noticeCount);
 let d=await (await as(outsider,()=>tasks.GET())).json();assert.equal(d.tasks.length,0);assert.equal(d.notifications.length,0);assert.equal(d.definitions.length,0);
 sql.prepare("INSERT INTO duty_notices(id,task_id,recipient,phase,message,created) VALUES('admin-notice',?,'@admin','escalate','Manager-only escalation',?)").run(run,now);
 d=await (await as(admin,()=>tasks.GET())).json();assert.equal(d.notifications.some(n=>n.id==='admin-notice'),false);assert.equal(d.managementNotifications.some(n=>n.id==='admin-notice'),true);
 await op(outsider,'answer',{taskId:run,revision:1,note:'private'},404);
 await op(worker,'submit',{taskId:run,revision:1,note:'report ready'},400);
 let form=new FormData();form.set('file',new File(['a,b\n1,2'],'report.csv',{type:'text/csv'}));const upload=()=>files.POST(new Request(base+'/api/tasks/files?task='+encodeURIComponent(run)+'&requestId='+crypto.randomUUID(),{method:'POST',headers:{origin:base},body:form}));assert.equal((await as(outsider,upload)).status,404);let r=await as(worker,upload);assert.equal(r.status,201,await r.clone().text());const file=(await r.json()).file;assert.ok(!file.object_key);
 assert.equal((await as(outsider,()=>files.GET(request('/api/tasks/files?task='+encodeURIComponent(run)+'&id='+file.id)))).status,404);
 assert.equal((await as(manager,()=>files.GET(request('/api/tasks/files?task='+encodeURIComponent(run)+'&id='+file.id)))).status,200);
 await op(worker,'submit',{taskId:run,revision:latest(run).revision,note:'uploaded daily report'});assert.equal(latest(run).state,'submitted');
 await op(worker,'approve',{taskId:run,revision:latest(run).revision,note:'self approval'},403);
 const rev=latest(run).revision;await op(manager,'return',{taskId:run,revision:rev,note:'Explain the difference'});await op(worker,'answer',{taskId:run,revision:rev,note:'stale'},409);
 await op(worker,'blocked',{taskId:run,revision:latest(run).revision,note:'Waiting for bank'});const due=latest(run).due;await op(worker,'request_extension',{taskId:run,revision:latest(run).revision,note:'Need tomorrow'});assert.equal(latest(run).due,due);
 await op(manager,'extend',{taskId:run,revision:latest(run).revision,note:'Approved extension',newDue:engine.addDay(day,1)+'T16:00:00+03:30'});assert.notEqual(latest(run).due,due);
 await op(worker,'submit',{taskId:run,revision:latest(run).revision,note:'All differences explained'});const approve={id:crypto.randomUUID(),taskId:run,revision:latest(run).revision,note:'Checked and accepted'};await op(manager,'approve',approve);await op(manager,'approve',approve);assert.equal(latest(run).state,'completed');
 const before=sql.prepare('SELECT count(*) AS n FROM duty_notices WHERE task_id=?').get(run).n;await engine.tickDuties(new Date(day+'T23:00:00Z'));assert.equal(sql.prepare('SELECT count(*) AS n FROM duty_notices WHERE task_id=?').get(run).n,before);
 assert.ok(latest(run).data.history.some(h=>h.mode==='blocked'));assert.ok(latest(run).data.history.some(h=>h.mode==='return'));
 const n=sql.prepare("SELECT id FROM duty_notices WHERE recipient='w' LIMIT 1").get();await op(outsider,'read_notice',{noticeId:n.id},404);await op(worker,'read_notice',{noticeId:n.id});assert.ok(sql.prepare('SELECT read_at FROM duty_notices WHERE id=?').get(n.id).read_at);
 assert.equal(engine.scheduled({...template,cadence:'monthly',startDate:'2026-01-01',monthDay:31},'2026-10-22'),true); // Mehr 30, short-month clamp
 assert.equal(engine.scheduled({...template,cadence:'monthly',startDate:'2026-01-01',monthDay:1},'2026-10-23'),true); // Aban 1
 assert.equal(engine.scheduled({...template,cadence:'weekly',startDate:'2026-01-01',weekday:6},'2026-10-03'),true);
 env.TASK_SCHEDULER_TOKEN='test-scheduler-secret';assert.equal((await tick.POST(request('/api/tasks/tick','POST',{}, {authorization:'Bearer wrong'}))).status,401);
 token=(await mint('read')).token;assert.ok(!(await call('get_task_inbox')).error);assert.ok((await call('task_cancel',{id:crypto.randomUUID(),taskId:run,revision:latest(run).revision,note:'cancel',confirmed:true})).error);

 // Starter installation: all requested positions, drafts, preservation and privacy.
 const starter=load('lib/duty-starter.ts'),installer=load('lib/duty-starter-install.ts');
 assert.equal(starter.dutyStarter.length,16);assert.equal(new Set(starter.dutyStarter.map(p=>p.name)).size,16);
 assert.equal(starter.dutyStarter.flatMap(p=>p.tasks).length,64);
 for(const p of starter.dutyStarter){assert.equal(p.tasks.filter(t=>t.cadence==='daily').length,2);assert.equal(p.tasks.filter(t=>t.cadence==='weekly').length,1);assert.equal(p.tasks.filter(t=>t.cadence==='monthly').length,1);for(const k of installer.positionProfileFields)assert.ok(p[k].length>5);for(const t of p.tasks)assert.ok(t.instructions.includes('معیار پذیرش'))}
 const existingId=crypto.randomUUID();await op(admin,'position',{id:existingId,name:'خزانه‌دار',unit:'مالی ویژه',members:['w'],supervisor:'m',active:false,mission:'Existing custom mission'});
 await op(worker,'install_starter',{},403);
 const installed=await Promise.all([installer.installDutyStarter(admin),installer.installDutyStarter(admin)]);
 assert.equal(installed.filter(r=>r.addedPositions===15&&r.addedTemplates===64).length,1);
 const rows=sql.prepare("SELECT * FROM flow_entities WHERE type='position'").all();assert.equal(rows.length,17); // baseline test role + 16 requested
 assert.equal(rows.filter(r=>installer.normalizePosition(JSON.parse(r.data).name)==='خزانهدار').length,1);
 let preserved=JSON.parse(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(existingId).data);
 assert.equal(preserved.mission,'Existing custom mission');assert.equal(preserved.unit,'مالی ویژه');assert.equal(preserved.members[0],'w');assert.equal(preserved.active,false);assert.ok(preserved.responsibilities);
 let programs=sql.prepare("SELECT * FROM flow_entities WHERE id LIKE 'starter-duty:%'").all();assert.equal(programs.length,64);assert.ok(programs.every(r=>JSON.parse(r.data).active===false));
 await engine.tickDuties(new Date(day+'T20:00:00Z'));assert.equal(sql.prepare("SELECT count(*) n FROM duty_runs WHERE template_id LIKE 'starter-duty:%'").get().n,0);
 const seedId='starter-duty:treasurer:bank-cash',seed=programs.find(p=>p.id===seedId),seedData=JSON.parse(seed.data);
 await op(admin,'template',{definitionId:seedId,revision:seed.revision,...seedData,instructions:'Edited instructions',startDate:engine.addDay(day,-5),active:false});
 await installer.installDutyStarter(admin);assert.equal(JSON.parse(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(seedId).data).instructions,'Edited instructions');
 let revision=sql.prepare('SELECT revision FROM flow_entities WHERE id=?').get(seedId).revision;
 await op(admin,'template',{definitionId:seedId,revision,...seedData,startDate:engine.addDay(day,-5),active:true},400);
 await op(admin,'template',{definitionId:seedId,revision,...seedData,startDate:day,active:true});
 const storedPosition=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(existingId);
 await op(admin,'position',{definitionId:existingId,revision:storedPosition.revision,...JSON.parse(storedPosition.data),active:true});
 await engine.tickDuties(new Date(day+'T20:00:00Z'));const isWorkday=engine.scheduled(seedData,day);
 assert.equal(sql.prepare("SELECT count(*) n FROM duty_runs WHERE template_id LIKE 'starter-duty:%'").get().n,isWorkday?1:0);
 d=await (await as(worker,()=>tasks.GET())).json();assert.ok(d.ownPositions.some(p=>p.id===existingId&&p.mission==='Existing custom mission'));assert.equal(d.definitions.length,0);assert.ok(!JSON.stringify(d.ownPositions).includes('sales-manager'));
 d=await (await as(outsider,()=>tasks.GET())).json();assert.equal(d.ownPositions.length,0);
 const beforeRepeat=sql.prepare("SELECT count(*) n FROM flow_entities").get().n;await op(admin,'install_starter',{});assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities").get().n,beforeRepeat);
 token=(await mint('read_write')).token;
 const current=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(existingId),currentData=JSON.parse(current.data);
 const mcpSave=await call('save_position',{id:crypto.randomUUID(),definitionId:existingId,revision:current.revision,name:currentData.name,unit:currentData.unit,members:['w'],supervisor:'m',active:true,mission:'Updated through MCP',confirmed:true});assert.ok(!mcpSave.error,JSON.stringify(mcpSave));
 preserved=JSON.parse(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(existingId).data);assert.equal(preserved.mission,'Updated through MCP');assert.equal(preserved.responsibilities,currentData.responsibilities);
 assert.ok(!(await call('install_duty_starter',{id:crypto.randomUUID(),confirmed:true})).error);
 const roleList=await call('get_position_programs',{positionId:''});assert.equal(roleList.positions.length,17);const roleDetail=await call('get_position_programs',{positionId:existingId});assert.equal(roleDetail.templates.length,4);assert.equal(roleDetail.position.data.mission,'Updated through MCP');assert.ok(JSON.stringify(roleDetail).length<16000);
 assert.equal((await as(outsider,()=>tasks.GET(request('/api/tasks?view=positions&position='+existingId)))).status,404);const ownRole=await (await as(worker,()=>tasks.GET(request('/api/tasks?view=positions&position='+existingId)))).json();assert.equal(ownRole.templates.length,4);assert.equal(ownRole.position.data.members,undefined);
 // Each catalog role must earn this specialized entry through purchase work or an actual receipt assignment.
 const policy=load('lib/permissions.ts'),services=load('app/api/purchase-services/route.ts');
 const purchaseRoles=new Set(['domestic','foreign','commerce','domestic_commerce_lead','foreign_commerce_lead','purchase_finance','ceo']),roleUsers=[];
 const entity=(id,data)=>sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'purchase_service',?,1,?,?)").run(id,JSON.stringify(data),now,now);
 const serviceData=ownerId=>({title:'Assigned service',expected:'Actual output',amount:'100',ownerId,due:day,design:false,state:'accepted',costs:[],history:[]});
 const mcpRead=(name,u)=>catalog.executeTool(name,{},base,{user:u,scope:'read',tokenId:null});
 for(const role of policy.jobRoles){
  const assignment={roles:[role.id],...(role.scope==='warehouses'?{warehouses:[role.id==='production_store_assistant'?'line':'raw']}:{}),...(['services','serviceAgent'].includes(role.scope)?{serviceDomains:['home']}:{}),...(role.scope==='salesAgent'?{salesAgentId:'rep-test'}:{}),...(role.scope==='serviceAgent'?{serviceAgentId:'service-test'}:{})};
  const u={...worker,userId:'role-user:'+role.id,email:role.id+'@role.test',permissions:policy.validatePermissions({roleAssignment:assignment})},mid='role-member:'+role.id;roleUsers.push({role,u,mid});
  sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'Test','active',?,?,?,?)").run(mid,u.email,role.label,u.userId,JSON.stringify(u.permissions),now,now);
  const inbox=await (await as(u,()=>tasks.GET())).json();assert.equal(inbox.canPurchaseServices,purchaseRoles.has(role.id),role.id+': unassigned icon');
  assert.equal((await as(u,()=>services.GET())).status,purchaseRoles.has(role.id)?200:403,role.id+': unassigned HTTP');
  assert.equal((await mcpRead('get_task_inbox',u)).canPurchaseServices,purchaseRoles.has(role.id),role.id+': MCP inbox');
  if(!purchaseRoles.has(role.id))await assert.rejects(()=>mcpRead('get_purchase_services',u));
 }
 for(const {role,u,mid} of roleUsers){
  const internal=!['sales_agent','service_agent'].includes(role.id),sid='assigned:'+role.id;entity(sid,serviceData(mid));
  const inbox=await (await as(u,()=>tasks.GET())).json();assert.equal(inbox.canPurchaseServices,internal,role.id+': explicitly assigned icon');
  const r=await as(u,()=>services.GET());assert.equal(r.status,internal?200:403,role.id+': assigned HTTP');
  if(internal){const view=await r.json();assert.deepEqual(Array.from(view.services,s=>s.id),[sid],role.id+': receiver scope');assert.equal(view.services[0].canReceive,true);assert.equal(view.finance,role.id==='purchase_finance');const mcpView=await mcpRead('get_purchase_services',u);assert.deepEqual(Array.from(mcpView.services,s=>s.id),[sid],role.id+': MCP scope');}
  else await assert.rejects(()=>mcpRead('get_purchase_services',u));
  // Design receipt requires design authority even when it is explicitly assigned.
  sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify({...serviceData(mid),design:true}),sid);
  const allowed=purchaseRoles.has(role.id)||role.id==='engineering';assert.equal((await (await as(u,()=>tasks.GET())).json()).canPurchaseServices,allowed,role.id+': design icon');
  assert.equal((await as(u,()=>services.GET())).status,allowed?200:403,role.id+': design HTTP');
  sql.prepare('DELETE FROM flow_entities WHERE id=?').run(sid);
 }
 const tr=roleUsers.find(x=>x.role.id==='treasurer'),sid='treasury-receipt';entity(sid,serviceData(tr.mid));
 assert.equal((await (await as(tr.u,()=>tasks.GET())).json()).canPurchaseServices,true);
 sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify(serviceData('w')),sid);
 assert.equal((await (await as(tr.u,()=>tasks.GET())).json()).canPurchaseServices,false);assert.equal((await as(tr.u,()=>services.GET())).status,403);await assert.rejects(()=>mcpRead('get_purchase_services',tr.u));
 for(const [extra,allowed] of [['finance',false],['purchase_finance',true]]){const combined={...tr.u,permissions:policy.validatePermissions({roleAssignment:{roles:['treasurer',extra]}})};sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify(combined.permissions),tr.mid);assert.equal((await (await as(combined,()=>tasks.GET())).json()).canPurchaseServices,allowed,'Combined treasury + '+extra);assert.equal((await as(combined,()=>services.GET())).status,allowed?200:403);}
 sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify(tr.u.permissions),tr.mid);assert.equal((await (await as(tr.u,()=>tasks.GET())).json()).canPurchaseServices,false,'Removing the purchase role removes the icon');
 // Ownership is read from the source record, including completed receipts beyond the 300-task window.
 for(let n=0;n<301;n++)sql.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,supervisor,due,state,data,revision,created,updated) VALUES(?, 'test-limit', ?, 'w',NULL,?,'open',?,1,?,?)").run('limit:'+n,String(n),now,JSON.stringify({title:'Other work',instructions:'Test'}),now,now);
 const workerInbox=await (await as(worker,()=>tasks.GET())).json();assert.equal(workerInbox.tasks.length,300);assert.equal(workerInbox.canPurchaseServices,true);assert.ok(!workerInbox.tasks.some(t=>t.data.purchaseServiceWorkflow));
 // Member activation and current permissions override a stale caller's role grants.
 const purchase=roleUsers.find(x=>x.role.id==='purchase_finance');sql.prepare("UPDATE app_members SET permissions=? WHERE id=?").run(JSON.stringify(worker.permissions),purchase.mid);
 assert.equal((await (await as(purchase.u,()=>tasks.GET())).json()).canPurchaseServices,false);assert.equal((await as(purchase.u,()=>services.GET())).status,403);
 sql.prepare("UPDATE app_members SET status='disabled' WHERE id='w'").run();assert.equal((await (await as(worker,()=>tasks.GET())).json()).canPurchaseServices,false);assert.equal((await as(worker,()=>services.GET())).status,403);
 console.log('PASS specialized task access: '+roleUsers.length+' roles, unassigned/assigned HTTP and MCP scopes, design revocation, reassignment, stale roles, inactive accounts and ownership beyond 300 tasks.');
 console.log('Starter passed: 16 positions / 64 drafts, concurrent install once, normalized existing names, preserve edits/assignees, no automatic duties, safe activation dates, private own profiles and MCP edit parity.');
 console.log('Duties passed: concurrent/deduplicated scheduling, Tehran/Persian dates, owner/supervisor isolation, private evidence, required uploads, stale revisions, review, blocked/extension, no self approval, idempotency, no reminders after completion, scheduler auth and MCP scopes.');
})().catch(e=>{console.error(e);process.exit(1)});
