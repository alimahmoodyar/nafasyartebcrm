const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}

const api=load('app/api/inbox/route.ts'),files=load('app/api/inbox/files/route.ts'),context=load('lib/mcp/context.ts').mcpActor,lib=load('lib/inbox.ts'),actions=load('app/api/assistant/actions/route.ts');
const now=new Date().toISOString(),future=new Date(Date.now()+3*86400000).toISOString().slice(0,10)+'T16:00:00+03:30';
const permissions={read:[],write:[],eventStages:[]};
function user(id,p={}){const u={userId:id,email:id+'@test.local',name:id,isAdmin:false,permissions:{...permissions,...p}};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'unit','active',?,?,?,?)").run(id,u.email,id,id,JSON.stringify(u.permissions),now,now);return u}
const a=user('alice'),b=user('bob'),c=user('charlie'),agent=user('agent',{serviceAgentId:'agent-org',serviceDomains:['home'],serviceRoles:['agent']}),coord=user('coordinator',{serviceDomains:['home'],serviceRoles:['coordinator']});
const admin={userId:'owner',email:'owner@example.com',name:'Owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};
sql.prepare("INSERT INTO app_identity(id,subject) VALUES('owner','owner')").run();
function entity(id){const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null}
function seed(id,type,data){sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now)}
const run=(u,fn)=>context.run(u,fn);
async function get(u,id='',extra=''){const r=await run(u,()=>api.GET(request('/api/inbox?thread='+id+extra)));return {status:r.status,data:await r.json()}}
async function post(u,body){const r=await run(u,()=>api.POST(request('/api/inbox','POST',{id:crypto.randomUUID(),...body})));return {status:r.status,data:await r.json()}}
async function act(u,id,mode,extra={}){return post(u,{threadId:id,revision:entity(id).revision,mode,body:'TEST '+mode,...extra})}
async function upload(u,thread,id=crypto.randomUUID()){const f=new FormData();f.set('file',new Blob(['col,value\nA,12']), 'evidence.csv');const r=await run(u,()=>files.POST(new Request(base+'/api/inbox/files?thread='+thread+'&requestId='+id,{method:'POST',headers:{origin:base},body:f})));return {status:r.status,data:await r.json()}}
let chain=Promise.resolve();const batch=db.batch.bind(db);db.batch=s=>{const p=chain.then(()=>batch(s));chain=p.catch(()=>{});return p};
(async()=>{
 assert.equal((await api.GET(request('/api/inbox'))).status,401);
 let r=await post(a,{mode:'create',title:'Private request',body:'CONFIDENTIAL',recipientType:'person',recipientId:'bob',kind:'request',priority:'urgent',due:future});assert.equal(r.status,200,JSON.stringify(r.data));const thread=r.data.threadId;
 assert.equal((await get(c,thread)).status,404);assert.equal((await get(admin,thread)).status,404);assert.equal((await get(admin)).data.threads.length,0);
 assert.equal((await get(b)).data.summary.unread,1);assert.equal((await get(a)).data.summary.unread,0);
 let detail=await get(b,thread);assert.equal((await post(b,{mode:'read',threadId:thread,revision:detail.data.thread.revision})).status,200);assert.equal((await get(b)).data.summary.unread,0);assert.equal(entity(thread).data.state,'open');
 assert.equal((await act(a,thread,'submit')).status,403);assert.equal((await act(b,thread,'approve')).status,403);
 const op=crypto.randomUUID(),rev=entity(thread).revision,reply={id:op,mode:'reply',threadId:thread,revision:rev,body:'Reply'};
 assert.equal((await post(b,reply)).status,200);assert.equal((await post(b,reply)).data.repeated,true);assert.equal((await post(b,{...reply,body:'changed'})).status,409);
 assert.equal(entity(thread).data.state,'open');assert.equal((await post(a,{mode:'cancel',threadId:thread,revision:rev,body:'stale'})).status,409);
 assert.equal((await act(b,thread,'blocked')).status,200);assert.equal((await act(b,thread,'start')).status,200);
 const f=await upload(b,thread);assert.equal(f.status,201,JSON.stringify(f.data));assert.ok(!JSON.stringify(f.data).includes('objectKey'));
 assert.equal((await run(c,()=>files.GET(request('/api/inbox/files?thread='+thread+'&id='+f.data.file.id)))).status,404);
 assert.equal((await run(b,()=>files.GET(request('/api/inbox/files?thread='+thread+'&id='+f.data.file.id)))).status,200);
 assert.equal((await act(b,thread,'submit')).status,200);assert.equal(entity(thread).data.state,'submitted');assert.equal((await get(a)).data.summary.review,1);
 assert.equal((await act(a,thread,'reopen')).status,200);assert.equal((await act(b,thread,'submit')).status,200);assert.equal((await act(a,thread,'approve')).status,200);assert.equal(entity(thread).data.state,'completed');
 assert.equal((await upload(b,thread)).status,400);assert.equal((await act(b,thread,'reply')).status,400);
 seed('position','position',{name:'Warehouse',unit:'unit',members:['bob','charlie'],active:true});
 r=await post(a,{mode:'create',title:'Position request',body:'position',recipientType:'position',recipientId:'position',kind:'request',priority:'normal',due:future});assert.equal(r.status,200);const pt=r.data.threadId;
 assert.equal((await act(b,pt,'submit')).status,403);
 const pRev=entity(pt).revision;
 const claims=await Promise.all([post(b,{mode:'claim',threadId:pt,revision:pRev}),post(c,{mode:'claim',threadId:pt,revision:pRev})]);assert.equal(claims.filter(x=>x.status===200).length,1);
 const responsible=entity(pt).data.assignee,remaining=responsible==='bob'?'charlie':'bob',next=remaining==='bob'?b:c,old=responsible==='bob'?b:c;
 sql.prepare("UPDATE flow_entities SET data=?,revision=revision+1 WHERE id='position'").run(JSON.stringify({name:'Warehouse',members:[remaining],active:true}));
 assert.equal((await get(old,pt)).status,404);assert.equal((await get(old)).data.threads.some(t=>t.id===pt),false);
 assert.equal((await act(next,pt,'claim')).status,200);assert.equal(entity(pt).data.assignee,remaining);
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10)+'T16:00:00+03:30';
 assert.equal((await post(next,{mode:'snooze',threadId:pt,until:tomorrow})).status,200);assert.equal((await get(next,pt)).data.thread.needsAttention,false);assert.equal(entity(pt).data.due,new Date(future).toISOString());
 r=await post(a,{mode:'create',title:'Question',body:'Hello',recipientType:'person',recipientId:'bob',kind:'message',priority:'normal'});const message=r.data.threadId;
 assert.equal((await post(b,{mode:'read',threadId:message,revision:1})).status,200);assert.equal((await get(b,message)).data.thread.needsAttention,false);
 assert.equal((await act(b,message,'convert',{due:future})).status,403);assert.equal((await act(a,message,'convert',{due:future})).status,200);assert.equal((await act(b,message,'close')).status,400);
 r=await get(agent,'','&view=directory');assert.equal(r.status,200);assert.ok(r.data.people.some(p=>p.id==='coordinator'));assert.ok(!r.data.people.some(p=>p.id==='bob'));assert.equal(r.data.positions.length,0);
 assert.equal((await post(agent,{mode:'create',title:'no',body:'no',recipientType:'person',recipientId:'bob',kind:'message',priority:'normal'})).status,400);
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('device','device','{}',?)").run(now);
 assert.equal((await post(a,{mode:'create',title:'link',body:'link',recipientType:'person',recipientId:'bob',kind:'message',priority:'normal',link:{section:'device',id:'device'}})).status,404);
 r=await post(admin,{mode:'create',title:'link',body:'No implicit access',recipientType:'person',recipientId:'bob',kind:'message',priority:'normal',link:{section:'device',id:'device'}});assert.equal(r.status,200);assert.equal((await get(b,r.data.threadId)).data.link,null);
 const pc={user:a,scope:'read',tokenId:null};await assert.rejects(()=>catalog.executeTool('inbox_apply',{id:crypto.randomUUID(),mode:'reply',data:{threadId:message,revision:entity(message).revision,body:'no'},confirmed:true},base,pc),/read-only/);
 assert.ok(catalog.tools.some(t=>t.name==='upload_inbox_file'));
 // Confirmed assistant execution is attributed server-side and executes once.
 const turn=crypto.randomUUID(),aid=crypto.randomUUID(),args={id:crypto.randomUUID(),mode:'reply',data:{threadId:message,revision:entity(message).revision,body:'APPROVED_RESPONSE'}};
 sql.prepare("INSERT INTO assistant_turns(id,owner,question,answer,model,created) VALUES(?,?,'question','proposal','mock',?)").run(turn,b.userId,now);
 sql.prepare("INSERT INTO assistant_actions(id,owner,turn_id,tool,args,state,created,expires) VALUES(?,?,?,'inbox_apply',?,'pending',?,?)").run(aid,b.userId,turn,JSON.stringify(args),now,new Date(Date.now()+3600000).toISOString());
 assert.equal((await run(b,()=>actions.POST(request('/api/assistant/actions','POST',{id:aid,decision:'confirm',confirmed:false})))).status,400);
 assert.equal((await get(a,message)).data.messages.some(m=>m.body==='APPROVED_RESPONSE'),false);
 let ar=await run(b,()=>actions.POST(request('/api/assistant/actions','POST',{id:aid,decision:'confirm',confirmed:true})));assert.equal(ar.status,200);assert.equal((await ar.json()).action.state,'succeeded');
 await run(b,()=>actions.POST(request('/api/assistant/actions','POST',{id:aid,decision:'confirm',confirmed:true})));
 const msg=(await get(a,message)).data.messages.filter(m=>m.body==='APPROVED_RESPONSE');assert.equal(msg.length,1);assert.equal(msg[0].viaAssistant,true);
 assert.equal((await run(c,()=>actions.POST(request('/api/assistant/actions','POST',{id:aid,decision:'confirm',confirmed:true})))).status,404);
 console.log('Inbox passed: private participant-only access including admin, active positions/claim race/reassignment, read vs reply vs completion, approvals, idempotency, stale revisions, snooze, private attachments, linked-record isolation, restricted agents, MCP scopes and confirmed assistant attribution.');
})().catch(e=>{console.error(e);process.exit(1)});
