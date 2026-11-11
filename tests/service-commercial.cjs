const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch=null;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const f=beforeBatch;beforeBatch=null;f();}sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db},cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return{env};if(n==='@/app/chatgpt-auth')return{getChatGPTUser:async()=>null};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,Headers,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout,clearTimeout,console},{filename:file});return exports;}
const api=load('app/api/after-sales/route.ts'),context=load('lib/mcp/context.ts').mcpActor,pricing=load('lib/after-sales-pricing.ts'),base='https://test.local',today=load('lib/duties.ts').dayAt();
const addDay=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),yesterday=addDay(today,-1),tomorrow=addDay(today,1);
const actor=(role,domain='home')=>({userId:role+'-'+domain,email:role+'@test.local',name:role,isAdmin:false,permissions:{read:[],write:[],eventStages:[],serviceDomains:[domain],serviceRoles:[role],warehouses:[]}}),manager=actor('manager'),technician=actor('technician');
function seed(id,type,data,created=new Date().toISOString()){sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),created,created);return id;}
function entity(id){const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);assert.ok(r,id);return{...r,data:JSON.parse(r.data)};}
const rows=type=>sql.prepare('SELECT * FROM flow_entities WHERE type=?').all(type).map(r=>({...r,data:JSON.parse(r.data)}));
function caseSeed(code='P',domain='home'){return seed(randomUUID(),'as_case',{domain,agentId:'',serial:randomUUID(),customer:'Customer',phone:'09123456789',complaint:'fault',contactDay:today,intake:{day:today},warranty:{state:'unknown'},state:'received',lines:[],laborLines:[],customerTotal:'0',history:[]});}
async function op(mode,body={},status=200,user=manager){const key=['caseId','tariffId'].find(k=>body[k]),payload={id:randomUUID(),mode,domain:'home',...(key?{revision:entity(body[key]).revision}:{}),...body},request=new Request(base+'/api/after-sales',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify(payload)}),response=await context.run(user,()=>api.POST(request)),data=await response.json();assert.equal(response.status,status,mode+': '+JSON.stringify(data));return{...data,payload};}
async function tariff(code,price,extra={},user=manager){return(await op('tariff',{kind:'part',name:'Part '+code,partCode:code,consumerPriceRial:price,validFrom:yesterday,active:true,...extra},200,user)).id;}
const diagnosis=(caseId,partCode='P',extra={})=>({caseId,lines:[{partCode,quantity:'1',coverage:'paid',fault:'broken',cause:'wear',coverageReason:'chargeable',...extra}],laborLines:[],notes:'diagnosis'});

