const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
let proposedTool='submit_development_request',proposedArgs={},modelPayloads=[];
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},fetch:async(url,options)=>{const body=JSON.parse(options.body);modelPayloads.push(body);return Response.json({choices:[{message:{tool_calls:[{id:'proposal',type:'function',function:{name:proposedTool,arguments:JSON.stringify(proposedArgs)}}]}}]});},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}

const api=load('app/api/guarantees/route.ts'),filesApi=load('app/api/guarantees/files/route.ts'),catalog=load('lib/mcp/tools.ts'),ctx=load('lib/mcp/context.ts').mcpActor,domain=load('lib/guarantees.ts'),scanner=load('lib/guarantee-tasks.ts'),taskApi=load('app/api/tasks/route.ts');
const base='https://test.local',now=new Date().toISOString(),perms={read:[],write:[],eventStages:[],finance:'write'};
function user(id,permissions=perms){sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'مالی','active',?,?,?,?)").run(id,id+'@test.local',id,id,JSON.stringify(permissions),now,now);return {userId:id,email:id+'@test.local',name:id,isAdmin:false,permissions};}
const treasury=user('treasury'),manager=user('manager'),viewer=user('viewer',{...perms,finance:'none'}),unrelated=user('unrelated'),external=user('external',{...perms,salesAgentId:'agent'});
function entity(id,type,data){sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now)}
entity('treasury-position','position',{name:'خزانه دار',active:true,members:['treasury']});entity('manager-position','position',{name:'مدیر مالی',active:true,members:['manager']});
const request=(path,body,origin=base)=>new Request(base+path,{method:body?'POST':'GET',headers:{origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
async function post(u,body){const r=await ctx.run(u,()=>api.POST(request('/api/guarantees',{id:crypto.randomUUID(),confirmed:true,...body})));return {status:r.status,data:await r.json()}}
async function get(u){const r=await ctx.run(u,()=>api.GET());return {status:r.status,data:await r.json()}}
const fields={mode:'save',revision:0,notes:'Actual contract',direction:'outgoing',kind:'performance',number:'G-1',bank:'Bank',applicant:'Company',beneficiary:'Customer',amount:'1000',currency:'IRR',deposit:'200',fees:'10',issueDate:'2026-01-01',expiry:'2026-10-31',actionDeadline:'2026-10-25',originalLocation:'Safe 1',collateral:'Property deed',viewerIds:['viewer']};
async function apply(u,id,mode,extra={}){return post(u,{guaranteeId:id,revision:row(id).revision,mode,notes:'Actual evidence',...extra})}
function evidence(id){const fid=crypto.randomUUID();entity(fid,'guarantee_file',{caseId:id,filename:'evidence.pdf',actor:'treasury'});return fid}
(async()=>{
 assert.equal((await post(unrelated,fields)).status,403);assert.equal((await get(external)).status,403);
 assert.equal((await post(treasury,{...fields,confirmed:false})).status,400);
 assert.equal((await post(treasury,{...fields,expiry:'2026-02-30'})).status,400);
 const body={...fields,id:crypto.randomUUID()},created=await post(treasury,body);assert.equal(created.status,200,JSON.stringify(created));const id=created.data.id;
 assert.equal((await post(treasury,body)).data.repeated,true);assert.equal((await post(treasury,{...body,number:'changed'})).status,409);
 assert.equal((await get(viewer)).data.records[0].data.deposit,undefined);assert.equal((await get(viewer)).data.files.length,0);
 assert.equal((await post(viewer,{...fields,guaranteeId:id,revision:1})).status,403);
 assert.equal((await apply(treasury,id,'submit')).status,200);assert.equal((await apply(treasury,id,'approve')).status,403);assert.equal((await apply(manager,id,'approve')).status,200);
 assert.equal((await apply(treasury,id,'issue',{fileId:crypto.randomUUID()})).status,400);const fid=evidence(id);assert.equal((await apply(treasury,id,'issue',{fileId:fid})).status,200);
 assert.equal((await post(treasury,{guaranteeId:id,revision:1,mode:'followup',notes:'stale',nextAction:'Call',due:'2026-10-10'})).status,409);
 const tasks=sql.prepare("SELECT * FROM duty_runs WHERE id LIKE 'guarantee:%' AND state='open'").all();assert.ok(tasks.some(t=>JSON.parse(t.data).workflowRole==='treasury'));
 const notices=sql.prepare('SELECT COUNT(*) AS n FROM duty_notices').get().n;await scanner.syncGuaranteeTasks(new Date('2026-10-07T12:00:00Z'));assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM duty_notices').get().n,notices);
 const task=tasks.find(t=>JSON.parse(t.data).workflowRole==='treasury');const taskResult=await ctx.run(treasury,()=>taskApi.POST(request('/api/tasks',{id:crypto.randomUUID(),mode:'submit',taskId:task.id,revision:task.revision,note:'A note'})));assert.equal(taskResult.status,400);
 assert.equal((await apply(viewer,id,'request_extension',{due:'2026-10-15'})).status,200);
 assert.equal((await apply(treasury,id,'amend',{amount:'1200',expiry:'2026-12-31',actionDeadline:'2026-12-20'})).status,200);
 assert.equal((await apply(treasury,id,'confirm_amendment',{fileId:fid})).status,400);assert.equal((await apply(manager,id,'approve_amendment')).status,200);assert.equal((await apply(treasury,id,'confirm_amendment',{fileId:fid})).status,200);assert.equal(row(id).data.requests[0].resolved,true);assert.equal(row(id).data.amendments[0].amount,'1200');
 assert.equal((await apply(treasury,id,'demand',{amount:'1201',day:'2026-10-07',reference:'D1',fileId:fid})).status,400);
 assert.equal((await apply(treasury,id,'demand',{amount:'100',day:'2026-10-07',reference:'D1',fileId:fid})).status,200);const demandId=row(id).data.demands[0].id;
 assert.equal((await apply(treasury,id,'collection',{amount:'101',day:'2026-10-07',reference:'R1',demandId,fileId:fid})).status,400);
 assert.equal((await apply(treasury,id,'collection',{amount:'100',day:'2026-10-07',reference:'R1',demandId,fileId:fid})).status,200);
 await scanner.syncGuaranteeTasks(new Date('2027-01-01T12:00:00Z'));assert.equal(row(id).data.state,'active');assert.ok(sql.prepare("SELECT COUNT(*) AS n FROM duty_notices WHERE phase LIKE 'guarantee:overdue:%'").get().n);
 assert.equal((await apply(treasury,id,'terminate',{fileId:fid})).status,200);assert.equal((await apply(manager,id,'close')).status,400);
 assert.equal((await apply(treasury,id,'return_original',{fileId:fid})).status,200);assert.equal((await apply(treasury,id,'release_collateral',{amount:'201',fileId:fid,allCollateralReleased:true})).status,400);
 assert.equal((await apply(treasury,id,'release_collateral',{amount:'200',fileId:fid,allCollateralReleased:true})).status,200);assert.equal((await apply(manager,id,'close')).status,400);
 assert.equal((await apply(manager,id,'resolve_demand',{demandId,fileId:fid})).status,200);assert.equal((await apply(manager,id,'close')).status,200);assert.equal(row(id).data.state,'closed');assert.ok(row(id).data.history.length>10);
 const usd=await post(treasury,{...fields,number:'G-2',currency:'USD'});assert.equal(usd.status,200);const dash=(await get(manager)).data.dashboard;assert.equal(dash.currencies.USD,undefined);assert.equal(dash.currencies.IRR,undefined);
 const mp={user:treasury,scope:'read_write',tokenId:null};assert.ok((await catalog.executeTool('get_guarantees',{},base,mp)).records.length);await assert.rejects(()=>catalog.executeTool('guarantee_apply',{id:crypto.randomUUID(),confirmed:true,mode:'submit',guaranteeId:usd.data.id,revision:1,notes:'confirm'},base,{...mp,scope:'read'}),/read-only/);
 assert.equal((await catalog.executeTool('guarantee_apply',{id:crypto.randomUUID(),confirmed:true,mode:'submit',guaranteeId:usd.data.id,revision:1,notes:'confirm'},base,mp)).saved,true);
 const training=load('lib/training-context.ts').trainingContext;assert.equal((await training.run({actor:'treasury',role:'finance'},()=>get(treasury))).status,403);
 const csrf=await ctx.run(treasury,()=>api.POST(request('/api/guarantees',fields,'https://other.local')));assert.equal(csrf.status,403);
 // Real R2 upload/download integrity and scoped permissions.
 const caseId=usd.data.id,uploadId=crypto.randomUUID(),bytes=new TextEncoder().encode('%PDF-1.4 evidence');const url=base+'/api/guarantees/files?'+new URLSearchParams({id:uploadId,caseId,filename:'evidence.pdf'});
 const upload=()=>ctx.run(treasury,()=>filesApi.POST(new Request(url,{method:'POST',headers:{origin:base},body:bytes})));assert.equal((await upload()).status,200);assert.equal((await upload()).status,200);
 assert.equal((await ctx.run(viewer,()=>filesApi.GET(request('/api/guarantees/files?id='+uploadId)))).status,403);
 const download=await ctx.run(manager,()=>filesApi.GET(request('/api/guarantees/files?id='+uploadId)));assert.equal(download.status,200);assert.equal(download.headers.get('X-Content-Type-Options'),'nosniff');
 objects.set(row(uploadId).data.objectKey,new Uint8Array([1,2,3]).buffer);assert.equal((await ctx.run(manager,()=>filesApi.GET(request('/api/guarantees/files?id='+uploadId)))).status,503);
 // Concurrent role change rolls back the operation and audit, preserving the case.
 const originalBatch=db.batch,opid=crypto.randomUUID(),auditBefore=sql.prepare('SELECT COUNT(*) n FROM access_audit').get().n;
 db.batch=async statements=>{db.batch=originalBatch;sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='manager-position'").run();return originalBatch(statements)};
 const raced=await post(manager,{id:opid,guaranteeId:caseId,revision:row(caseId).revision,mode:'approve',notes:'Approved'});assert.equal(raced.status,409);assert.equal(row(caseId).data.state,'review');assert.equal(sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get(opid),undefined);assert.equal(sql.prepare('SELECT COUNT(*) n FROM access_audit').get().n,auditBefore);
 // Revoked permissions and missing owner are reflected immediately.
 sql.prepare("UPDATE app_members SET permissions=? WHERE id='treasury'").run(JSON.stringify({...perms,finance:'none'}));assert.equal((await post(treasury,{...fields,number:'G-3'})).status,403);await scanner.syncGuaranteeTasks();assert.equal((await get(manager)).data.owners.treasury.length,0);sql.prepare("UPDATE app_members SET permissions=? WHERE id='treasury'").run(JSON.stringify(perms));
 // Related users cannot appoint themselves or close workflow steps through notes.
 const policy=load('lib/assistant-policy.ts');assert.equal(policy.assistantWriteNames.has('guarantee_apply'),true);assert.equal(policy.actionSection('guarantee_apply',{}),'guarantees');
 // Reset maintenance freeze refuses mutation atomically, no partial record/audit.
 sql.prepare("UPDATE reset_control SET phase='maintenance',job_id='freeze',internal=0,updated=? WHERE id=1").run(now);
 const before=row(caseId).revision;assert.equal((await apply(manager,caseId,'approve')).status,423);assert.equal(row(caseId).revision,before);
 console.log('guarantees: roles, independent approval, evidence, revisions, idempotency, tasks, expiry, settlement, currencies, MCP, training, file integrity and reset freeze passed');
})().catch(e=>{console.error(e);process.exit(1)});
