const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
let proposedTool='submit_development_request',proposedArgs={},modelPayloads=[];
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},fetch:async(url,options)=>{const body=JSON.parse(options.body);modelPayloads.push(body);return Response.json({choices:[{message:{tool_calls:[{id:'proposal',type:'function',function:{name:proposedTool,arguments:JSON.stringify(proposedArgs)}}]}}]});},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}

const api=load('app/api/development/route.ts'),ctx=load('lib/mcp/context.ts').mcpActor,chat=load('app/api/assistant/route.ts'),actions=load('app/api/assistant/actions/route.ts'),contract=load('lib/development-contract.ts');
const now=new Date().toISOString(),permissions={read:[],write:[],eventStages:[]};
function user(id){const u={userId:id,email:id+'@test.local',name:id,isAdmin:false,permissions};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'تولید','active',?,?,?,?)").run(id,u.email,id,id,JSON.stringify(permissions),now,now);return u}
const a=user('alice'),b=user('bob'),admin={userId:'owner',email:'owner@example.com',name:'Owner',isAdmin:true,permissions:load('lib/permissions.ts').allPermissions};
const run=(u,fn)=>ctx.run(u,fn),fields={kind:'feature',title:'گزارش زمان مونتاژ',section:'تولید',problem:'زمان واقعی هر مونتاژ را نداریم',desired:'مدت هر دستگاه را ببینیم',impact:'هر روز',example:'مقایسه دو سریال نمونه'};
async function get(u,q=''){const r=await run(u,()=>api.GET(request('/api/development'+(q?'?'+q:''))));return {status:r.status,data:await r.json()}}
async function post(u,body,headers={}){const r=await run(u,()=>api.POST(request('/api/development','POST',{id:crypto.randomUUID(),confirmed:true,...body},headers)));return {status:r.status,data:await r.json()}}
function entity(id){const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null}
let chain=Promise.resolve();const batch=db.batch.bind(db);db.batch=s=>{const p=chain.then(()=>batch(s));chain=p.catch(()=>{});return p};
(async()=>{
 assert.equal((await api.GET(request('/api/development'))).status,401);
 const id=crypto.randomUUID(),body={id,mode:'create',...fields};let r=await post(a,body);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(entity(id).data.owner,'alice');assert.equal(entity(id).data.source,'direct');assert.equal(entity(id).data.unit,'تولید');
 assert.equal((await post(a,body)).data.repeated,true);assert.equal((await post(a,{...body,title:'changed'})).status,409);assert.equal((await post(b,body)).status,409);
 const dup=await post(a,{mode:'create',...fields});assert.equal(dup.data.duplicate,true);assert.equal(dup.data.requestId,id);assert.equal((await get(a)).data.total,1);
 assert.equal((await get(b,'requestId='+id)).status,404);assert.equal((await get(b)).data.total,0);assert.equal((await get(admin)).data.total,1);
 assert.equal((await post(a,{mode:'create',...fields,source:'assistant'})).status,400);assert.equal((await post(a,{mode:'create',...fields,owner:'bob'})).status,400);
 assert.equal((await post(a,{mode:'create',...fields,confirmed:false})).status,400);assert.equal((await post(a,{mode:'create',...fields,title:' '})).status,400);
 assert.equal((await post(a,{mode:'create',...fields},{origin:'https://attacker.test'})).status,403);assert.equal((await post(a,{mode:'create',...fields},{'x-assistant-account':'bob'})).status,409);
 assert.equal((await run(a,()=>api.GET(request('/api/development','GET',undefined,{'x-assistant-account':'bob'})))).status,409);
 const review={mode:'review',requestId:id,revision:1,state:'needs_info',note:'چه خروجی می‌خواهید؟'};
 assert.equal((await post(a,review)).status,403);assert.equal((await post(admin,review)).status,200);assert.equal((await get(admin,'view=summary')).data.summary.attention,0);assert.equal((await get(a,'view=summary')).data.summary.attention,1);
 assert.equal((await post(admin,{...review,note:'stale'})).status,409);
 assert.equal((await post(b,{mode:'clarify',requestId:id,revision:2,note:'no'})).status,404);assert.equal((await post(admin,{mode:'clarify',requestId:id,revision:2,note:'impersonation'})).status,403);
 assert.equal((await post(a,{mode:'clarify',requestId:id,revision:2,note:'خروجی اکسل لازم است'})).status,200);assert.equal(entity(id).data.state,'new');assert.equal(entity(id).data.history.length,2);assert.equal((await get(admin,'view=summary')).data.summary.attention,1);
 const race=await Promise.all(['planned','reviewing'].map(state=>post(admin,{mode:'review',requestId:id,revision:3,state,note:state})));assert.equal(race.filter(x=>x.status===200).length,1);assert.equal(entity(id).revision,4);
 const creationRace=await Promise.all([1,2].map(()=>post(a,{mode:'create',...fields,title:'concurrent need'})));assert.equal(creationRace.filter(x=>x.status===200&&!x.data.duplicate).length,1);assert.equal((await get(a)).data.total,2);
 const detail=(await get(admin,'requestId='+id)).data;assert.ok(detail.copyText.includes('خروجی اکسل لازم است'));assert.ok(detail.copyText.includes('تولید'));assert.ok(detail.copyText.includes('۱۴۰۵'));assert.ok(!detail.copyText.includes('fingerprint'));assert.equal(detail.copyText,contract.developmentCopy(detail.request));
 assert.equal((await get(b,'query='+encodeURIComponent(fields.title))).data.total,0);
 const p={user:a,scope:'read_write',tokenId:null},mp={id:crypto.randomUUID(),...fields,title:'MCP need',confirmed:true};
 await assert.rejects(()=>catalog.executeTool('submit_development_request',mp,base,{...p,scope:'read'}),/read-only/);
 await assert.rejects(()=>catalog.executeTool('review_development_request',{id:crypto.randomUUID(),requestId:id,revision:4,state:'planned',note:'Unauthorized',confirmed:true},base,p),/admin|مدیر|permission|مجاز|Forbidden/i);
 await assert.rejects(()=>catalog.executeTool('submit_development_request',{...mp,confirmed:false},base,p));
 const mr=await catalog.executeTool('submit_development_request',mp,base,p);assert.equal(mr.saved,true);assert.equal((await catalog.executeTool('get_development_requests',{requestId:mr.requestId},base,p)).request.data.title,'MCP need');
 const guide=await catalog.executeTool('get_development_guide',{},base,p);assert.ok(guide.help.length);assert.ok(guide.kinds.access);assert.equal((await catalog.executeTool('get_development_attention',{},base,p)).accountId,a.userId);
 // Mock provider proposes unsupported need; persisted only after same-owner confirmation.
 const profileId=crypto.randomUUID();await run(admin,()=>configs.PUT(request('/api/llm-config','PUT',{id:profileId,revision:0,name:'Mock',model:'mock-model',baseUrl:'https://example.test/v1',systemPrompt:'',temperature:0.4,maxTokens:1000,apiToken:'test-key'})));
 proposedArgs={...fields,title:'Assistant need'};const send=()=>run(a,()=>chat.POST(request('/api/assistant','POST',{requestId:crypto.randomUUID(),profileId,message:'این گزارش در سیستم نیست، نیازش را ثبت کن'})));
 let response=await send();assert.equal(response.status,200,await response.clone().text());let answer=await response.json();assert.equal(answer.navigation,'development');let action=answer.actions.find(x=>x.state==='pending');assert.ok(action);assert.equal(action.tool,'submit_development_request');assert.equal(entity(action.args.id),null);
 assert.ok(modelPayloads[0].messages[0].content.includes('permission denial'));assert.ok(modelPayloads[0].tools.some(t=>t.function.name==='submit_development_request'));assert.ok(!modelPayloads[0].tools.some(t=>t.function.name==='review_development_request'));
 const confirm=(u,ok=true)=>run(u,()=>actions.POST(request('/api/assistant/actions','POST',{id:action.id,decision:'confirm',confirmed:ok})));
 assert.equal((await confirm(b)).status,404);assert.equal((await confirm(a,false)).status,400);let ar=await confirm(a);assert.equal((await ar.json()).action.state,'succeeded');await confirm(a);assert.equal(entity(action.args.id).data.source,'assistant');assert.equal(entity(action.args.id).data.history.length,0);
 const aid=action.args.id;await post(admin,{mode:'review',requestId:aid,revision:1,state:'needs_info',note:'مثال بزنید'});
 proposedTool='clarify_development_request';proposedArgs={requestId:aid,revision:2,note:'توضیح بیشتر'};response=await send();assert.equal(response.status,200);answer=await response.json();action=answer.actions.find(x=>x.state==='pending');assert.equal(action.args.requestId,aid,'record requestId must not be replaced with generated operation UUID');
 assert.ok(modelPayloads.at(-1).tools.find(t=>t.function.name===proposedTool).function.parameters.required.includes('requestId'));
 ar=await confirm(a);assert.equal((await ar.json()).action.state,'succeeded');assert.equal(entity(aid).data.history.length,2);assert.equal(entity(aid).data.state,'new');
 assert.ok(sql.prepare("SELECT COUNT(*) n FROM access_audit WHERE action LIKE 'development_%'").get().n>=7);
 // Pagination and count restricted at SQL level, with stable ordering and independent copies per requester.
 for(let i=0;i<52;i++)assert.equal((await post(b,{mode:'create',...fields,title:'Bob '+i})).status,200);
 const bp=(await get(b)).data;assert.equal(bp.total,52);assert.equal(bp.requests.length,50);assert.equal(bp.nextOffset,50);const bp2=(await get(b,'offset=50')).data;assert.equal(bp2.requests.length,2);assert.equal(bp2.nextOffset,null);assert.equal(new Set([...bp.requests,...bp2.requests].map(r=>r.id)).size,52);
 assert.equal((await get(b,'state=planned')).data.total,0);assert.equal((await get(b,'offset=NaN')).status,400);
 console.log('Development requests passed: account privacy, admin review, clarification, audit, pagination, stale-account protection, source spoofing, confirmations, idempotency, concurrent dedup/revision guards, Persian copy text, MCP parity/scopes and assistant proposal→confirmed create→clarify.');
})().catch(e=>{console.error(e);process.exit(1)});