const commercial=load('app/api/after-sales/commercial/route.ts'),tasks=load('lib/service-commercial-tasks.ts'),profile=load('lib/profile-review.ts'),permissions=load('lib/permissions.ts');
const expert=actor('support'),finance={...actor('finance-director'),permissions:permissions.resolveRoleAssignment({roles:['finance_director']})},ceo={...actor('ceo'),permissions:permissions.resolveRoleAssignment({roles:['ceo']})},admin={userId:'actual-admin',email:'owner@example.com',name:'Actual tester',isAdmin:true,permissions:permissions.allPermissions};
const modeRole={credit_propose:expert,credit_decide:manager,part_price_propose:manager,part_price_decide:finance,work_define:manager,labor_publish:ceo};
async function commercialOp(mode,data={},status=200,user=modeRole[mode]){const body={mode,id:randomUUID(),domain:'home',confirmed:true,...data};const response=await context.run(user,()=>commercial.POST(new Request(base+'/api/after-sales/commercial',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body)})));const result=await response.json();assert.equal(response.status,status,mode+': '+JSON.stringify(result));return {result,body};}
async function workspace(user){const r=await context.run(user,()=>commercial.GET());assert.equal(r.status,200);return r.json();}
async function decide(kind,id,approved=true,user){return commercialOp(kind,{requestId:id,revision:entity(id).revision,approved,notes:'Reviewed test decision'},200,user||modeRole[kind]);}
const realMembers=[manager,expert,finance,ceo,technician];
(async()=>{
 const now=new Date().toISOString();for(const a of realMembers)sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,revision,created,updated) VALUES(?,?,?,'service','active',?,?,1,?,?)").run(a.userId,a.userId+'@test.local',a.name,a.userId,JSON.stringify(a.permissions),now,now);
 const agent=(await op('agent',{confirmed:true,nationalId:'1234567890',mobile:'09123456789',name:'Sepehr service test',code:'SERVICE-SEPEHR',phone:'02112345678',address:'Test address',city:'تهران',province:'تهران',coverage:[],active:true})).id;
 seed('material:12','material',{code:'12',name:'Central spare part',unit:'عدد'});
 for(const id of ['home-service','home-service-manager','home-service-representative','finance-director','ceo'])assert.ok(profile.profileJobRoles[id],id);
 const managerPreview=profile.profileSession(admin,'home-service-manager',[]),expertPreview=profile.profileSession(admin,'home-service',[]),ceoPreview=profile.profileSession(admin,'ceo',[]),financePreview=profile.profileSession(admin,'finance-director',[]);
 const rep=profile.profileSession(admin,'home-service',[],agent),legacyRep=profile.profileSession(admin,'home-service-representative',[],agent);assert.equal(legacyRep.permissions.serviceAgentId,agent);assert.ok(!expertPreview.permissions.serviceAgentId);assert.ok(expertPreview.permissions.serviceRoles.includes('coordinator'));assert.deepEqual(Array.from(rep.permissions.serviceRoles),['agent']);assert.ok(!rep.permissions.serviceRoles.includes('coordinator'));const inbox=load('lib/inbox.ts');assert.notEqual((await inbox.inboxMailbox(expertPreview)).id,(await inbox.inboxMailbox(rep)).id,'scoped representative must not inherit internal preview messages');assert.equal(rep.permissions.serviceAgentId,agent);assert.equal(rep.userId,admin.userId);assert.equal(rep.isAdmin,false);
 assert.ok(await profile.validProfileScope('home-service',agent));assert.ok((await profile.profileScopeChoices('home-service')).some(a=>a.id===agent));assert.ok(await profile.validProfileScope('home-service-representative',agent));assert.ok(!(await profile.validProfileScope('sales-representative',agent)));assert.ok((await profile.profileScopeChoices('home-service-representative')).some(a=>a.id===agent));
 await commercialOp('credit_propose',{agentId:agent,limitRial:'100000',notes:'Initial limit'},403,technician);
 const credit=(await commercialOp('credit_propose',{agentId:agent,limitRial:'100000',notes:'Initial limit'})).result.id;
 assert.equal(entity(agent).data.creditLimitRial,undefined);assert.ok((await workspace(manager)).requests.some(r=>r.id===credit));
 assert.ok(tasks.commercialProfileWork(managerPreview,rows('as_commercial_request')).some(w=>w.sourceId===credit));
 assert.ok(sql.prepare("SELECT id FROM duty_runs WHERE assignee=? AND template_id=? AND state='open'").get(manager.userId,'service-commercial:'+credit));
 await commercialOp('credit_decide',{requestId:credit,revision:1,approved:true,notes:'Wrong role'},403,finance);await decide('credit_decide',credit);assert.equal(entity(agent).data.creditLimitRial,'100000');
 assert.equal(sql.prepare("SELECT state FROM duty_runs WHERE assignee=? AND template_id=?").get(manager.userId,'service-commercial:'+credit).state,'completed');
 const price=(await commercialOp('part_price_propose',{partCode:'12',priceRial:'30000',consumerPriceRial:'45000',validFrom:today,notes:'New part rates'})).result.id;
 assert.equal(rows('as_tariff').length,0);assert.ok(tasks.commercialProfileWork(financePreview,rows('as_commercial_request')).some(w=>w.sourceId===price));
 await commercialOp('part_price_decide',{requestId:price,revision:1,approved:true,notes:'Not finance'},403,manager);
 await decide('part_price_decide',price);const part=entity(price).data.tariffId;assert.equal(entity(part).data.priceRial,'30000');
 await op('tariff',{kind:'part',partCode:'12',name:'Bypass',priceRial:'1',validFrom:today,active:true},409);
 const parts=load('lib/service-parts.ts');sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'product',?,?)").run('product:C',JSON.stringify({name:'Trained model'}),now);
 const proposed=await parts.applyServiceParts(expert,{id:randomUUID(),domain:'home',confirmed:true,mode:'catalog_propose',productId:'product:C',parts:[{partCode:'12'}],catalogRevision:0,notes:'Catalog'});
 await parts.applyServiceParts(ceo,{id:randomUUID(),domain:'home',confirmed:true,mode:'catalog_decide',requestId:proposed.id,revision:1,approved:true,notes:'Reviewed'});
 await parts.applyServiceParts(expert,{id:randomUUID(),domain:'home',confirmed:true,mode:'eligibility',agentId:agent,revision:entity(agent).revision,products:[{productId:'product:C'}],notes:'Trained'});
 const order=(await op('order',{agentId:agent,lines:[{tariffId:part,quantity:'2'}]},200,actor('coordinator'))).id;assert.equal(entity(order).data.totalRial,'60000');
 await op('order',{agentId:agent,lines:[{tariffId:part,quantity:'2'}]},409,actor('coordinator'));
 const work=(await commercialOp('work_define',{name:'Replace assembly',minutes:'10',active:true,notes:'Standard work timing'})).result.id;
 assert.equal(entity(work).data.state,'pending_rate');assert.ok(tasks.commercialProfileWork(ceoPreview,rows('as_service_work')).some(w=>w.sourceId===work));
 await commercialOp('labor_publish',{ratePerMinuteRial:'10000',customerMultiplier:'1.5',policyRevision:0,notes:'Approved'},403,finance);
 const publish=await commercialOp('labor_publish',{ratePerMinuteRial:'10000',customerMultiplier:'1.5',policyRevision:0,notes:'Approved'});
 let labor=rows('as_tariff').find(t=>t.data.kind==='labor');assert.equal(labor.data.priceRial,'100000');assert.equal(labor.data.consumerPriceRial,'150000');assert.equal(labor.data.formula.minutes,10000);
 const count=rows('as_tariff').length;const repeat=await commercialOp('labor_publish',publish.body);assert.equal(repeat.result.repeated,true);assert.equal(rows('as_tariff').length,count);
 // Actual case/contact -> intake -> diagnosis forms consume the published shared reference.
 const cid=(await op('create',{serial:'SERVICE-CUSTOMER-1',customer:'Test customer',phone:'09123456789',day:today,complaint:'Test fault'},200,expert)).id;
 await op('intake',{caseId:cid,day:today,deliverer:'Customer',delivererPhone:'09123456789',accessories:'None',appearance:'Intact'},200,actor('intake'));
 await op('diagnose',{caseId:cid,lines:[],laborLines:[{tariffId:labor.id,covered:false}],notes:'Diagnosed'},200,technician);
 assert.equal(entity(cid).data.customerTotal,'150000');assert.equal(entity(cid).data.laborLines[0].companyRial,'100000');
 const old=JSON.stringify(entity(cid).data.laborLines);
 await commercialOp('labor_publish',{ratePerMinuteRial:'20000',customerMultiplier:'2',policyRevision:1,notes:'New annual rate'});
 assert.equal(JSON.stringify(entity(cid).data.laborLines),old);await op('diagnose',{caseId:cid,lines:[],laborLines:[{tariffId:labor.id,covered:false}],notes:'Stale'},409,technician);
 labor=load('lib/service-commercial-contract.ts').currentServiceLabor(rows('as_tariff'),today,'home')[0];assert.equal(labor.data.priceRial,'200000');assert.equal(labor.data.consumerPriceRial,'400000');
 await op('diagnose',{caseId:cid,lines:[],laborLines:[{tariffId:labor.id,covered:true}],notes:'Warranty'},200,technician);assert.equal(entity(cid).data.customerTotal,'0');assert.equal(entity(cid).data.laborLines[0].companyRial,'200000');
 // Independent ordinary accounts cannot self-approve; admin preview keeps actual actor.
 const mixed={...manager,permissions:{...manager.permissions,treasuryWorkflowRoles:['manager']}};
 const own=(await commercialOp('part_price_propose',{partCode:'12',priceRial:'31000',validFrom:today,notes:'Own proposal'},200,mixed)).result.id;
 await commercialOp('part_price_decide',{requestId:own,revision:1,approved:true,notes:'Self approval'},403,mixed);
 const previewCredit=(await commercialOp('credit_propose',{agentId:agent,limitRial:'120000',notes:'Admin preview'},200,expertPreview)).result.id;
 await decide('credit_decide',previewCredit,true,managerPreview);assert.equal(entity(agent).data.creditApproval.by,admin.userId);
 assert.ok((await workspace(rep)).agents.every(a=>a.id===agent));assert.equal((await workspace(rep)).requests.some(r=>r.data.kind==='part_price'),false);
 const outsider={...rep,permissions:{...rep.permissions,serviceDomains:['hospital']}};const denied=await context.run(outsider,()=>commercial.GET());assert.equal(denied.status,403);
 // A real recorded service prepayment also supplies purchasing power; credit is checked on the resulting net debt.
 await op('payment',{agentId:agent,direction:'received',amountRial:'160000',day:today,reference:'PREPAYMENT-TEST',notes:'Documented prepayment'},200,actor('finance'));
 await op('order',{agentId:agent,lines:[{tariffId:part,quantity:'6'}]},200,actor('coordinator'));
 // Concurrent order debt insertion must invalidate a prechecked credit balance atomically.
 const orderCount=rows('as_order').length,ops=sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n;
 beforeBatch=()=>sql.prepare("INSERT INTO service_ledger(id,agent_id,domain,kind,source_id,debit,credit,due,data,created,actor) VALUES(?,?,'home','invoice',?,'50000','0',NULL,'{}',?,'test')").run(randomUUID(),agent,randomUUID(),now);
 await op('order',{agentId:agent,lines:[{tariffId:part,quantity:'1'}]},409,actor('coordinator'));assert.equal(rows('as_order').length,orderCount);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n,ops);
 // Concurrent timing change cannot publish mixed versions of tariffs/policy.
 const policy=entity('service-labor-policy:home'),n=rows('as_tariff').length;beforeBatch=()=>sql.prepare('UPDATE flow_entities SET revision=revision+1 WHERE id=?').run(work);
 await commercialOp('labor_publish',{ratePerMinuteRial:'30000',customerMultiplier:'2',policyRevision:policy.revision,notes:'Race'},409);assert.equal(entity(policy.id).revision,policy.revision);assert.equal(rows('as_tariff').length,n);
 // Home imports propose prices rather than bypassing the finance approval.
 const imp=load('app/api/after-sales/catalog-import/route.ts'),importer={...manager,permissions:{...manager.permissions,flowRoles:['inventory']}};
 const importBody={domain:'home',source:'test.xlsx',validFrom:today,rows:[{code:'13',name:'Imported part',unit:'عدد',consumerPriceRial:'50000'}]};
 async function importOp(body){const r=await context.run(importer,()=>imp.POST(new Request(base+'/api/after-sales/catalog-import',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body)})));const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
 const preview=await importOp({...importBody,mode:'preview'});const result=await importOp({...importBody,mode:'commit',id:randomUUID(),confirmed:true,catalogSnapshot:preview.catalogSnapshot});assert.equal(result.pendingFinance,true);assert.ok(rows('as_commercial_request').some(r=>r.data.partCode==='13'));assert.ok(!rows('as_tariff').some(r=>r.data.partCode==='13'));const again=await importOp({...importBody,mode:'preview'});assert.equal(again.newTariffCount,0);await importOp({...importBody,mode:'commit',id:randomUUID(),confirmed:true,catalogSnapshot:again.catalogSnapshot});assert.equal(rows('as_commercial_request').filter(r=>r.data.partCode==='13').length,1);
 const reset=load('lib/reset-contract.ts');for(const type of ['as_service_work','as_service_labor_policy','as_commercial_request'])assert.ok(reset.resetFlowCatalog.includes(type));
 const catalog=load('lib/mcp/tools.ts');assert.ok(catalog.tools.some(t=>t.name==='service_commercial_apply'));assert.ok(catalog.tools.some(t=>t.name==='get_service_commercial_workspace'));
 const readTool=catalog.tools.find(t=>t.name==='get_service_commercial_workspace'),writeTool=catalog.tools.find(t=>t.name==='service_commercial_apply');const mcpRead=await context.run(rep,()=>readTool.run({},base,{}));assert.ok(mcpRead.agents.every(a=>a.id===agent));const mcpBody={id:randomUUID(),mode:'credit_propose',confirmed:true,data:{agentId:agent,limitRial:'130000',notes:'MCP parity'}};const mcpWrite=await context.run(expert,()=>writeTool.run(mcpBody,base,{}));assert.equal(entity(mcpWrite.id).data.state,'pending');await assert.rejects(()=>context.run(technician,()=>writeTool.run({...mcpBody,id:randomUUID()},base,{})),/مجوز|دسترسی/);
 console.log('PASS service commercial workflow: real representative registration, role profiles, scoped views, credit approval/enforcement/races, finance-approved part prices/imports, manager time studies, CEO-derived dual labor prices, immutable estimate snapshots, shared cartables and HTTP/MCP contracts.');
})().catch(e=>{console.error(e);process.exitCode=1;});
