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
 const templates=load('app/api/label-templates/route.ts'),print=load('app/api/assets/print/route.ts');
 const callGet=async(u,api,url)=>{const r=await ctx.run(u,()=>api.GET(new Request(base+url)));return {status:r.status,response:r,data:r.headers.get('content-type')?.includes('application/json')?await r.clone().json():null};};
 assert.equal((await callGet(keeper,templates,'/api/label-templates')).status,200);
 assert.equal((await callGet(alice,templates,'/api/label-templates')).status,403);
 assert.equal((await callGet(external,templates,'/api/label-templates')).status,403);
 const first=crypto.randomUUID(),b={id:first,mode:'register',name:'لپ‌تاپ واحد فروش',category:'رایانه و تجهیزات الکترونیکی',condition:'good',location:'دفتر شرکت',day:today,notes:'',code:'MANUAL-IGNORED'};
 let r=await post(keeper,b);assert.equal(r.status,200);assert.equal(entity(first).data.code,'AM-000001');assert.equal(entity(first).data.reference,'ثبت شناسنامه');assert.equal((await post(keeper,b)).data.repeated,true);
 assert.equal((await post(alice,{...b,id:crypto.randomUUID()})).status,403);
 assert.equal((await post(keeper,{...b,id:crypto.randomUUID(),category:''})).status,400);
 const ids=[crypto.randomUUID(),crypto.randomUUID()],requests=ids.map(id=>({...b,id}));let concurrent=await Promise.all(requests.map(x=>post(keeper,x)));
 assert.equal(concurrent.filter(x=>x.status===200).length,1);for(let i=0;i<2;i++)if(concurrent[i].status!==200)assert.equal((await post(keeper,requests[i])).status,200);
 assert.equal(new Set(ids.map(id=>entity(id).data.code)).size,2);assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='asset_item'").get().n,3);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
 async function upload(u,id,bytes=png,extra={}){const q=new URLSearchParams({id,assetId:first,revision:'1',filename:'photo.png',purpose:'purchase',confirmed:'true',...extra}),r=await ctx.run(u,()=>afiles.POST(new Request(base+'/api/assets/files?'+q,{method:'POST',headers:{origin:base,'Content-Type':'application/octet-stream'},body:bytes})));return {status:r.status,data:await r.json()};}
 const originalPhotoCount=objects.size;const f1=crypto.randomUUID(),f2=crypto.randomUUID();assert.equal((await upload(keeper,f1)).status,200);assert.equal((await upload(keeper,f2,Buffer.from('%PDF-1.4 synthetic'),{filename:'invoice.pdf'})).status,200);
 assert.equal((await upload(keeper,f1)).data.repeated,true);assert.equal(objects.size,originalPhotoCount+2);
 assert.equal((await upload(alice,crypto.randomUUID())).status,404);assert.equal((await upload(keeper,crypto.randomUUID(),new Uint8Array())).status,400);
 let listed=await callGet(keeper,afiles,'/api/assets/files?assetId='+first);assert.equal(listed.data.files.length,2);assert.ok(listed.data.files.every(f=>!f.objectKey&&!f.actor));
 const thumb=await callGet(keeper,afiles,'/api/assets/files?id='+f1+'&view=preview');assert.equal(thumb.response.headers.get('content-type'),'image/png');
 const original=entity(first);sql.prepare('UPDATE flow_entities SET data=?,revision=2 WHERE id=?').run(JSON.stringify({...original.data,holderKind:'employee',holderId:'alice',custodyId:'new-custody'}),first);
 assert.equal((await callGet(keeper,afiles,'/api/assets/files?id='+f1)).status,200,'purchase evidence survives custody change');
 assert.equal((await callGet(alice,afiles,'/api/assets/files?id='+f1)).status,403,'holder cannot see purchase evidence');
 assert.equal((await callGet(alice,afiles,'/api/assets/files?assetId='+first)).status,403);
 assert.ok(!(await get(alice)).data.records.some(x=>x.id===f1));
 assert.equal((await upload(keeper,f1,png,{revision:'1'})).data.repeated,true,'uncertain upload replay succeeds after revision changes');
 const params={requestId:crypto.randomUUID(),confirmed:true,revision:0,name:'A3 printer',layout:'a4',sheetSize:'a3',roll:{width:60,height:40,rollWidth:60,columns:1,gapX:2,gapY:2,left:0,top:0}};
 const tr=await ctx.run(keeper,()=>templates.POST(req('/api/label-templates',params)));assert.equal(tr.status,200);const saved=await tr.json();assert.equal(saved.sheetSize,'a3');
 assert.equal((await callGet(keeper,print,'/api/assets/print?id='+first+'&template='+saved.id)).status,200);
 const printed=await ctx.run(keeper,()=>print.GET(new Request(base+'/api/assets/print?id='+first+'&template='+saved.id)));const html=await printed.text();assert.match(printed.headers.get('content-security-policy'),/img-src 'self' blob:/);assert.ok(!html.includes('window.print()'),'asset label path must not print the webpage');assert.match(html,/@page\{size:A3/);assert.match(html,/رول چندستونه/);assert.match(html,/QR بزرگ‌تر/);assert.ok(!html.includes('رول دو ستونه'));
 const invalid=await ctx.run(keeper,()=>print.GET(new Request(base+'/api/assets/print?id='+first+'&width=1&height=1&print=1')));const invalidHtml=await invalid.text();assert.ok(!invalidHtml.includes('QR خوانا جا نمی‌شوند'));assert.ok(invalidHtml.includes('void showAssetPdf(false)'));assert.match(invalidHtml,/<article class="label"/);
 const small=await ctx.run(keeper,()=>print.GET(new Request(base+'/api/assets/print?id='+first+'&width=30&height=15&print=1')));const smallHtml=await small.text();assert.equal(small.status,200);assert.ok(smallHtml.includes('void showAssetPdf(false)'));assert.ok(!smallHtml.includes('QR خوانا جا نمی‌شوند'));
 assert.equal((await callGet(external,print,'/api/assets/print?id='+first)).status,404);
 const fit=load('lib/asset-print-layout.ts').assetPrintLayout;
 for(const size of [[60,40],[30,15],[30,50],[100,80],[25,25],[18,80],[1,1]])for(const name of ['صندلی','لپ‌تاپ واحد فروش','نام طولانی '.repeat(8)]){const f=fit(...size,name,'AM-000123');assert.ok(f);assert.ok(f.qr>0&&f.textWidth>0&&f.textHeight>0);const w=size[0]-2*(f.inset+f.border),h=size[1]-2*(f.inset+f.border);if(f.direction==='row'){assert.ok(f.qr+f.textWidth+f.gap<=w+1e-6);assert.ok(f.textHeight<=h+1e-6)}else{assert.ok(f.qr<=w+1e-6);assert.ok(f.qr+f.textHeight+f.gap<=h+1e-6);}}
 assert.equal(fit(1e8,1e8,'a','b'),null);assert.ok(fit(1,1,'a','b'));assert.ok(fit(60,40,'صندلی','AM-000123').qr>=35);
 sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify({read:[],write:[],eventStages:[],assetRoles:[]}), 'keeper');
 assert.equal((await callGet(keeper,templates,'/api/label-templates')).status,403,'revoked custodian cannot retain template access');
 assert.equal((await upload(keeper,crypto.randomUUID(),png,{revision:'2'})).status,404);
 assert.ok(catalog.tools.some(t=>t.name==='upload_asset_purchase_document'));assert.ok(catalog.tools.some(t=>t.name==='list_asset_purchase_documents'));
 console.log('PASS asset passport: atomic automatic codes, retry/concurrency, optional register notes/reference, custodian template access/revocation, private multi-file evidence across custody, QR-first physical layouts and A3 print');
})().catch(e=>{console.error(e);process.exit(1)});
