const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='@bwip-js/generic')return require(path.join(root,'node_modules/@bwip-js/generic/dist/bwip-js-gen.mjs'));if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}


const ctx=load('lib/mcp/context.ts').mcpActor,api=load('app/api/personnel/route.ts'),files=load('app/api/personnel/files/route.ts'),domain=load('lib/personnel.ts'),catalog=load('lib/mcp/tools.ts'),tasks=load('app/api/tasks/route.ts'),duties=load('lib/duties.ts');
let tail=Promise.resolve();const batch=db.batch.bind(db);db.batch=stmts=>{const next=tail.then(()=>batch(stmts));tail=next.catch(()=>{});return next};
const base='https://test.local',now=new Date().toISOString(),today=duties.dayAt(),day=duties.addDay(today,-10),next=duties.addDay(today,2);
const req=(url,b,origin=base)=>new Request(base+url,{method:b?'POST':'GET',headers:{origin,'Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});
function actor(id,roles=[],extra={}){const u={userId:'local:'+id,email:id+'@test.local',name:id,isAdmin:false,permissions:{read:[],write:[],eventStages:[],personnelRoles:roles,...extra}};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'company','active',?,?,?,?)").run(id,u.email,id,u.userId,JSON.stringify(u.permissions),now,now);return u;}

const assets=load('app/api/assets/route.ts'),afiles=load('app/api/assets/files/route.ts'),ad=load('lib/assets.ts'),sync=load('lib/assets-tasks.ts');
const owner={userId:'owner',email:'owner@example.com',name:'owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions},keeper=actor('keeper',[],{assetRoles:['custodian']}),alice=actor('alice'),bob=actor('bob'),hr=actor('hr',['hr']),external=actor('external',[],{salesAgentId:'outside',salesRoles:['agent']});
const entity=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
async function get(u){const r=await ctx.run(u,()=>assets.GET());return {status:r.status,data:await r.json()}}
async function post(u,b){const body={id:crypto.randomUUID(),confirmed:true,revision:0,notes:'Actual test evidence',...b};if(body.mode==='register'&&(u.isAdmin||u.permissions.assetRoles?.includes('custodian'))&&!body.photoFileIds)body.photoFileIds=[require('./asset-photo-fixture.cjs')(sql,u,body.id,objects)];const r=await ctx.run(u,()=>assets.POST(req('/api/assets',body)));return {status:r.status,data:await r.json()}}
const reg={mode:'register',code:'A-001',name:'قالب تزریق',category:'قالب',brand:'brand',model:'model',serial:'serial',specifications:'steel 2 cavities',condition:'good',location:'انبار شرکت',day:today,reference:'receipt-001'};
const transfer=(id,revision,kind='employee',extra={})=>({mode:'transfer',recordId:id,revision,holderKind:kind,holderId:'alice',holderName:'Contractor',contractorCode:'C-1',location:'Factory',condition:'good',day:today,reference:'handover-001',...extra});



(async()=>{
 const people=load('app/api/assets/people/route.ts'),wf=load('app/api/assets/workflow/route.ts');
 const read=async(u,params)=>{const r=await ctx.run(u,()=>people.GET(new Request(base+'/api/assets/people?'+new URLSearchParams(params))));return {status:r.status,data:await r.json()};};
 const perform=async(u,body)=>{const r=await ctx.run(u,()=>wf.POST(req('/api/assets/workflow',{id:crypto.randomUUID(),confirmed:true,notes:'Synthetic custody evidence',...body})));const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;};
 sql.prepare('UPDATE app_members SET name=?,unit=? WHERE id IN (?,?)').run('علی رضایی','فروش','alice','bob');
 assert.equal((await read(keeper,{view:'people',q:'علي رضايي'})).data.people.length,2,'Persian/Arabic names normalize and duplicate names remain separate identities');
 assert.equal((await read(keeper,{view:'people',q:'alice'})).data.people[0].unit,'فروش');
 actor('alice-legacy-role',[],{assetRoles:['custodian']});
 sql.prepare("UPDATE app_members SET name=? WHERE id='alice-legacy-role'").run('علی رضایی · اموال‌دار');
 const currentPeople=()=>read(keeper,{view:'people',q:'علی رضایی',holdersOnly:'true'});
 assert.deepEqual((await currentPeople()).data.people,[]);
 assert.equal((await read(alice,{view:'people',q:'علی'})).status,403);assert.equal((await read(hr,{person:'alice',view:'history'})).status,403);assert.equal((await read(external,{view:'work'})).status,403);
 assert.equal((await read(keeper,{person:'missing',view:'current'})).status,404);assert.equal((await read(keeper,{view:'people',q:'علی',offset:'-1'})).status,400);
 const id=crypto.randomUUID();assert.equal((await post(keeper,{...reg,id,category:'تجهیزات اداری'})).status,200);
 await perform(keeper,{mode:'transfer',recordId:id,revision:entity(id).revision,holderKind:'employee',holderId:'alice',location:'Office',condition:'good'});
 assert.equal((await read(keeper,{person:'alice',view:'current'})).data.currentTotal,0,'Pending arrival is not a received asset');
 assert.deepEqual((await currentPeople()).data.people,[]);
 await perform(alice,{mode:'accept_transfer',recordId:id,revision:entity(id).revision,scan:load('lib/asset-label.ts').assetQrText(id),condition:'good'});
 let current=await read(keeper,{person:'alice',view:'current'});assert.equal(current.data.currentTotal,1);assert.equal(current.data.records[0].data.holderId,'alice');assert.match(current.data.records[0].data.handedAt,/T/);assert.ok(!('specifications' in current.data.records[0].data));
 let holders=(await currentPeople()).data.people;
 assert.deepEqual(holders.map(({id,currentTotal})=>[id,currentTotal]),[['alice',1]],'Keep the actual holder and exclude empty role accounts and same-name nonholders');
 await perform(alice,{mode:'transfer',recordId:id,revision:entity(id).revision,holderKind:'employee',holderId:'bob',location:'Other office',condition:'good'});
 assert.equal((await read(keeper,{person:'alice',view:'current'})).data.currentTotal,1);assert.equal((await read(keeper,{person:'bob',view:'current'})).data.currentTotal,0);
 assert.deepEqual((await currentPeople()).data.people.map(p=>p.id),['alice']);
 await perform(alice,{mode:'cancel_transfer',recordId:id,revision:entity(id).revision});
 assert.equal((await read(keeper,{person:'alice',view:'history'})).data.history.length,1,'Cancelled requests do not invent history receipts');
 await perform(alice,{mode:'transfer',recordId:id,revision:entity(id).revision,holderKind:'employee',holderId:'bob',location:'Other office',condition:'good'});
 await perform(bob,{mode:'accept_transfer',recordId:id,revision:entity(id).revision,scan:load('lib/asset-label.ts').assetQrText(id),condition:'good'});
 assert.equal((await read(keeper,{person:'alice',view:'current'})).data.currentTotal,0);assert.equal((await read(keeper,{person:'bob',view:'current'})).data.currentTotal,1);
 let history=(await read(keeper,{person:'alice',view:'history'})).data.history;assert.equal(history.length,2);assert.ok(history.some(h=>h.direction==='received'));assert.ok(history.some(h=>h.direction==='released'));assert.ok(history.every(h=>h.assetId===id&&h.at&&!h.notes&&!h.actor));
 const legacy=crypto.randomUUID(),legacyData={name:'Legacy chair',code:'LEGACY',holderKind:'employee',holderId:'alice',holderName:'علی رضایی',condition:'good',location:'Old office',handedDay:'2020-01-02',history:[{mode:'register',holderKind:'stock',holderId:'',holderName:'Company',at:'2020-01-01T08:00:00Z'},{mode:'transfer',holderKind:'employee',holderId:'alice',holderName:'علی رضایی',location:'Old office',at:'2020-01-02T08:00:00Z'}]};
 sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'asset_item',?,1,?,?)").run(legacy,JSON.stringify(legacyData),now,now);
 const old=(await read(keeper,{person:'alice',view:'current'})).data.records.find(r=>r.id===legacy);assert.equal(old.data.handedAt,'');assert.equal(old.data.handedDay,'2020-01-02');assert.ok((await read(keeper,{person:'alice',view:'history'})).data.history.some(h=>h.source==='legacy'));
 holders=(await currentPeople()).data.people;
 assert.deepEqual(holders.map(p=>p.id),['alice','bob'],'Distinct people with the same name and current assets remain separate');
 sql.prepare("UPDATE app_members SET status='inactive' WHERE id='alice'").run();assert.equal((await read(keeper,{view:'people',q:'alice'})).data.people[0].active,false);assert.equal((await read(keeper,{person:'alice',view:'current'})).data.currentTotal,1);
 for(let i=0;i<35;i++){const mid='page-'+i;sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'asset_item',?,1,?,?)").run(mid,JSON.stringify({...legacyData,history:[],code:mid}),now,now);}
 const first=await read(keeper,{person:'alice',view:'current'}),second=await read(keeper,{person:'alice',view:'current',offset:'30'});assert.equal(first.data.records.length,30);assert.equal(first.data.hasMore,true);assert.equal(second.data.records.length,6);assert.equal(second.data.hasMore,false);
 const before=sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n;await read(keeper,{view:'work'});await read(keeper,{person:'alice',view:'history'});assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n,before,'Search/history/work are read-only');
 const readContext={user:keeper,scope:'read',tokenId:null};const mcp=await ctx.run(keeper,()=>catalog.executeTool('get_person_asset_custody',{person:'alice',view:'current'},base,readContext));assert.equal(mcp.currentTotal,36);const work=await ctx.run(keeper,()=>catalog.executeTool('get_asset_custodian_work',{},base,readContext));assert.ok(Array.isArray(work.work));
 const profile=load('lib/profile-review.ts').profileSession(owner,'custodian',[]);assert.equal((await read(profile,{person:'alice',view:'current'})).status,200,'Existing custodian profile uses actual admin actor without a fake employee');
 sql.prepare("UPDATE app_members SET permissions=? WHERE id='keeper'").run(JSON.stringify({read:[],write:[],eventStages:[]}));assert.equal((await read(keeper,{person:'alice',view:'history'})).status,403,'Revoked role is not retained by a stale session');
 console.log('PASS unified custodian: exact-person identity and inactive names, actual vs pending custody, accepted/legacy history, bounded pages, MCP, profile/revocation and read-only access');
})().catch(e=>{console.error(e);process.exit(1)});
