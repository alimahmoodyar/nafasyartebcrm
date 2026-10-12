const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
const env={DB:db,TRACE_OWNER_EMAIL:'owner@workflow.test',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64')},cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n==='cloudflare:workers')return{env};if(n==='@/app/chatgpt-auth')return{getChatGPTUser:async()=>null};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'))}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Map,Set,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout,clearTimeout,structuredClone,console},{filename:file});return exports;}
const policy=load('lib/permissions.ts'),nav=load('lib/navigation-access.ts'),programs=load('lib/workflow-programs.ts'),ctx=load('lib/mcp/context.ts'),catalog=load('lib/mcp/tools.ts'),usersApi=load('app/api/users/route.ts'),salesApi=load('app/api/sales/route.ts'),sales=load('lib/sales.ts'),assetApi=load('app/api/assets/route.ts'),treasury=load('app/api/treasury/route.ts'),guarantees=load('app/api/guarantees/route.ts');
const base='https://test.local',now=new Date().toISOString(),plain=v=>JSON.parse(JSON.stringify(v)),as=(u,f)=>ctx.mcpActor.run(u,f);
const admin={userId:'test-admin',email:'owner@workflow.test',name:'Manager',isAdmin:true,permissions:policy.allPermissions};
const request=(url,body)=>new Request(base+url,{method:'POST',headers:{origin:base},body:JSON.stringify(body)});
const entity=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
const assignment=id=>{const r=policy.jobRoles.find(r=>r.id===id);return{roles:[id],...(r.scope==='warehouses'?{warehouses:[id==='production_store_assistant'?'line':'raw']}:{}),...(['services','serviceAgent'].includes(r.scope)?{serviceDomains:['home']}:{}),...(r.scope==='salesAgent'?{salesAgentId:'rep-test'}:{}),...(r.scope==='serviceAgent'?{serviceAgentId:'service-test'}:{})}};
(async()=>{
 sql.prepare("INSERT INTO app_identity(id,subject) VALUES('owner',?)").run(admin.userId);
 let checks=0;
 for(const role of policy.jobRoles){
  assert.ok(Object.hasOwn(programs.roleWorkflowPrograms,role.id),'Explicit program participation for '+role.id);
  assert.deepEqual(plain(role.programs),plain(programs.roleWorkflowPrograms[role.id]));
  const selected=assignment(role.id),clean=policy.validatePermissions({roleAssignment:selected}),dirty={...clean,read:policy.modules,write:policy.modules,eventStages:policy.stages,salesRoles:['manager','staff','finance'],treasuryWorkflowRoles:['treasury','manager','accountant','ceo'],assetRoles:['custodian'],personnelRoles:['hr'],supplyRoles:['ceo','finance','inventory'],qmsRoles:['qa'],finance:'write'};
  const u={userId:'test:'+role.id,email:'',name:role.label,isAdmin:false,permissions:dirty};
  assert.deepEqual(plain(policy.accessPermissions(dirty)),plain(clean),'Discard stale grants '+role.id);
  for(const section of Object.keys(load('lib/assistant-policy.ts').sectionTitles)){
   assert.equal(nav.canOpenSection(u,section),nav.canOpenSection({...u,permissions:clean},section),'Snapshot cannot change launcher '+role.id+':'+section);
   if(nav.canOpenSection(u,section))assert.ok(programs.selfServicePrograms.includes(section)||role.programs.includes(section),'No dependency-only app '+role.id+':'+section);checks++;
  }
 }
 for(const roles of [['home_sales','delivery','sales_viewer'],['sales_viewer','home_sales','delivery'],['delivery','sales_viewer','home_sales']]){
  const p=policy.validatePermissions({roleAssignment:{roles}}),u={...admin,isAdmin:false,permissions:p};
  assert.deepEqual(plain(p.read),[]);assert.deepEqual(plain(p.write),[]);
  for(const k of ['sales','fulfillment','transport','sourcing','personnel'])assert.equal(nav.canOpenSection(u,k),true,k);
  for(const k of ['treasury','guarantees','assets','inventory','batch','device','product','serials','analytics','event','routine-production','flow','qms','finance-control','costing','pricing'])assert.equal(nav.canOpenSection(u,k),false,k);
  assert.deepEqual(plain(nav.sectionDestination(u,'assets','my-asset')),{section:'personnel',target:'asset:my-asset'});
  assert.equal(nav.workflowSectionTitle(u,'sourcing','x'),'درخواست تولید');
  assert.equal(nav.workflowSectionTitle(u,'transport','x'),'پیگیری ارسال سفارش');
 }
 const malformed={...policy.allPermissions,roleAssignment:{roles:['invalid']}};
 for(const k of ['sales','treasury','assets','guarantees','inventory'])assert.equal(nav.canOpenSection({...admin,isAdmin:false,permissions:malformed},k),false);
 // Create through the same handler that the browser/MCP uses, with deliberately
 // forged extra grants. The saved role intent derives the complete workflow.
 const response=await as(admin,()=>usersApi.POST(request('/api/users',{name:'Sales colleague',email:'sales@workflow.test',status:'active',permissions:{roleAssignment:{roles:['home_sales','delivery','sales_viewer']},...policy.allPermissions}})));
 const created=await response.json();assert.equal(response.status,201,JSON.stringify(created));const m=created.member;
 const p=policy.validatePermissions({roleAssignment:{roles:['home_sales','delivery','sales_viewer']}});
 assert.deepEqual(plain(m.permissions),plain(p));
 sql.prepare('UPDATE app_members SET subject=? WHERE id=?').run('sales-subject',m.id);
 const u={userId:'sales-subject',email:m.email,name:m.name,isAdmin:false,permissions:p};
 entity('owned','sales_agent',{name:'Assigned buyer',active:true,kind:'representative',ownerId:m.id,creditLimit:'0',termDays:0,province:'',city:''});
 entity('other','sales_agent',{name:'Other colleague buyer',active:true,kind:'representative',ownerId:'other-member',creditLimit:'0',termDays:0,province:'',city:''});
 entity('my-asset','asset_item',{name:'My entrusted computer',holderKind:'employee',holderId:m.id,history:[]});
 entity('other-asset','asset_item',{name:'OTHER_ASSET_SECRET',holderKind:'employee',holderId:'other-member',history:[]});
 let r=await as(u,()=>salesApi.GET(new Request(base+'/api/sales'))),d=await r.json();assert.equal(r.status,200,JSON.stringify(d));assert.equal(d.roles.staff,true);assert.equal(d.roles.leads,true);assert.equal(d.roles.finance,false);assert.equal(d.roles.manager,false);
 assert.deepEqual(Array.from(d.agents,a=>[a.id,a.canOperate]).sort(),[['other',false],['owned',true]]);
 await assert.rejects(()=>sales.salesScope(u,'other'),e=>e.status===404);assert.equal((await sales.salesScope(u,'other','read')).id,'other');
 const mcp=await catalog.executeTool('get_sales',{},base,{user:u,scope:'read',tokenId:null});assert.equal(mcp.roles.staff,true);assert.equal(mcp.agents.length,2);
 for(const api of [treasury,guarantees]){r=await as(u,()=>api.GET(new Request(base+'/api/test')));assert.equal(r.status,403)}
 r=await as(u,()=>assetApi.GET(new Request(base+'/api/assets')));d=await r.json();assert.equal(r.status,200,JSON.stringify(d));assert.ok(JSON.stringify(d).includes('My entrusted computer'));assert.ok(!JSON.stringify(d).includes('OTHER_ASSET_SECRET'));assert.equal(d.custodian,false);
 // A role-managed stored snapshot can be old, incomplete or contaminated. The
 // active domain must recompute it, not overwrite the authenticated role result.
 sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify({roleAssignment:{roles:['home_sales','delivery','sales_viewer']},read:policy.modules,write:policy.modules,eventStages:policy.stages,treasuryWorkflowRoles:['treasury'],assetRoles:['custodian'],salesRoles:[]}),m.id);
 r=await as(u,()=>salesApi.GET(new Request(base+'/api/sales')));d=await r.json();assert.equal(r.status,200);assert.equal(d.roles.staff,true);assert.equal(d.roles.finance,false);assert.equal(d.agents.length,2);
 for(const api of [treasury,guarantees])assert.equal((await as(u,()=>api.GET(new Request(base+'/api/test')))).status,403);
 r=await as(u,()=>assetApi.GET(new Request(base+'/api/assets')));d=await r.json();assert.equal(d.custodian,false);assert.ok(!JSON.stringify(d).includes('OTHER_ASSET_SECRET'));
 // Removing operational roles retains reports only and denies mutations.
 sql.prepare('UPDATE app_members SET permissions=? WHERE id=?').run(JSON.stringify({...p,roleAssignment:{roles:['sales_viewer']}}),m.id);
 r=await as(u,()=>salesApi.GET(new Request(base+'/api/sales')));d=await r.json();assert.equal(d.roles.staff,false);assert.equal(d.agents.length,2);assert.ok(d.agents.every(a=>a.canOperate===false));
 r=await as(u,()=>salesApi.POST(request('/api/sales',{id:crypto.randomUUID(),mode:'order',agentId:'owned',confirmed:true})));assert.equal(r.status,403);
 const guide=await catalog.executeTool('get_user_creation_guide',{},base,{user:admin,scope:'read',tokenId:null});assert.equal(guide.rolePolicyVersion,5);assert.ok(guide.jobRoles.find(r=>r.id==='home_sales').programs.includes('sales'));
 console.log('PASS workflow role policy: '+policy.jobRoles.length+' explicit roles / '+checks+' launcher checks, sales+delivery+reports permutations, real account creation, scoped HTTP/MCP sales, read/write ownership separation, private treasury/guarantee denial, personal assets, stale stored grants and role removal.');
})().catch(e=>{console.error(e);process.exit(1)});
