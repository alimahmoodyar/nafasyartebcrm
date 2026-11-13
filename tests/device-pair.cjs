const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}

const {mcpActor}=load('lib/mcp/context.ts'),{allPermissions}=load('lib/permissions.ts');
const route=load('app/api/device-pair/route.ts'),contract=load('lib/device-pair-contract.ts');
const alice={userId:'alice',email:'a@test.local',name:'A',isAdmin:true,permissions:allPermissions};
const bob={...alice,userId:'bob'};const keyA='a'.repeat(64),keyB='b'.repeat(64),keyC='c'.repeat(64),origin='https://test.local';
async function req(actor,b,expected=200,headers={origin}){const r=await mcpActor.run(actor,()=>route.POST(new Request(origin+'/api/device-pair',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({protocol:2,...b})})));const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;}
const row=id=>JSON.parse(sql.prepare("SELECT data FROM flow_entities WHERE id=?").get(id).data);
async function create(){return req(alice,{mode:'create',deviceKey:keyA})}
async function connected(){let a=await create();await req(alice,{mode:'join',deviceKey:keyB,id:a.id,invite:a.invite});a=await req(alice,{mode:'poll',deviceKey:keyA,id:a.id});assert.equal(a.connected,true);return a;}
const run=(s,mode,extra={},key=keyA,status=200)=>req(alice,{id:s.id,deviceKey:key,revision:s.revision,epoch:s.epoch,mode,...extra},status);
(async()=>{
let a=await create();assert.ok(a.invite);assert.equal(a.paired,false);assert.equal(a.scope,undefined);assert.equal(a.a,undefined);assert.equal(a.deviceKey,undefined);assert.equal(a.inviteHash,undefined);
await req(alice,{mode:'join',id:a.id,deviceKey:keyA,invite:a.invite},409);
await req(bob,{mode:'join',id:a.id,deviceKey:keyB,invite:a.invite},403);
await req({...alice,permissions:{...allPermissions,warehouses:['other']}},{mode:'join',id:a.id,deviceKey:keyB,invite:a.invite},403);assert.equal(row(a.id).closed,false,'wrong-role join cannot close original pair');
await req(alice,{mode:'join',id:a.id,deviceKey:keyB,invite:'0'.repeat(64)},409);
let b=await req(alice,{mode:'join',id:a.id,deviceKey:keyB,invite:a.invite});assert.equal(b.paired,true);
await req(alice,{mode:'join',id:a.id,deviceKey:keyC,invite:a.invite},409);
await req(alice,{mode:'poll',id:a.id,deviceKey:keyC},403);
a=await run(a,'poll');assert.equal(a.connected,true);a=await run(a,'work',{work:{kind:'scan',code:'device:test-code'}});assert.equal(a.epoch,1);
const field='d'.repeat(64),other='e'.repeat(64);a=await run(a,'fields',{changes:[{key:field,value:'توضیح از گوشی',version:0}]},keyB);b=await run(a,'poll',{},keyB);assert.equal(b.fields[field].value,'توضیح از گوشی');assert.equal(b.fields[field].by,'b');
await run(a,'fields',{changes:[{key:field,value:'overwrite',version:0}]},keyA,409);
const stale=a;a=await run(a,'fields',{changes:[{key:other,value:['one','two'],version:0}]});await run(stale,'fields',{changes:[{key:field,value:'stale',version:1}]},keyB,409);
await run(a,'fields',{changes:[{key:'__proto__',value:'bad',version:0}]},keyA,400);await run(a,'fields',{changes:[{key:other,value:'x'.repeat(16001),version:1}]},keyA,400);
const op=crypto.randomUUID();const attempts=await Promise.all([run(a,'begin',{operationId:op},keyA),req(alice,{id:a.id,deviceKey:keyB,revision:a.revision,epoch:a.epoch,mode:'begin',operationId:crypto.randomUUID()},409)]);a=attempts[0];assert.equal(a.commit.state,'sending');await run(a,'fields',{changes:[{key:field,value:'late',version:1}]},keyB,409);await run(a,'work',{work:{kind:'scan',code:'other'}},keyB,409);await run(a,'finish',{operationId:op,status:200},keyB,409);
a=await run(a,'finish',{operationId:op,status:200});assert.equal(a.commit.state,'done');await run(a,'begin',{operationId:op},keyB,409);
a=await run(a,'work',{work:{kind:'navigate',section:'inventory',target:'receipt:test'}});assert.equal(a.epoch,2);assert.deepEqual(Object.keys(a.fields),[]);await req(alice,{id:a.id,deviceKey:keyB,revision:a.revision,epoch:1,mode:'fields',changes:[{key:field,value:'old record edit',version:0}]},409);
// A lost response blocks retries indefinitely until reviewed/connection closed.
a=await run(a,'begin',{operationId:op});a=await run(a,'finish',{operationId:op,uncertain:true});await run(a,'work',{work:{kind:'scan',code:'next'}},keyB,409);await run(a,'begin',{operationId:op},keyB,409);await run(a,'close',{},keyB);assert.deepEqual(row(a.id).fields,{});await run(a,'poll',{},keyA,410);
// UI commands checkpoint prior fields and stay within the same protected work.
a=await connected();a=await run(a,'work',{work:{kind:'navigate',section:'inventory',target:''}});
a=await run(a,'fields',{changes:[{key:field,value:'receipt two',version:0}]});
const actionId=crypto.randomUUID(),ui={actionId,key:'material-flow:4dbc6aa0c98e',item:'["receipt-2"]',label:'ویرایش رسید'};
a=await run(a,'ui',ui);assert.equal(a.actions.length,1);assert.equal(a.actions[0].beforeFields[field].value,'receipt two');assert.equal(Object.keys(a.fields).length,0);
a=await run(a,'ui',ui);assert.equal(a.actions.length,1,'retried intent is not replayed twice');
await run(a,'ui',{...ui,actionId:crypto.randomUUID(),key:'button:nth-child(2)'},keyA,400);
a=await run(a,'begin',{operationId:op});await run(a,'ui',{...ui,actionId:crypto.randomUUID()},keyB,409);
a=await run(a,'finish',{operationId:op,uncertain:true});await run(a,'ui',{...ui,actionId:crypto.randomUUID()},keyB,409);await run(a,'close');assert.equal(row(a.id).actions.length,0);
a=await connected();await req(alice,{mode:'poll',id:a.id,deviceKey:keyA,protocol:1},410);await req(alice,{mode:'close',id:a.id,deviceKey:keyA,protocol:1});assert.equal(row(a.id).closed,true);
// Invitation and peer presence have independent lifetimes.
a=await create();let d=row(a.id);d.inviteUntil=Date.now()-1;sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify(d),a.id);await req(alice,{mode:'join',id:a.id,deviceKey:keyB,invite:a.invite},409);await run(a,'close');
a=await connected();a=await run(a,'work',{work:{kind:'scan',code:'x'}});a=await run(a,'fields',{changes:[{key:field,value:'private',version:0}]});d=row(a.id);d.bSeen=Date.now()-30000;sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify(d),a.id);a=await run(a,'poll');assert.equal(a.connected,false);assert.deepEqual(Object.keys(a.fields),[]);await run(a,'begin',{operationId:op},keyA,409);await run(a,'close');
// Equivalent permission lists in a different order are the same scope.
a=await connected();const reordered={...alice,permissions:{...allPermissions,read:[...allPermissions.read].reverse(),write:[...allPermissions.write].reverse()}};await req(reordered,{mode:'poll',id:a.id,deviceKey:keyA});await run(a,'close');
// A member's changed permissions close and scrub the pairing.
a=await connected();await req({...alice,permissions:{...allPermissions,warehouses:['changed']}},{mode:'poll',id:a.id,deviceKey:keyA},403);assert.equal(row(a.id).closed,true);
a=await connected();await req(alice,{mode:'poll',id:a.id,deviceKey:keyA},403,{origin:'https://evil.local'});await run(a,'close');
a=await connected();d=row(a.id);d.expires=Date.now()-1;sql.prepare('UPDATE flow_entities SET data=? WHERE id=?').run(JSON.stringify(d),a.id);await run(a,'poll',{},keyA,410);
// Reset freeze applies to connection writes, without touching actual stock/accounts.
a=await connected();sql.prepare("UPDATE reset_control SET phase='maintenance' WHERE id=1").run();await run(a,'work',{work:{kind:'scan',code:'freeze'}},keyA,423);sql.prepare("UPDATE reset_control SET phase='testing' WHERE id=1").run();await run(a,'close');
// MCP exposes the same handler/shape, not a privileged browser-control backdoor.
const catalog=load('lib/mcp/tools.ts');const tool=catalog.tools.find(t=>t.name==='manage_paired_workspace');assert.ok(tool);assert.equal(catalog.validateToolArguments(tool.name,{mode:'create',deviceKey:keyA}),true);assert.equal(catalog.validateToolArguments(tool.name,{mode:'fields',deviceKey:keyB,changes:[{key:field,version:0,value:'note'}]}),true);
const code=origin+'/#device-pair='+a.id+'.'+'f'.repeat(64);assert.equal(contract.pairInviteFromCode(code,origin).id,a.id);assert.equal(contract.pairInviteFromCode(code.replace(origin,'https://evil.local'),origin),null);assert.equal(contract.pairInviteFromCode('https://evil.local',origin),null);assert.ok(contract.sensitiveFieldLabel('current-password'));assert.ok(contract.sensitiveFieldLabel('رمز عبور'));assert.equal(contract.sensitiveFieldLabel('نام فرستنده'),false);
console.log('PASS paired workspace: same-account/exact-scope and device membership, single-use expiry, fields CAS/conflict isolation, one simultaneous submission, no implicit retry, context epochs, disconnect scrub, stale peer privacy, CSRF and safe QR parsing');
})().catch(e=>{console.error(e);process.exitCode=1});
