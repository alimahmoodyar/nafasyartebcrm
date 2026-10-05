const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{body:b,arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let modelReply={sourceIds:[],unanswered:true},modelCalls=[];let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},fetch:async(url,options)=>{modelCalls.push(JSON.parse(options.body));return Response.json({choices:[{message:{content:JSON.stringify(modelReply)}}]})},Response,Request,Headers,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}

const context=load('lib/mcp/context.ts').mcpActor, training=load('lib/training.ts'), roles=load('lib/training-contract.ts').trainingRoles;
const real={userId:'real-tester',email:'tester@example.com',name:'Tester',isAdmin:false,permissions:{read:[],write:[],eventStages:[]}};
const base='https://test.local';
const request=(path,body)=>new Request(base+path,{method:body?'POST':'GET',headers:{origin:base,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function call(name,path,body){const role=roles.find(r=>r.name===name);const r=await context.run(real,()=>training.trainingDispatch(request('/api/training/'+path+(path.includes('?')?'&':'?')+'_role='+role.id,body)));let d;try{d=await r.json()}catch{d={}};return {status:r.status,d};}

(async()=>{
 await context.run(real,()=>training.trainingInitialize(request('/api/training',{confirmed:true})));
 const tech='تکنسین خدمات',manager='هماهنگ‌کننده خدمات',center='مسئول مرکز بیمارستانی ۱',finance='مالی خدمات',aid='training-hospital-asset-1',job='field-test-job',today=load('lib/duties.ts').dayAt();
 const entity=id=>{const r=sql.prepare('SELECT * FROM training_flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
 const act=async(role,mode,fields={},expected=200)=>{const b={id:crypto.randomUUID(),mode,confirmed:true,...fields},r=await call(role,'hospital',b);assert.equal(r.status,expected,JSON.stringify(r));return {id:b.id,...r.d};};
 sql.prepare("INSERT INTO training_flow_entities VALUES(?,'hospital_job',?,1,?,?)").run(job,JSON.stringify({centerId:'training-hospital-1',assetId:aid,serial:'TEST',technicianId:roles.find(r=>r.name===tech).memberId,state:'dispatched',dispatch:{at:new Date().toISOString()}}),today,today);
 const fields=[{key:'visual',label:'Visual test only',type:'result',unit:'',min:'',max:'',required:true}];
 const form=await act(manager,'form',{assetId:aid,title:'Field test',reference:'Training',state:'published',audience:'technician',fields});
 assert.ok(!(await call(center,'hospital')).d.rows.some(r=>r.id===form.id));
 await act(center,'form_submit',{formId:form.id,revision:1,values:{visual:'pass'}},400);
 await act(finance,'part_request',{jobId:job,partName:'Test',quantity:'1',notes:'Test'},403);
 const part=await act(tech,'part_request',{jobId:job,partName:'Test component',quantity:'1',notes:'Fault at visit'});
 assert.ok(sql.prepare("SELECT id FROM training_duty_runs WHERE state='open' AND template_id LIKE ?").get('hospital:'+part.id+':%'));
 await act(manager,'part_review',{requestId:part.id,revision:1,approved:true,notes:'Arrange stock issue separately'});
 assert.equal(entity(part.id).data.state,'approved');
 assert.ok(!(await call(center,'hospital')).d.rows.some(r=>r.id===part.id));
 const file=crypto.randomUUID(),role=roles.find(r=>r.name===tech);const upload=new Request(base+'/api/training/hospital/files?_role='+role.id+'&id='+file+'&center=training-hospital-1&asset='+aid+'&job='+job+'&purpose=report&filename=minutes.pdf',{method:'POST',headers:{origin:base,'Content-Type':'application/pdf'},body:'%PDF-training minutes'});
 const ur=await context.run(real,()=>training.trainingDispatch(upload));assert.equal(ur.status,200,await ur.text());
 assert.equal((await call(center,'hospital/files?id='+file)).status,403);
 const complete={jobId:job,revision:entity(job).revision,work:'Actual test work',test:'Measured result',fileIds:[file],formId:form.id};
 await act(tech,'complete',{...complete,values:{}},409);
 await act(tech,'complete',{...complete,values:{visual:'pass'}});
 assert.equal(entity(job).data.state,'completed');assert.equal(entity(job).data.report.checklist.version,1);assert.equal(entity(job).data.report.fileIds[0],file);
 assert.equal((await call(center,'hospital/files?id='+file)).status,200);assert.equal((await call('مسئول مرکز بیمارستانی ۲','hospital/files?id='+file)).status,404);
 assert.equal(entity(job).data.confirmation,undefined);
 console.log('Field technician: job evidence, signed minutes separation, device checklist, part request workflow and center privacy passed');
})().catch(e=>{console.error(e);process.exitCode=1});
