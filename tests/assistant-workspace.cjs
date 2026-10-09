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

const forms=load('app/api/assistant/forms/route.ts'),workspace=load('lib/assistant-workspace.ts');
(async()=>{
 const clean=workspace.cleanFormArgs({name:'A',data:{password:'SECRET',apiKey:'SECRET',token:'SECRET',qty:2},confirmed:true});assert.deepEqual(JSON.parse(JSON.stringify(clean)),{name:'A',data:{qty:2}});
 const leadTool=catalog.tools.find(t=>t.name==='sales_lead_apply'),leadArgs={mode:'save',revision:0,company:'Example hospital'},schemaBefore=JSON.stringify(leadTool.inputSchema);
 const lead=workspace.operationForm(leadTool,leadArgs,'sales','Generic title');assert.equal(lead.title,'ایجاد سرنخ فروش');assert.equal(lead.schema.properties.title.title,'نام سرنخ فروش');assert.equal(lead.schema.properties.company.title,'نام شرکت / بیمارستان / مرکز');assert.equal(lead.schema.properties.contactName.title,'نام فرد رابط');assert.equal(lead.schema.properties.ownerId.title,'مسئول پیگیری');assert.equal(lead.schema.properties.segment.enumLabels.hospital,'بیمارستانی');assert.equal(lead.schema.properties.nextDue.format,'date');assert.equal(lead.schema.properties.items.items.properties.productId.title,'محصول');assert.equal(lead.args.revision,0);assert.equal(lead.schema.properties.revision.uiHidden,true);assert.equal(lead.schema.properties.mode.uiHidden,true);assert.equal(lead.schema.properties.lossReason.uiHidden,true);assert.ok(lead.schema.required.includes('contactName'));assert.equal(JSON.stringify(leadTool.inputSchema),schemaBefore);assert.equal(JSON.stringify(leadArgs),JSON.stringify({mode:'save',revision:0,company:'Example hospital'}));
 for(const [key,field] of Object.entries(lead.schema.properties).filter(([,f])=>!f.uiHidden))assert.ok(field.title,'Missing visible field title: '+key);
 assert.equal(workspace.operationForm(leadTool,{mode:'save',leadId:'existing',revision:3},'sales','Generic').title,'ویرایش سرنخ فروش');
 const activity=workspace.operationForm(leadTool,{mode:'activity'},'sales','Generic');assert.equal(activity.title,'ثبت تماس و پیگیری سرنخ');assert.equal(activity.schema.properties.company.uiHidden,true);assert.equal(activity.schema.properties.activityType.uiHidden,false);assert.equal(activity.schema.properties.activityType.enumLabels.call,'تماس تلفنی');
 const restored=load('lib/assistant-form-presentation.ts').formPresentation(leadTool.name,leadArgs,leadTool.inputSchema,'Old cached title');assert.equal(restored.title,lead.title);assert.equal(restored.schema.properties.company.title,lead.schema.properties.company.title);
 const send=(u,body,headers={})=>run(u,()=>forms.POST(request('/api/assistant/forms','POST',body,{'x-assistant-account':u.userId,...headers})));
 const id=crypto.randomUUID(),body={id,tool:'submit_development_request',args:{...fields,title:'Manual teaching form'}};
 assert.equal((await send(a,{...body,tool:'delete_user'})).status,403);
 assert.equal((await send(a,body,{'x-assistant-account':'bob'})).status,409);
 assert.equal((await send(a,body,{origin:'https://evil.test'})).status,403);
 assert.equal((await send(a,{...body,args:{title:'Incomplete'}})).status,400);
 let response=await send(a,body);assert.equal(response.status,200,await response.clone().text());const d=await response.json(),action=d.action;assert.equal(action.state,'pending');assert.equal(entity(action.args.id),null);
 assert.equal((await send(a,body)).status,200);assert.equal((await send(a,{...body,args:{...body.args,title:'Changed'}})).status,409);assert.equal(sql.prepare('SELECT COUNT(*) n FROM assistant_actions WHERE id=?').get(id).n,1);
 assert.equal((await send(b,body)).status,409);
 const confirmed=await run(a,()=>actions.POST(request('/api/assistant/actions','POST',{id,decision:'confirm',confirmed:true})));assert.equal((await confirmed.json()).action.state,'succeeded');assert.equal(entity(action.args.id).data.title,'Manual teaching form');
 // Incomplete model answers display a form without creating an executable action.
 const profileId=crypto.randomUUID();await run(admin,()=>configs.PUT(request('/api/llm-config','PUT',{id:profileId,revision:0,name:'Mock',model:'mock-model',baseUrl:'https://example.test/v1',systemPrompt:'',temperature:0.4,maxTokens:1000,apiToken:'test-key'})));
 proposedTool='show_operation_form';proposedArgs={tool:'submit_development_request',args:{kind:'feature',title:'Partial',password:'NEVER'}};
 // Mock alternates a form update and the next question.
 const providerFile=path.resolve(root,'lib/llm-provider.ts'),original=cache[providerFile].providerRequest;
 let round=0;cache[providerFile].providerRequest=async()=>({choices:[{message:round++%2===0?{tool_calls:[{id:'form',type:'function',function:{name:proposedTool,arguments:JSON.stringify(proposedArgs)}}]}:{content:'مشکل فعلی چیست؟'}}]});
 response=await run(a,()=>chat.POST(request('/api/assistant','POST',{requestId:crypto.randomUUID(),profileId,message:'یک درخواست ثبت کن'})));assert.equal(response.status,200,await response.clone().text());const shown=await response.json();assert.equal(shown.workspace.args.title,'Partial');assert.equal(shown.workspace.section,'development');assert.equal(shown.navigation,'development');assert.ok(!JSON.stringify(shown.workspace).includes('NEVER'));assert.equal(shown.actions.filter(x=>x.state==='pending').length,0);
 console.log('PASS assistant workspace: secret-free partial form, authorized navigation, manual preparation without model, confirmation-only execution, origin/account/owner checks and idempotent preparation.');
})().catch(e=>{console.error(e);process.exit(1)});
