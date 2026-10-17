const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,typeof b==='string'?b:new Uint8Array(b).slice());return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),text:async()=>typeof b==='string'?b:new TextDecoder().decode(b)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}


const ctx=load('lib/mcp/context.ts').mcpActor,api=load('app/api/qms/route.ts'),files=load('app/api/qms/files/route.ts'),domain=load('lib/qms.ts'),catalog=load('lib/mcp/tools.ts'),tasks=load('app/api/tasks/route.ts'),flow=load('app/api/flow/route.ts'),resetApi=load('app/api/system-reset/backup/route.ts');
let tail=Promise.resolve();const batch=db.batch.bind(db);db.batch=stmts=>{const next=tail.then(()=>batch(stmts));tail=next.catch(()=>{});return next};
const base='https://test.local',now=new Date().toISOString(),today=now.slice(0,10);
const req=(url,b)=>new Request(base+url,{method:b?'POST':'GET',headers:{origin:base,'Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});
function actor(id,permissions={},isAdmin=false){const u={userId:'local:'+id,email:id+'@test.local',name:id,isAdmin,permissions:{read:[],write:[],eventStages:[],...permissions}};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'company','active',?,?,?,?)").run(id,u.email,id,u.userId,JSON.stringify(u.permissions),now,now);return u;}
const eng=actor('eng',{supplyRoles:['engineering']}),ceo=actor('ceo',{supplyRoles:['ceo']}),eng2=actor('eng2',{supplyRoles:['engineering']}),qa=actor('qa',{qmsRoles:['qa']}),qa2=actor('qa2',{qmsRoles:['qa']}),viewer=actor('viewer',{qmsRoles:['observer']}),admin=actor('admin',{},true),external=actor('external',{salesAgentId:'outside',salesRoles:['agent']}),ordinary=actor('ordinary');
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
async function invoke(u,handler,url,b){const r=await ctx.run(u,()=>handler(req(url,b)));return {status:r.status,data:await r.json()}}
const get=u=>invoke(u,api.GET,'/api/qms');const post=(u,b)=>invoke(u,api.POST,'/api/qms',{id:crypto.randomUUID(),confirmed:true,revision:0,notes:'Actual evidence',...b});
async function ok(u,b){const r=await post(u,b);assert.equal(r.status,200,JSON.stringify({b,r}));return r.data.id;}
const apply=(u,id,mode,extra={})=>post(u,{recordId:id,revision:row(id).revision,mode,...extra});
const success=async(u,id,mode,extra={})=>{const r=await apply(u,id,mode,extra);assert.equal(r.status,200,JSON.stringify({mode,r}));return r.data.id};
const seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
const values=kind=>Object.fromEntries(load('lib/qms-contract.ts').qmsKinds[kind].fields.map(f=>[f.key,f.type==='date'?today:'Recorded evidence']));
const basic=(kind,extra={})=>({mode:'save',kind,title:kind==='design'?'SECRET-DESIGN':'Actual '+kind,productId:'p1',ownerId:'eng',reviewerId:'ceo',due:today,values:values(kind),...extra});
const filepost=(u,b)=>invoke(u,files.POST,'/api/qms/files',{id:crypto.randomUUID(),confirmed:true,...b});
async function part(u,id,index,bytes,op=crypto.randomUUID()){const r=await ctx.run(u,()=>files.PUT(new Request(base+'/api/qms/files?fileId='+id+'&part='+index,{method:'PUT',headers:{origin:base,'x-operation-id':op},body:bytes})));return {status:r.status,data:await r.json()}}
const controls=load('lib/form-control.ts'),registry=load('app/api/form-controls/route.ts'),printApi=load('app/api/form-controls/report/route.ts'),qualityApi=load('app/api/quality/reports/route.ts');
const inventory=actor('inventory',{flowRoles:['inventory']}),qc=actor('qc',{flowRoles:['qc']}),production=actor('production',{flowRoles:['production']});
const snapshot=id=>JSON.parse(sql.prepare("SELECT data FROM flow_entities WHERE id=? AND type='form_record'").get('form-report:'+id).data);
async function op(mode,body,u=admin){const id=body.id||crypto.randomUUID(),r=await invoke(u,flow.POST,'/api/flow',{id,mode,...body});assert.equal(r.status,200,JSON.stringify(r));return id;}
const document=(target,code,revision='00',productId='')=>basic('document',{productId,ownerId:'qa',reviewerId:'qa2',formTarget:target,formRevision:revision,values:{...values('document'),code,effective:'2026-01-01'}});
async function publish(id){await success(qa,id,'submit');await success(qa2,id,'approve');}
(async()=>{
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('p1','product',?,?)").run(JSON.stringify({name:'Synthetic product',code:'P1',status:'فعال'}),now);
 const doc=await ok(qa,document('flow.incoming_qc','QC-F-01'));
 assert.equal(controls.documentControl(await controls.controlledDocuments(),'flow.incoming_qc'),null);
 assert.equal((await apply(qa,doc,'approve')).status,403);
 assert.equal((await post(inventory,document('flow.receipt','INV-01'))).status,403);
 assert.equal((await post(qa,{...document('flow.receipt','PRIVATE'),private:true})).status,400);
 await publish(doc);
 const duplicate=await ok(qa,document('flow.receipt','QC-F-01'));assert.equal((await apply(qa,duplicate,'submit')).status,400);
 const sameTarget=await ok(qa,document('flow.incoming_qc','OTHER'));assert.equal((await apply(qa,sameTarget,'submit')).status,400);
 const fields=[{label:'ظاهری',type:'result',unit:'',min:'',max:'',required:true,deviceId:'SECRET-NESTED'}];
 const materialOp=await op('material',{code:'812',name:'Synthetic <script>alert(1)</script>',unit:'عدد',specs:'',revision:0,fields,deviceId:'SECRET-UNRELATED',formControl:{code:'FORGED'}});
 assert.equal(snapshot(materialOp).control,null);assert.ok(!JSON.stringify(snapshot(materialOp)).includes('SECRET-UNRELATED'));assert.ok(!JSON.stringify(snapshot(materialOp)).includes('SECRET-NESTED'));assert.ok(!JSON.stringify(snapshot(materialOp)).includes('FORGED'));
 const material=row('material:812'),key=material.data.fields[0].key;
 const receipt=async()=>{await op('receipt',{materialId:material.id,day:'2026-10-01',quantity:'2',supplier:'Synthetic'});return sql.prepare("SELECT id FROM flow_entities WHERE type='receipt' AND json_extract(data,'$.state')='pending_qc' ORDER BY created DESC,id DESC").get().id;};
 const firstReceipt=await receipt(),qcBody={receiptId:firstReceipt,accepted:'2',values:{[key]:'pass'},notes:'Checked'};
 const first=await op('incoming_qc',qcBody);assert.equal(snapshot(first).control.code,'QC-F-01');assert.equal(snapshot(first).control.revision,'00');assert.ok(snapshot(first).rows.some(r=>r.label.includes('ظاهری')&&r.value==='قبول'));
 const rowsBefore=sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='form_record'").get().n;await op('incoming_qc',{...qcBody,id:first});assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='form_record'").get().n,rowsBefore);
 const revision=await success(qa,doc,'revise');const revised=()=>({...document('flow.incoming_qc','QC-F-01','01'),recordId:revision,revision:row(revision).revision});
 await ok(qa,revised());await publish(revision);assert.equal(row(doc).data.state,'superseded');
 assert.equal(snapshot(first).control.revision,'00');assert.equal(controls.documentControl(await controls.controlledDocuments(),'flow.incoming_qc').revision,'01');
 const second=await op('incoming_qc',{receiptId:await receipt(),accepted:'2',values:{[key]:'pass'},notes:'Second'});assert.equal(snapshot(second).control.revision,'01');
 // Future approved successor does not apply prematurely; previous effective version remains selected.
 const docs=await controls.controlledDocuments();const future={id:'future',data:{...row(revision).data,version:3,formRevision:'02',values:{...row(revision).data.values,effective:'2099-01-01'}}};assert.equal(controls.documentControl([...docs,future],'flow.incoming_qc').revision,'01');
 assert.equal(controls.formRecordAccess(production,'fulfillment.handoff'),true);assert.equal(controls.formRecordAccess(production,'fulfillment.dispatch'),false);assert.equal(controls.formRecordAccess(qc,'fulfillment.dispatch'),false);
 const reg=await invoke(qa,registry.GET,'/api/form-controls');assert.equal(reg.status,200);assert.equal(reg.data.forms.find(f=>f.target==='flow.incoming_qc').current.code,'QC-F-01');assert.equal((await invoke(inventory,registry.GET,'/api/form-controls')).status,403);
 const list=await invoke(inventory,registry.GET,'/api/form-controls?view=records');assert.equal(list.status,200);assert.ok(list.data.records.some(r=>r.id===first));
 const denied=await invoke(ordinary,printApi.GET,'/api/form-controls/report?id='+first);assert.equal(denied.status,403);assert.equal((await invoke(external,registry.GET,'/api/form-controls?view=records')).status,403);
 const missing=await invoke(admin,printApi.GET,'/api/form-controls/report?id=old-record');assert.equal(missing.status,404);
 const report=await invoke(qc,printApi.GET,'/api/form-controls/report?id='+first+'&format=json');assert.equal(report.data.control.revision,'00');
 const html=await ctx.run(admin,()=>printApi.GET(req('/api/form-controls/report?id='+materialOp)));assert.equal(html.status,200);const text=await html.text();assert.ok(text.includes('&lt;script&gt;'));assert.ok(!text.includes('<script>alert'));assert.ok(text.includes('کد و بازنگری مصوب در زمان ثبت این برگه تعریف نشده بود'));
 // Real MCP uses the same authenticated handler and read/write policies.
 const principal=u=>({user:u,scope:'read',tokenId:null});const mcp=await catalog.executeTool('get_form_control_registry',{},base,principal(qa));assert.ok(mcp.forms.some(f=>f.current?.code==='QC-F-01'));
 const mcpList=await catalog.executeTool('list_registered_forms',{},base,principal(inventory));assert.ok(mcpList.records.some(r=>r.id===first));
 const mcpReport=await catalog.executeTool('get_registered_form',{id:first,format:'json'},base,principal(qc));assert.equal(mcpReport.control.revision,'00');
 await assert.rejects(()=>catalog.executeTool('get_registered_form',{id:first,format:'json'},base,principal(ordinary)),/دسترسی/);
 // Final QC keeps a per-product controlled-code snapshot and includes it in exports.
 const finalDoc=await ok(qa,document('quality.final','QC-F-02','A','p1'));await publish(finalDoc);
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('d1','device',?,?)").run(JSON.stringify({product:'p1',code:'SYNTHETIC-1'}),now);
 sql.prepare('INSERT INTO quality_templates(id,product_id,version,title,fields,created,created_by) VALUES(?,?,1,?,?,?,?)').run('t1','p1','Final fixture',JSON.stringify([{...fields[0],key:'appearance'}]),now,'qa');
 const finalId=crypto.randomUUID(),response=await invoke(qc,qualityApi.POST,'/api/quality/reports',{deviceId:'d1',templateId:'t1',requestId:finalId,verdict:'pass',notes:'Actual check',values:{appearance:'pass'}});assert.equal(response.status,201,JSON.stringify(response));assert.equal(response.data.report.documentControl.revision,'A');assert.equal(response.data.report.hasFormRecord,true);
 const registeredPrint=await ctx.run(qc,()=>printApi.GET(req('/api/form-controls/report?id='+first)));const registeredHtml=await registeredPrint.text();assert.ok(registeredHtml.includes('QC-F-01'));assert.ok(registeredHtml.includes('00'));if(process.env.FORM_CONTROL_QA){fs.mkdirSync('outputs/qa-hospital-service',{recursive:true});fs.writeFileSync('outputs/qa-hospital-service/form-control-print.html',registeredHtml);}
 const finalList=await invoke(qc,qualityApi.GET,'/api/quality/reports?device=d1');assert.equal(finalList.data.reports[0].documentControl.code,'QC-F-02');assert.ok(!(await invoke(inventory,registry.GET,'/api/form-controls?view=records')).data.records.some(r=>r.id===finalId));
 // Archive creation and domain writes roll back together on document races and reset freeze.
 const raceId=crypto.randomUUID(),statements=await controls.captureForm(raceId,'flow.receipt',{supplier:'Test'},admin);sql.prepare('UPDATE flow_entities SET revision=revision+1 WHERE id=?').run(revision);await assert.rejects(()=>db.batch(statements));assert.ok(!row('form-report:'+raceId));assert.ok(!sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get('form-control:'+raceId));
 const frozenId=crypto.randomUUID(),frozen=await controls.captureForm(frozenId,'flow.receipt',{},admin);sql.exec("UPDATE reset_control SET phase='maintenance'");await assert.rejects(()=>db.batch(frozen));assert.ok(!row('form-report:'+frozenId));sql.exec("UPDATE reset_control SET phase='testing'");
 const reset=load('lib/reset-contract.ts');for(const scope of ['operations','full']){sql.exec('BEGIN');sql.exec('DELETE FROM flow_entities WHERE '+reset.resetWhere('flow_entities',scope));assert.ok(!row('form-report:'+first));assert.equal(!!row(doc),scope==='operations');sql.exec('ROLLBACK');assert.equal(snapshot(first).control.revision,'00');}
 console.log('Form control passed: public maker/checker document bindings, duplicate/private rejection, effective revisions, immutable registration/code/answers, input allowlist, HTTP/MCP read scopes, HTML escaping, final QC exports, race/freeze/reset rollback.');
})().catch(e=>{console.error(e);process.exitCode=1});
