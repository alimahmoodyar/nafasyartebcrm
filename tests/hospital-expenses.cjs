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
 sql.prepare("DELETE FROM training_flow_entities WHERE id='training-expense-policy'").run();
 const tech='تکنسین خدمات',manager='هماهنگ‌کننده خدمات',finance='مالی خدمات',center='مسئول مرکز بیمارستانی ۱';
 const mid=name=>roles.find(r=>r.name===name).memberId;
 const entity=id=>{const r=sql.prepare('SELECT * FROM training_flow_entities WHERE id=?').get(id);return {...r,data:JSON.parse(r.data)}};
 const act=async(role,mode,fields={},expected=200)=>{const b={id:crypto.randomUUID(),mode,confirmed:true,...fields},r=await call(role,'hospital/expenses',b);assert.equal(r.status,expected,JSON.stringify(r));return {id:b.id,body:b,...r.d};};
 const today=load('lib/duties.ts').dayAt(),job='expense-test-job';
 sql.prepare("INSERT INTO training_flow_entities VALUES(?,'hospital_job',?,1,?,?)").run(job,JSON.stringify({centerId:'training-hospital-1',assetId:'training-hospital-asset-1',serial:'TEST',technicianId:mid(tech),state:'dispatched'}),today,today);
 const policy={title:'Test only',start:today,end:today,groups:[{id:'food',name:'Food',limit:'1000'}],categories:[{id:'breakfast',name:'Breakfast',groupId:'food'},{id:'lunch',name:'Lunch',groupId:'food'}],assignments:[{ownerId:mid(tech),managerId:mid(manager),financeId:mid(finance)}]};
 assert.equal((await call(center,'hospital/expenses')).status,403);
 await act(tech,'policy',policy,403);
 await act(finance,'policy',{...policy,assignments:[{ownerId:mid(tech),managerId:mid(tech),financeId:mid(finance)}]},400);
 const p=await act(finance,'policy',policy);
 async function upload(role,content){const id=crypto.randomUUID(),r=roles.find(r=>r.name===role),req=new Request(base+'/api/training/hospital/expenses/files?_role='+r.id+'&job='+job+'&id='+id+'&filename=invoice.pdf',{method:'POST',headers:{origin:base,'Content-Type':'application/pdf'},body:'%PDF-'+content});const res=await context.run(real,()=>training.trainingDispatch(req));return {status:res.status,id};}
 assert.equal((await upload(manager,'wrong')).status,403);
 const file=await upload(tech,'invoice-one');assert.equal(file.status,200);
 const fields={jobId:job,day:today,categoryId:'breakfast',amount:'600',vendor:'Test',reference:'A1',fileIds:[file.id],notes:'actual test evidence'};
 await act(tech,'submit',{...fields,fileIds:[]},400);
 const one=await act(tech,'submit',fields);assert.equal(entity(one.id).data.control.excess,'0');
 assert.equal((await call(tech,'hospital/expenses',one.body)).status,200);
 await act(tech,'submit',fields,400);
 const file2=await upload(tech,'invoice-two'),twoFields={...fields,categoryId:'lunch',amount:'700',reference:'A2',fileIds:[file2.id]};
 await act(tech,'submit',twoFields,400);
 const two=await act(tech,'submit',{...twoFields,explanation:'Test overage'});assert.equal(entity(two.id).data.control.excess,'300');
 assert.equal(sql.prepare("SELECT count(*) n FROM training_duty_runs WHERE id LIKE 'expense:%' AND state='open'").get().n,2);
 // General hospital task sync cannot prematurely close expense approvals.
 await context.run(real,()=>training.trainingDispatch(request('/api/training/hospital?_role='+roles.find(r=>r.name===manager).id,{id:crypto.randomUUID(),mode:'pm_scan',confirmed:true})));
 assert.equal(sql.prepare("SELECT count(*) n FROM training_duty_runs WHERE id LIKE 'expense:%' AND state='open'").get().n,2);
 const review=id=>({claimId:id,revision:entity(id).revision,approved:true,notes:'Checked actual receipt'});
 await act(finance,'finance_review',review(two.id),409);
 await act(tech,'manager_review',review(two.id),403);
 await act(manager,'manager_review',review(two.id),400);
 await act(manager,'manager_review',{...review(two.id),acceptOverLimit:true});
 assert.ok(JSON.stringify((await call(finance,'tasks')).d).includes('expense:'+two.id+':finance'));
 await act(finance,'finance_review',review(two.id),400);
 await act(finance,'finance_review',{...review(two.id),acceptOverLimit:true});assert.equal(entity(two.id).data.state,'approved');
 await act(finance,'policy',{...policy,policyId:p.id,revision:entity(p.id).revision},400);
 const data=await call(manager,'hospital/expenses');assert.equal(data.d.claims.length,2);
 const other=await call('مدیر خدمات پس از فروش','hospital/expenses');assert.equal(other.d.claims.length,0);
 assert.equal((await call('مدیر خدمات پس از فروش','hospital/expenses/files?id='+file.id)).status,404);
 await act(manager,'manager_review',{...review(one.id),approved:false,notes:'Rejected'});assert.equal(entity(one.id).data.state,'rejected');
 assert.equal(sql.prepare("SELECT count(*) n FROM flow_entities WHERE type GLOB 'expense_*'").get().n,0);
 const reset=load('lib/reset-contract.ts');assert.ok(!reset.resetFlowPreserved.includes('expense_claim'));
 // Company freeze/rollback integrity, using existing generic triggers.
 const before=sql.prepare('SELECT count(*) n FROM training_flow_entities').get().n;
 try{await db.batch([db.prepare("INSERT INTO training_flow_entities VALUES('rollback-expense','expense_claim','{}',1,'x','x')"),db.prepare("INSERT INTO training_flow_entities VALUES('rollback-expense','expense_claim','{}',1,'x','x')")]);assert.fail('rollback expected')}catch{}assert.equal(sql.prepare('SELECT count(*) n FROM training_flow_entities').get().n,before);
 sql.prepare("INSERT INTO reset_control(id,phase,updated) VALUES(1,'maintenance','now') ON CONFLICT(id) DO UPDATE SET phase='maintenance',internal=0").run();
 for(const type of ['expense_policy','expense_claim','expense_file'])assert.throws(()=>sql.prepare('INSERT INTO flow_entities VALUES(?,?,?,1,?,?)').run('freeze-'+type,type,'{}','x','x'),/RESET_MAINTENANCE/);
 console.log('Hospital expenses: sequential independent approval, daily combined caps, duplicate evidence, privacy, tasks, training isolation and rollback passed');
})().catch(e=>{console.error(e);process.exitCode=1});
