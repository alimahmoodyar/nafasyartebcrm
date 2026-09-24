const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');
function load(file,imports={}){const exports={};const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(source,{exports,require:name=>{if(!(name in imports))throw new Error('Missing import '+name);return imports[name]},Response,Request,URL,Error,crypto:globalThis.crypto,Date,Intl,Set,FormData,TextEncoder,TextDecoder,Uint8Array,console:{error(){}}});return exports;}
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));sql.exec('PRAGMA optimize');
let queue=Promise.resolve(),failNextBatch=false,throwAfterCommit=false;
const db={prepare(query){let args=[];return{bind(...values){args=values;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return{results:sql.prepare(query).all(...args)}},async run(){return{meta:{changes:sql.prepare(query).run(...args).changes}}}}},batch(statements){const job=queue.then(async()=>{if(failNextBatch){failNextBatch=false;throw Error('D1 unavailable');}sql.exec('BEGIN');let results=[];try{for(const s of statements)results.push(await s.run());sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}if(throwAfterCommit){throwAfterCommit=false;throw Error('D1 response lost');}return results;});queue=job.catch(()=>{});return job;}};
const objects=new Map();let failPut=false;
const bucket={async put(key,buffer){if(failPut)throw Error('R2 unavailable');objects.set(key,buffer.slice(0));return{key}},async get(key){const buffer=objects.get(key);return buffer?{arrayBuffer:async()=>buffer.slice(0)}:null},async delete(key){objects.delete(key)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',BUCKET:bucket};
const permissions=load('lib/permissions.ts'),numbers=load('lib/batch-number.ts'),distribution=load('lib/distribution.ts',{'./batch-number':numbers});
const model=load('lib/model.ts',{'./batch-number':numbers,'./distribution':distribution});
const auth=load('lib/authorization.ts',{'cloudflare:workers':{env},'@/app/chatgpt-auth':{getChatGPTUser:async()=>identity},'@/lib/storage':{storage:()=>db},'@/lib/permissions':permissions});
const firmware=load('lib/firmware.ts',{'./batch-number':numbers});
const filesStorage=load('lib/firmware-storage.ts',{'cloudflare:workers':{env},'@/lib/storage':{storage:()=>db},'@/lib/authorization':auth});
const imports={'cloudflare:workers':{env},'@/lib/authorization':auth,'@/lib/storage':{storage:()=>db},'@/lib/permissions':permissions,'@/lib/model':model,'@/lib/batch-number':numbers,'@/lib/firmware':firmware,'@/lib/firmware-storage':filesStorage};


const rules=load('lib/finance-control.ts');imports['@/lib/finance-control']=rules;
imports['@/lib/finance-scope']=load('lib/finance-scope.ts',{'./finance-control':rules,'./authorization':auth});
const route=load('app/api/finance/route.ts',imports),files=load('app/api/finance/files/route.ts',imports),users=load('app/api/users/route.ts',imports);
const base='https://test.local/api/finance?cadence=daily&period=2026-09-24';
const post=(body,url=base,origin='https://test.local')=>new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const upload=(id=crypto.randomUUID(),url=base.replace('/finance?','/finance/files?')+'&report=bank',name='bank.csv',content='date,amount\n2026-09-24,100')=>{const data=new FormData();data.append('file',new Blob([content]),name);return new Request(url+'&requestId='+id,{method:'POST',headers:{Origin:'https://test.local'},body:data})};
(async()=>{
 assert.equal(rules.financePeriod('weekly','2026-09-24'),'2026-09-19');assert.throws(()=>rules.financePeriod('daily','2026-02-30'));
 assert.equal((await route.GET(new Request(base))).status,401);
 identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
 let r=await users.POST(post({email:'reader@example.com',name:'Reader',unit:'مالی',status:'active',permissions:{read:[],write:[],eventStages:[],finance:'read'}}));assert.equal(r.status,201);
 let q={id:crypto.randomUUID(),report_id:'bank',kind:'question',body:'Explain transfer',responsible:'Treasury'};
 assert.equal((await route.POST(post(q,base,'https://evil.test'))).status,403);
 assert.equal((await route.POST(post(q))).status,201);assert.equal((await route.POST(post(q))).status,200);
 assert.equal((await route.POST(post({...q,body:'Changed'}))).status,409);
 assert.equal((await route.POST(post({id:crypto.randomUUID(),report_id:'bank',kind:'answer',body:'Answer',parent_id:q.id},base.replace('2026-09-24','2026-09-23')))).status,400);
 assert.equal((await route.POST(post({id:crypto.randomUUID(),report_id:'bank',kind:'answer',body:'Timing',parent_id:q.id}))).status,201);
 assert.equal((await route.POST(post({id:crypto.randomUUID(),report_id:'bank',kind:'closure',body:'Confirmed',parent_id:q.id}))).status,201);
 const id=crypto.randomUUID();assert.equal((await files.POST(upload(id))).status,201);assert.equal((await files.POST(upload(id))).status,200);assert.equal(objects.size,1);
 assert.equal((await files.POST(upload(crypto.randomUUID(),undefined,'bad.exe'))).status,400);
 let d=await (await route.GET(new Request(base))).json();assert.equal(d.files.length,1);assert.equal(d.notes.length,3);assert.ok(!JSON.stringify(d).includes('object_key'));
 assert.equal((await (await route.GET(new Request(base.replace('2026-09-24','2026-09-23')))).json()).files.length,0);
 const download=base.replace('/finance?','/finance/files?')+'&report=bank&id='+id;
 r=await files.GET(new Request(download));assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/^attachment/);
 assert.equal((await files.GET(new Request(download.replace('2026-09-24','2026-09-23')))).status,404);
 failNextBatch=true;assert.equal((await files.POST(upload())).status,503);assert.equal(objects.size,1);
 identity={userId:'reader',email:'reader@example.com',displayName:'Reader'};assert.equal((await route.GET(new Request(base))).status,200);assert.equal((await files.GET(new Request(download))).status,200);assert.equal((await files.POST(upload())).status,403);assert.equal((await route.POST(post({...q,id:crypto.randomUUID()}))).status,403);
 identity={userId:'intruder',email:'unknown@example.com',displayName:'X'};assert.equal((await route.GET(new Request(base))).status,403);
 console.log('Finance tests passed: period isolation, file roundtrip, permissions, CSRF, question linkage, idempotency and storage cleanup');
})().catch(e=>{console.error(e);process.exit(1)});
