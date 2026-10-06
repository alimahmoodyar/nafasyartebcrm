const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,Headers,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}

const context=load('lib/mcp/context.ts').mcpActor, training=load('lib/training.ts'), roles=load('lib/training-contract.ts').trainingRoles;
const real={userId:'real-tester',email:'tester@example.com',name:'Tester',isAdmin:false,permissions:{read:[],write:[],eventStages:[]}};
const base='https://test.local';
const request=(path,body)=>new Request(base+path,{method:body?'POST':'GET',headers:{origin:base,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function call(name,path,body){const role=roles.find(r=>r.name===name);const r=await context.run(real,()=>training.trainingDispatch(request('/api/training/'+path+(path.includes('?')?'&':'?')+'_role='+role.id,body)));let d;try{d=await r.json()}catch{d={}};return {status:r.status,d};}
(async()=>{
 const r=await context.run(real,()=>training.trainingInitialize(request('/api/training',{confirmed:true})));assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
 assert.equal(sql.prepare('SELECT count(*) n FROM records').get().n,0);
 assert.equal(sql.prepare('SELECT count(*) n FROM app_members').get().n,0);
 console.log('seed',await r.json());
 for(const [role,path] of [['انبار','flow'],['کنترل کیفیت','flow'],['تولید','production'],['مدیر فروش','sales'],['نماینده فروش','sales'],['مدیر خدمات پس از فروش','after-sales?domain=home'],['کارشناس خرید داخلی','suppliers'],['برنامه‌ریز فروش','sourcing'],['انبار','tasks'],['مدیر فروش','sales/monitor']]){const out=await call(role,path);assert.equal(out.status,200,role+' '+path+' '+JSON.stringify(out.d));console.log('read',role,path);}
 const catalog=load('lib/mcp/tools.ts');assert.equal(catalog.validateToolArguments('initialize_training_workspace',{confirmed:true}),true);assert.equal(catalog.validateToolArguments('initialize_training_workspace',{confirmed:false}),false);assert.equal(catalog.validateToolArguments('training_workspace_request',{confirmed:true,roleId:'role-35',path:'hospital',method:'GET',body:''}),true);
 assert.equal((await call('مدیر سامانه','llm-usage')).status,403);
 const forbidden=await call('مدیر سامانه','users');assert.equal(forbidden.status,403);

 const repeat=await context.run(real,()=>training.trainingInitialize(request('/api/training',{confirmed:true})));assert.equal(repeat.status,200);
 assert.equal(sql.prepare("SELECT count(*) n FROM training_records WHERE kind='batch'").get().n,12);
 assert.equal(sql.prepare("SELECT count(*) n FROM training_flow_entities WHERE type='sales_order'").get().n,3);
 assert.equal(sql.prepare("SELECT count(*) n FROM training_flow_entities WHERE type='as_case'").get().n,2);
 // Same real employee switches personas; domain permissions remain enforced.
 const receipt={id:crypto.randomUUID(),mode:'receipt',materialId:'material:1001',day:load('lib/duties.ts').dayAt(),quantity:'4',supplier:'فرضی',notes:'تست'};
 const receive=await call('انبار','flow',receipt);assert.equal(receive.status,200,JSON.stringify(receive.d));
 const receiptId=sql.prepare("SELECT id FROM training_flow_entities WHERE type='receipt' AND id LIKE 'batch:%'").get().id;
 const qctasks=(await call('کنترل کیفیت','tasks')).d.tasks;
 const qctask=qctasks.find(t=>t.data.materialWorkflow&&t.data.sourceId===receiptId);assert.ok(qctask,'QC task created for new receipt');
 assert.ok(sql.prepare('SELECT id FROM training_duty_notices WHERE task_id=?').get(qctask.id),'QC notification persisted');
 const denied=await call('انبار','flow',{id:crypto.randomUUID(),mode:'incoming_qc',receiptId,accepted:'4',rejected:'0',values:{appearance:'pass'},notes:'کیفیت فرضی'});assert.equal(denied.status,403);
 const missingValues=await call('کنترل کیفیت','flow',{id:crypto.randomUUID(),mode:'incoming_qc',receiptId,accepted:'4',rejected:'0',values:{},notes:'همه تأیید'});assert.equal(missingValues.status,400,'QC cannot be completed without the material checklist');
 const qc=await call('کنترل کیفیت','flow',{id:crypto.randomUUID(),mode:'incoming_qc',receiptId,accepted:'4',rejected:'0',values:{appearance:'pass'},notes:'کیفیت فرضی'});assert.equal(qc.status,200,JSON.stringify(qc.d));
 assert.equal(sql.prepare('SELECT state FROM training_duty_runs WHERE id=?').get(qctask.id).state,'completed');
 const refreshedQC=(await call('کنترل کیفیت','tasks')).d;assert.equal(refreshedQC.tasks.find(t=>t.id===qctask.id).state,'completed');assert.ok(!refreshedQC.notifications.some(n=>n.task_id===qctask.id),'completed QC must not leave an actionable notice');
 const warehouseTasks=(await call('انبار','tasks')).d.tasks;assert.ok(warehouseTasks.some(t=>t.data.materialWorkflow&&t.data.sourceId===receiptId&&t.state==='open'));
 const shelf=await call('انبار','flow',{id:crypto.randomUUID(),mode:'shelve',receiptId,location:'T-1-1-1'});assert.equal(shelf.status,200,JSON.stringify(shelf.d));
 assert.equal(sql.prepare("SELECT quantity FROM training_inventory_balances WHERE item_id=? AND warehouse='raw'").get(receiptId).quantity,4000);
 assert.equal(sql.prepare("SELECT quantity FROM training_inventory_balances WHERE item_id=? AND warehouse='quarantine'").get(receiptId).quantity,0);
 const rawBefore=sql.prepare("SELECT quantity FROM training_inventory_balances WHERE item_id=? AND warehouse='raw'").get(receiptId).quantity;
 assert.equal((await call('انبار','flow',{id:crypto.randomUUID(),mode:'shelve',receiptId,location:'T-1-1-1'})).status,400);
 assert.equal(sql.prepare("SELECT quantity FROM training_inventory_balances WHERE item_id=? AND warehouse='raw'").get(receiptId).quantity,rawBefore);
 const rep=(await call('نماینده فروش','sales')).d;assert.equal(rep.agents.length,1);assert.equal(rep.agents[0].id,'training-sales-agent-1');assert.equal((await call('نماینده فروش','sales?agent=training-sales-agent-2')).status,404);
 assert.equal((await call('کنترل کیفیت','sales/monitor')).status,403);
 for(const path of ['auth/login','llm-config','system-reset','mcp-tokens','users','assistant'])assert.equal((await call('مدیر سامانه',path)).status,403,path);
 const noOrigin=new Request(base+'/api/training/flow?_role='+roles[0].id,{method:'POST',body:'{}'});assert.equal((await context.run(real,()=>training.trainingDispatch(noOrigin))).status,403);
 assert.equal((await context.run(null,()=>training.trainingStatus())).status,401,'unauthenticated read denied');
 const tc=load('lib/training-context.ts'),st=load('lib/storage.ts');
 assert.equal(tc.trainingSQL("SELECT * FROM records WHERE payload='records' -- records"),"SELECT * FROM training_records WHERE payload='records' -- records");
 assert.throws(()=>tc.trainingSQL('SELECT * FROM training_records'));
 const isolated=await Promise.all([tc.trainingContext.run({actor:'test',role:'test'},async()=>{await new Promise(r=>setTimeout(r,5));return (await st.storage().prepare('SELECT COUNT(*) n FROM records').first()).n}),st.storage().prepare('SELECT COUNT(*) n FROM records').first()]);assert.ok(isolated[0]>0);assert.equal(isolated[1].n,0);
 const files=load('lib/firmware-storage.ts');objects.set('same-key',new Uint8Array([1]).buffer);await tc.trainingContext.run({actor:'test',role:'test'},async()=>{await files.firmwareBucket().put('same-key',new Uint8Array([2]).buffer);await files.firmwareBucket().delete('same-key');});assert.ok(objects.has('same-key'));
 const allTables=sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'training_%' AND name!='llm_usage'").all().map(r=>r.name).sort();assert.deepEqual(allTables,Array.from(load('lib/training-tables.ts').trainingTables).sort());
 // Verify schema parity and no foreign key escapes to company tables.
 for(const table of load('lib/training-tables.ts').trainingTables){const plain=sql.prepare('PRAGMA table_info('+table+')').all(),clone=sql.prepare('PRAGMA table_info(training_'+table+')').all();const normalized=a=>a.map(({cid,...v})=>v).sort((a,b)=>a.name.localeCompare(b.name));assert.deepEqual(normalized(clone),normalized(plain),table);for(const fk of sql.prepare('PRAGMA foreign_key_list(training_'+table+')').all())assert.ok(fk.table.startsWith('training_'),table);}
 assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
 for(const t of ['records','flow_entities','app_members','inventory_balances','duty_runs','duty_notices','access_audit'])assert.equal(sql.prepare('SELECT count(*) n FROM '+t).get().n,0,'No company mutation: '+t);
 console.log('Training isolation, schema parity, persisted handoff notifications, role switching and inventory integrity PASS');

})().catch(e=>{console.error(e);process.exitCode=1});
