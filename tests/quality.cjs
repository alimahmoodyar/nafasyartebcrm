const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');
function load(file,imports={}){const exports={};const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(source,{exports,require:name=>{if(!(name in imports))throw new Error('Missing import '+name);return imports[name]},Response,Request,URL,Error,crypto:globalThis.crypto,Date,Intl,Set,FormData,TextEncoder,TextDecoder,Uint8Array,console:{error(){}}});return exports;}
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));sql.exec('PRAGMA optimize');
let queue=Promise.resolve(),failNextBatch=false,throwAfterCommit=false;
const db={prepare(query){let args=[];return{bind(...values){args=values;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return{results:sql.prepare(query).all(...args)}},async run(){return{meta:{changes:sql.prepare(query).run(...args).changes}}}}},batch(statements){const job=queue.then(async()=>{if(failNextBatch){failNextBatch=false;throw Error('D1 unavailable');}sql.exec('BEGIN');let results=[];try{for(const s of statements)results.push(await s.run());sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}if(throwAfterCommit){throwAfterCommit=false;throw Error('D1 response lost');}return results;});queue=job.catch(()=>{});return job;}};
const objects=new Map();let failPut=false;
const bucket={async put(key,buffer){if(failPut)throw Error('R2 unavailable');objects.set(key,buffer.slice(0));return{key}},async get(key){const buffer=objects.get(key);return buffer?{arrayBuffer:async()=>buffer.slice(0)}:null},async delete(key){objects.delete(key)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',BUCKET:bucket};
const permissions=load('lib/permissions.ts'),numbers=load('lib/batch-number.ts'),distribution=load('lib/distribution.ts',{'./batch-number':numbers,'./persian-date':load('lib/persian-date.ts')});
const model=load('lib/model.ts',{'./batch-number':numbers,'./distribution':distribution});
const auth=load('lib/authorization.ts',{'@/lib/mcp/context':{mcpActor:new (require('node:async_hooks').AsyncLocalStorage)()},'cloudflare:workers':{env},'@/app/chatgpt-auth':{getChatGPTUser:async()=>identity},'@/lib/storage':{storage:()=>db},'@/lib/permissions':permissions});
const firmware=load('lib/firmware.ts',{'./batch-number':numbers});
const filesStorage=load('lib/firmware-storage.ts',{'cloudflare:workers':{env},'@/lib/storage':{storage:()=>db},'@/lib/authorization':auth});
const imports={'cloudflare:workers':{env},'@/lib/authorization':auth,'@/lib/storage':{storage:()=>db},'@/lib/permissions':permissions,'@/lib/model':model,'@/lib/batch-number':numbers,'@/lib/firmware':firmware,'@/lib/firmware-storage':filesStorage};


const quality=load('lib/quality.ts',{'./batch-number':numbers});imports['@/lib/quality']=quality;
const qs=load('lib/quality-storage.ts',imports);imports['@/lib/quality-storage']=qs;imports['@/lib/batch-files']=load('lib/batch-files.ts');
const templates=load('app/api/quality/templates/route.ts',imports),reports=load('app/api/quality/reports/route.ts',imports),files=load('app/api/quality/files/route.ts',imports),users=load('app/api/users/route.ts',imports),records=load('app/api/records/route.ts',imports);
const user=(userId,email)=>({userId,email,displayName:userId});
const json=(body,origin='https://test.local')=>new Request('https://test.local/api/quality',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const request=path=>new Request('https://test.local'+path);
(async()=>{
 assert.equal((await templates.GET(request('/?product=product:P'))).status,401);assert.equal((await reports.GET(request('/?device=device:D'))).status,401);
 identity=user('owner','owner@example.com');
 for(const code of ['P','OTHER']){const r=await records.POST(json({kind:'product',data:{code,name:'محصول',group:'آزمون',model:'M',warrantyMonths:'24',status:'فعال'}}));assert.equal(r.status,201);}
 assert.equal((await records.POST(json({kind:'device',data:{code:'D',product:'product:P',design:'1',date:'2026-09-14'}}))).status,201);
 const fields=[{key:'purity',label:'خلوص',type:'number',unit:'%',min:'90',max:'96',required:true},{key:'appearance',label:'ظاهر',type:'result',unit:'',min:'',max:'',required:true},{key:'comment',label:'توضیح',type:'text',unit:'',min:'',max:'',required:false}];
 const body={productId:'product:P',title:'کنترل نهایی',fields,previousVersion:0};
 assert.equal((await templates.POST(json(body,'https://foreign.test'))).status,403);
 assert.equal((await templates.POST(json({...body,fields:[fields[0],fields[0]]}))).status,400);
 let r=await templates.POST(json(body));assert.equal(r.status,201);const first=(await r.json()).template;
 assert.equal((await templates.POST(json(body))).status,409);
 r=await templates.POST(json({...body,previousVersion:1,fields:[{...fields[0],min:'93'},...fields.slice(1)]}));assert.equal(r.status,201);const second=(await r.json()).template;
 assert.equal((await (await templates.GET(request('/?device=device:D'))).json()).templates.length,2);
 const report={deviceId:'device:D',templateId:first.id,values:{purity:'۹۲',appearance:'pass',comment:'تست'},verdict:'pass',notes:'تست اولیه',requestId:crypto.randomUUID()};
 assert.equal((await reports.POST(json({...report,values:{purity:'87',appearance:'pass'}}))).status,400);
 assert.equal((await reports.POST(json({...report,values:{purity:'92'}}))).status,400);
 assert.equal((await reports.POST(json({...report,templateId:second.id}))).status,400);
 r=await reports.POST(json(report));assert.equal(r.status,201);const saved=(await r.json()).report;assert.equal(saved.values.purity,'92');assert.equal(saved.template.version,1);
 assert.equal((await reports.POST(json(report))).status,200);assert.equal(sql.prepare('SELECT count(*) n FROM quality_reports').get().n,1);assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE id LIKE 'qc-event:%'").get().n,1);
 failNextBatch=true;assert.notEqual((await reports.POST(json({...report,requestId:crypto.randomUUID()}))).status,201);assert.equal(sql.prepare('SELECT count(*) n FROM quality_reports').get().n,1);
 const retry={...report,requestId:crypto.randomUUID()};throwAfterCommit=true;assert.notEqual((await reports.POST(json(retry))).status,201);assert.equal((await reports.POST(json(retry))).status,200);assert.equal(sql.prepare('SELECT count(*) n FROM quality_reports').get().n,2);
 const other=(await (await templates.POST(json({...body,productId:'product:OTHER'}))).json()).template;assert.equal((await reports.POST(json({...report,templateId:other.id,requestId:crypto.randomUUID()}))).status,400);
 const fileId=crypto.randomUUID(),url='https://test.local/api/quality/files?report='+saved.id;
 function upload(){const f=new FormData();f.set('file',new File(['QC record'],'برگه.pdf'));return new Request(url+'&requestId='+fileId,{method:'POST',headers:{Origin:'https://test.local'},body:f});}
 assert.equal((await files.POST(upload())).status,201);assert.equal((await files.POST(upload())).status,200);
 r=await files.GET(new Request(url+'&id='+fileId));assert.equal(await r.text(),'QC record');assert.match(r.headers.get('content-disposition'),/^attachment;/);
 await users.POST(json({email:'reader@example.com',name:'Reader',unit:'QC',status:'active',permissions:{read:['device','event'],write:[],eventStages:[]}}));identity=user('reader','reader@example.com');
 assert.equal((await reports.GET(request('/?device=device:D'))).status,200);assert.equal((await files.GET(new Request(url))).status,200);assert.equal((await files.POST(upload())).status,403);assert.equal((await reports.POST(json(report))).status,403);assert.equal((await templates.POST(json(body))).status,403);
 identity=user('owner','owner@example.com');await users.POST(json({email:'assembly@example.com',name:'Assembly',unit:'تولید',status:'active',permissions:{read:['device','event','batch'],write:['event'],eventStages:['مونتاژ']}}));identity=user('assembly','assembly@example.com');assert.equal((await reports.POST(json(report))).status,403);assert.equal((await files.POST(upload())).status,403);
 identity=user('owner','owner@example.com');await users.POST(json({email:'noqc@example.com',name:'No QC',unit:'فروش',status:'active',permissions:{read:['device'],write:[],eventStages:[]}}));identity=user('noqc','noqc@example.com');assert.equal((await reports.GET(request('/?device=device:D'))).status,403);assert.equal((await files.GET(new Request(url+'&id='+fileId))).status,403);
 assert.equal(sql.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
 console.log('Quality checks passed: version preservation, numeric normalization/limits, required fields, wrong-product rejection, atomic event/report writes, retry recovery, files and role/stage permissions.');
})().catch(e=>{console.error(e);process.exitCode=1});
