const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
const sentSms=[];let smsAccepted=true;
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)} ,fetch:async(url,options)=>{assert.equal(url,'https://api.sms.ir/v1/send/bulk');sentSms.push(JSON.parse(options.body));return Response.json({status:smsAccepted?1:0,data:{messageIds:[12]}});},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,AbortSignal,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}


const api=load('app/api/activation-code/route.ts'),context=load('lib/mcp/context.ts').mcpActor,algorithm=load('lib/activation-code.ts'),policy=load('lib/activation-code-access.ts');
const perms={read:[],write:[],eventStages:[],salesRoles:['manager']};
function actor(id,p=perms){const u={userId:id,email:id+'@test.local',name:id,isAdmin:false,permissions:p};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'test','active',?,?,?,?)").run(id,u.email,id,id,JSON.stringify(p),new Date().toISOString(),new Date().toISOString());return u;}
const body=(deviceCode='1230123456')=>({id:crypto.randomUUID(),confirmed:true,deviceCode,reason:'درخواست مشتری'});
async function post(u,b=body(),headers={}){const r=await context.run(u,()=>api.POST(request('/api/activation-code','POST',b,headers)));return {status:r.status,d:await r.json()};}
async function get(u){const r=await context.run(u,()=>api.GET(request('/api/activation-code')));return {status:r.status,d:await r.json()};}
(async()=>{
 // Exact independent integer implementation of the supplied VB formula.
 const coeff=[[427n,123n],[742n,485n],[72n,363n],[10n,742n],[537n,181n],[763n,211n],[219n,431n],[745n,521n],[436n,858n],[910n,435n]];
 for(let n=0;n<10000;n++){const code=String((n*976543+17)%10000000000).padStart(10,'0').split('');code[3]=String(n%4);const input=code.join(''),a=BigInt(input.slice(0,5)),b=BigInt(input.slice(5))/10n,[x,y]=coeff[Number((a*a+b*b)%10n)],expected=String(((x*a*a+y*b)%1000000n)%100000n).padStart(5,'0');assert.equal(algorithm.generateActivationCode(input),expected);}
 assert.equal(algorithm.generateActivationCode('0000000000'),'00000');assert.equal(algorithm.generateActivationCode('۰۰۰۰۰۰۰۰۰۰'),'00000');assert.equal(algorithm.generateActivationCode('٠٠٠٠٠٠٠٠٠٠'),'00000');assert.equal(algorithm.generateActivationCode('1230123456'),algorithm.generateActivationCode('1230123459'));
 assert.equal((await api.POST(request('/api/activation-code','POST',body()))).status,401);
 const manager=actor('manager'),home=actor('home',{...perms,salesRoles:[],serviceDomains:['home'],serviceRoles:['support']}),other=actor('other');
 for(const [id,p] of Object.entries({sales:{...perms,salesRoles:['staff']},hospital:{...home.permissions,serviceDomains:['hospital']},agent:{...home.permissions,serviceAgentId:'agent'},agentRole:{...perms,serviceRoles:['agent']},finance:{...home.permissions,serviceRoles:['finance']},customer:{...perms,hospitalCenterId:'hospital'},external:{...perms,salesAgentId:'sales'}})){const u=actor(id,p);assert.equal(policy.canGenerateActivationCode(u),false);assert.equal((await post(u)).status,403);assert.equal((await get(u)).status,403);}
 for(const role of ['intake','technician']){const u=actor(role,{...home.permissions,serviceRoles:[role]});assert.equal((await post(u)).status,200)}
 for(const value of ['1234123456','123012345','12301234567','+123012345','1e00000009','1230 23456','1230.23456',1230123456])assert.equal((await post(manager,body(value))).status,400,String(value));
 for(const extra of [{confirmed:false},{reason:''},{id:'bad'},{extra:'bad'}])assert.equal((await post(manager,{...body(),...extra})).status,400);
 assert.equal((await post(manager,body(),{'x-assistant-account':'other'})).status,409);assert.equal((await post(manager,body(),{origin:'https://evil.test'})).status,403);
 const b=body('۱۲۳۰۱۲۳۴۵۶'),r=await post(manager,b);assert.equal(r.status,200,JSON.stringify(r));assert.match(r.d.activationCode,/^[0-9]{5}$/);assert.equal(r.d.deviceCode,'1230123456');assert.equal((await post(manager,b)).d.repeated,true);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations WHERE id=?').get(b.id).n,1);
 assert.equal((await post(manager,{...b,reason:'different'})).status,409);assert.equal((await post(other,b)).status,409);
 const h=await get(manager);assert.equal(h.status,200);assert.equal(h.d.history.length,1);assert.equal(h.d.history[0].activationCode,r.d.activationCode);assert.equal((await get(home)).d.history.length,0);
 assert.equal((await post(home)).status,200);
 sql.prepare("UPDATE app_members SET permissions=? WHERE id='home'").run(JSON.stringify({...home.permissions,serviceRoles:['finance']}));assert.equal((await post(home)).status,403);assert.equal((await get(home)).status,403);
 sql.prepare("UPDATE app_members SET status='disabled' WHERE id='other'").run();assert.equal((await post(other)).status,403);
 // A concurrent revocation invalidates the atomic audit guard and rolls back.
 const batch=db.batch.bind(db),race=body();db.batch=async(stmts)=>{sql.prepare("UPDATE app_members SET status='disabled' WHERE id='manager'").run();return batch(stmts)};assert.equal((await post(manager,race)).status,409);assert.equal(sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get(race.id),undefined);db.batch=batch;sql.prepare("UPDATE app_members SET status='active' WHERE id='manager'").run();
 // Existing reset triggers stop new codes, while the same existing operation remains retryable.
 sql.prepare("UPDATE reset_control SET phase='maintenance',job_id='test-freeze',internal=0,updated=? WHERE id=1").run(new Date().toISOString());const frozen=body();assert.equal((await post(manager,frozen)).status,423);assert.equal(sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get(frozen.id),undefined);sql.prepare("UPDATE reset_control SET phase='testing',job_id=NULL WHERE id=1").run();
 const reset=load('lib/reset-contract.ts');assert.ok(reset.resetTables.inventory_operations);for(const scope of ['operations','full']){const where=reset.resetWhere('inventory_operations',scope);sql.exec('BEGIN');sql.exec('DELETE FROM inventory_operations WHERE '+where);assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n,0);sql.exec('ROLLBACK');assert.ok(sql.prepare('SELECT id FROM inventory_operations WHERE id=?').get(b.id));}
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM service_activations').get().n,0);assert.equal(sql.prepare('SELECT COUNT(*) n FROM records').get().n,0);
 const training=load('lib/training-context.ts').trainingContext;assert.equal((await training.run({},()=>post(manager))).status,403);
 // Real MCP auth enforces write scope and the identical domain handler.
 identity=owner;const read=await mint('read'),write=await mint('read_write');assert.match(write.token,/^nfy_/);assert.match(read.token,/^nfy_/);identity=null;const denied=await call('generate_activation_code',body(),read.token);assert.ok(denied.error);const generated=await call('generate_activation_code',body(),write.token);assert.match(generated.activationCode,/^[0-9]{5}$/);const hist=await call('get_activation_code_history',{},read.token);assert.equal(hist.history.length,1);
 assert.equal(load('lib/assistant-policy.ts').actionSection('generate_activation_code',{}),'activation-code');assert.ok(load('lib/assistant-policy.ts').assistantWriteNames.has('generate_activation_code'));

 // Phone activation uses the permanent chassis serial and a separate displayed challenge.
 const phoneApi=load('app/api/phone-activation/route.ts'),rolePreview=load('lib/profile-review.ts');
 const {employeeWorkspaces}=load('lib/employee-workspaces.ts');
 const activeOwner={...owner,name:'Administrator',isAdmin:true,permissions:{read:[],write:[],eventStages:[]}};
 const careProfiles=['home-service-customer-support','home-service'];
 const now=new Date().toISOString();
 const put=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);
 const actors=careProfiles.map(profile=>{
  const u=actor(profile,rolePreview.profileSession(activeOwner,profile,[]).permissions);
  put('member-role-assignment:'+profile,'member_role_assignment',{bindings:[{profileId:profile}]});
  const workspaces=employeeWorkspaces(u,[profile]);
  assert.ok(workspaces.find(w=>w.id===profile)?.links.some(link=>link.section==='phone-activation'));
  assert.ok(workspaces.find(w=>w.id===profile)?.links.some(link=>link.section==='activation-history'));
  return u;
 });
 const readPhone=async(u,serial,purpose='activate')=>{
  const r=await context.run(u,()=>phoneApi.GET(request('/api/phone-activation?'+new URLSearchParams({serial,purpose}))));
  return {status:r.status,data:await r.json()};
 };
 const writePhone=async(u,body)=>{
  const r=await context.run(u,()=>phoneApi.POST(request('/api/phone-activation','POST',body)));
  return {status:r.status,data:await r.json()};
 };
 const serial='00540042';
 const nationalBase='001234567';
 const weighted=[...nationalBase].reduce((n,d,i)=>n+Number(d)*(10-i),0)%11;
 const customer={name:'آزمون شناسنامه',mobile:'۰۹۱۲۱۲۳۴۵۶۷',nationalId:nationalBase+(weighted<2?weighted:11-weighted)};
 const pseed=sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'product',?,?)");
 pseed.run('phone-oxygen',JSON.stringify({name:'محصول آزمایشی',model:'M-01',code:'T',status:'فعال',warrantyMonths:'24'}),now);
 assert.equal((await readPhone(manager,serial)).status,403,'legacy generator access does not grant customer file access');
 const draft=(lookup,purpose='activate',extra={})=>({id:crypto.randomUUID(),serial:lookup.device.serial,snapshot:lookup.snapshot,purpose,deviceCode:'1230123456',confirmed:true,...extra});
 const firstLookup=(await readPhone(actors[0],serial)).data;
 assert.equal(firstLookup.device.state,'new');
 assert.equal(firstLookup.device.devicesKnown,false);
 assert.equal((await writePhone(actors[1],draft(firstLookup,'board'))).status,404);
 assert.equal((await writePhone(actors[0],draft(firstLookup))).status,400);
 for(const postalCode of ['123', '1234567890123456', 1234567890]){
  const invalid=await writePhone(actors[0],draft(firstLookup,'activate',{productId:'phone-oxygen',customer:{...customer,postalCode}}));
  assert.equal(invalid.status,400);
  assert.match(invalid.data.error,/کد پستی/);
 }
 assert.equal(sql.prepare('SELECT 1 FROM service_activations WHERE serial=?').get(serial),undefined);
 const firstBody=draft(firstLookup,'activate',{productId:'phone-oxygen',customer});
 const first=await writePhone(actors[0],firstBody);
 assert.equal(first.status,200,JSON.stringify(first));
 assert.equal(first.data.activationCode,'08314');
 assert.equal(first.data.first,true);
 assert.equal(first.data.activatedDay,firstLookup.today);
 assert.equal(first.data.actorName,actors[0].name);
 assert.equal((await writePhone(actors[0],firstBody)).status,200,'retry returns the same result');
 assert.equal((await writePhone(actors[1],firstBody)).status,409,'other operators cannot replay a request ID');
 assert.equal((await writePhone(actors[1],draft(firstLookup,'activate',{productId:'phone-oxygen',customer}))).status,409,'stale first activation cannot start a warranty twice');
 const existing=(await readPhone(actors[1],serial)).data;
 assert.equal(existing.device.state,'activated');
 assert.equal(existing.device.customer.name,customer.name);
 assert.equal(existing.device.customer.postalCode,undefined);
 assert.equal(existing.device.model,'M-01');
 assert.equal(existing.device.activatedDay,firstLookup.today);
 const prior=sql.prepare('SELECT * FROM service_activations WHERE serial=?').get(serial);
 assert.equal((await writePhone(actors[1],draft(existing,'board',{deviceCode:'0054890837'}))).status,400,'current legacy digit policy remains in effect');
 const board=await writePhone(actors[1],draft(existing,'board',{reference:'آزمایش برد'}));
 assert.equal(board.status,200,JSON.stringify(board));
 assert.equal(board.data.first,false);
 assert.deepEqual(sql.prepare('SELECT * FROM service_activations WHERE serial=?').get(serial),prior);
 assert.deepEqual((await readPhone(actors[1],serial,'board')).data.device.customer,{});
 const after=(await readPhone(actors[0],serial)).data.device;
 assert.equal(after.history.length,2);
 assert.ok(after.history.some(e=>e.purpose==='board'&&e.actorName===actors[1].name&&e.reference==='آزمایش برد'));
 assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM flow_entities WHERE type='phone_activation_device'").get().n,1);
 put('legacy-act-1','legacy_activation_event',{event:{serial:'1200123456',deviceSetSerial:'00777001',setSerial:'777001',agencyName:'نمایندهٔ آزمایشی',activeDate:'2021-03-23T06:00:00.000Z',status:'0'}});
 const older=(await readPhone(actors[0],'00777001')).data;
 assert.equal(older.device.state,'activated');
 assert.equal(older.device.activatedDay,'2021-03-23');
 assert.equal(older.device.customer.name,undefined);
 put('legacy-act-2','legacy_activation_event',{event:{activeId:'2',serial:'1200123499',deviceSetSerial:'00777002',setSerial:'777002',agencyName:'نماینده نمونه',agencyCode:'0100',agencyId:'70',activeDate:'2026-11-03T23:45:08.000Z',status:'0',details:{firstName:'سارا',lastName:'احمدی',nationalId:'0012345678',email:'sample@example.test',issuedCode:'08314',profileId:'12'}}});
 put('legacy-activation-agency:70','legacy_activation_agency',{legacyId:'70',salesId:'agencyNew'});
 put('agencyNew','sales_agent',{name:'نمایندگی تصحیح‌شده',active:true,kind:'representative'});
 const oldDossier=(await readPhone(actors[1],'00777002')).data.device;
 assert.equal(oldDossier.activatedDay,'2026-11-03');
 assert.equal(oldDossier.customer.name,'سارا احمدی');
 assert.equal(oldDossier.customer.email,'sample@example.test');
 const boardDossier=(await readPhone(actors[1],'00777002','board')).data.device;
 assert.equal(boardDossier.legacy.details.profileId,undefined);
 assert.equal(boardDossier.legacy.details.email,undefined);
 const history=async(user,params)=>{
  const r=await context.run(user,()=>phoneApi.GET(request('/api/phone-activation?'+new URLSearchParams(params))));
  return {status:r.status,data:await r.json()};
 };
 const filters={view:'history',q:'سارا احمدي',agency:'sales:agencyNew',from:'۱۴۰۵/۰۸/۱۲',to:'۱۴۰۵/۰۸/۱۲'};
 const matched=await history(actors[0],filters);
 assert.equal(matched.status,200,JSON.stringify(matched.data));
 assert.equal(matched.data.rows.length,1);
 assert.equal(matched.data.rows[0].dealer,'نمایندگی تصحیح‌شده');
 assert.equal(matched.data.rows[0].legacy.details.issuedCode,'08314');
 const {importedActivationWarranty}=load('lib/phone-activation-contract.ts');
 const {parseCalendarDay}=load('lib/persian-date.ts');
 const oldActivation=matched.data.rows[0].legacy;
 const today='2026-11-24';
 const warranty=importedActivationWarranty(oldActivation,today);
 assert.equal(warranty.endsOn,'2028-11-02','add two Persian calendar years without shifting a late Excel wall clock into the next day');
 assert.equal(warranty.remainingDays,709);
 assert.equal(importedActivationWarranty(oldActivation,warranty.endsOn).remainingDays,0);
 assert.equal(importedActivationWarranty(oldActivation,'2029-01-01').remainingDays,0);
 assert.equal(importedActivationWarranty({...oldActivation,status:'1'},today),null);
 assert.equal(importedActivationWarranty({...oldActivation,activeDate:'1900-01-01T00:00:00.000Z'},today),null);
 assert.equal(importedActivationWarranty({...oldActivation,activeDate:'2026-12-01T00:00:00.000Z'},today),null);
 const leapDay=parseCalendarDay('1403/12/30');
 assert.ok(leapDay);
 const leapWarranty=importedActivationWarranty({...oldActivation,activeDate:leapDay+'T00:00:00.000Z'},today);
 assert.equal(leapWarranty.endsOn,parseCalendarDay('1405/12/29'));

 const {ActivationDossier}=load('components/trace/activation-dossier.tsx');
 const {createElement}=require('react');
 const {renderToStaticMarkup}=require('react-dom/server');
 const record=matched.data.rows[0];
 const dossier=props=>renderToStaticMarkup(createElement(ActivationDossier,{record,today,...props}));
 const activeDossier=dossier();
 assert.match(activeDossier,/<time dateTime="2028-11-02">۱۲ آبان ۱۴۰۷<\/time>/i);
 assert.match(activeDossier,/<strong>۷۰۹<\/strong>/);
 assert.doesNotMatch(activeDossier,/کد نمایندگی در سیستم قبلی|>0100</);
 assert.match(activeDossier,/نمایندگی تصحیح‌شده|جزئیات ثبت قبلی/);
 assert.match(dossier({today:'2029-01-01'}),/منقضی شده/);
 assert.doesNotMatch(dossier({showCustomer:false}),/سارا احمدی|sample@example\.test|شناسهٔ پروفایل مشتری/);
 assert.doesNotMatch(dossier({legacyDateConfirmed:false}),/تاریخ پایان گارانتی<\/dt>/);
 assert.match(dossier({record:{...record,legacy:undefined,months:12}}),/۱۲ ماه/);
 assert.equal((await history(actors[1],{view:'history',q:'۰۰۷۷۷۰۰۲'})).data.rows.length,1);
 assert.equal((await history(actors[0],{...filters,to:'۱۴۰۵/۰۸/۱۱'})).status,400);
 assert.equal((await history(manager,filters)).status,403);
 assert.ok((await history(actors[0],{view:'history-agencies'})).data.agencies.some(x=>x.id==='sales:agencyNew'));
 const boardRows=(await history(actors[1],{view:'history',q:serial,kind:'board'})).data.rows;
 assert.equal(boardRows.length,1);
 assert.equal(boardRows[0].serial,serial);
 const importedBoard=await writePhone(actors[1],draft(older,'board'));
 assert.equal(importedBoard.status,200);
 assert.equal(importedBoard.data.activatedDay,'2021-03-23');
 assert.equal(importedBoard.data.first,false);
 assert.equal((await writePhone(actors[0],draft(older))).status,200);
 assert.equal(sql.prepare("SELECT 1 FROM service_activations WHERE serial='00777001'").get(),undefined,'historical date is never replaced');
 put('hospital-asset-1','hospital_asset',{serial:'HOSP-123'});
 assert.equal((await readPhone(actors[0],'HOSP-123')).status,403);
 const changedLookup=(await readPhone(actors[0],'00540099')).data;
 const newBody=draft(changedLookup,'activate',{productId:'phone-oxygen',customer});
 db.batch=async(stmts)=>{sql.prepare("UPDATE app_members SET status='disabled' WHERE id=?").run(actors[0].userId);return batch(stmts);};
 assert.equal((await writePhone(actors[0],newBody)).status,409,'revoked access rolls back the activation and its audit');
 db.batch=batch;
 assert.equal(sql.prepare('SELECT 1 FROM service_activations WHERE serial=?').get('00540099'),undefined);
 assert.equal(sql.prepare('SELECT 1 FROM inventory_operations WHERE id=?').get(newBody.id),undefined);
 console.log('PASS phone activation: two assigned roles, separate chassis serial, product warranty policy, legacy reuse, privacy, retry and role revocation rollback, board history and unchanged warranty.');


 const publicApi=load('app/api/public-warranty/route.ts');
 const publicRequest=(body,headers)=>publicApi.POST(request('/api/public-warranty','POST',body,headers));
 const details={serial:'PUBLIC-DEVICE-1',deviceCode:'1230123456',name:customer.name,mobile:'09121234567',nationalId:customer.nationalId,referrer:'پزشک نمونه',address:'نشانی نمونه'};
 const startPublic={mode:'request',details};
 assert.equal((await publicRequest(startPublic)).status,503);
 env.PUBLIC_WARRANTY_ACTIVATION='1';env.PUBLIC_WARRANTY_TEST_MOBILE=details.mobile;env.SMSIR_API_KEY='fake-key';env.SMSIR_LINE_NUMBER='3000000000';
 assert.equal((await (await publicApi.GET()).json()).ready,true);
 assert.equal((await publicRequest(startPublic,{origin:'https://invalid.test'})).status,403);
 assert.equal((await publicRequest(startPublic)).status,409,'unknown serial');
 assert.equal(sentSms.length,0);
 const seedPublic=sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'device',?,?)");
 seedPublic.run('device:PUBLIC-DEVICE-1',JSON.stringify({code:details.serial,product:'phone-oxygen'}),now);
 assert.equal((await publicRequest({mode:'request',details:{...details,mobile:'09120000000'}})).status,403);
 const sent=await publicRequest(startPublic);assert.equal(sent.status,200,await sent.clone().text());const challenge=await sent.json();
 assert.equal(sentSms.length,1);assert.equal(sentSms[0].MessageText.length,64);assert.ok(sentSms[0].MessageText.endsWith('\nلغو11'));
 assert.equal(challenge.activationCode,undefined);
 assert.ok(!sql.prepare('SELECT day FROM service_activations WHERE serial=?').get(details.serial));
 const answer={mode:'confirm',details,token:challenge.token,code:algorithm.generateActivationCode(details.deviceCode)};
 assert.equal((await publicRequest({...answer,code:answer.code==='00000'?'11111':'00000'})).status,403);
 assert.equal((await publicRequest({...answer,details:{...details,address:'changed'}})).status,410);
 const registered=await publicRequest(answer);assert.equal(registered.status,200,await registered.clone().text());
 const final=await registered.json();assert.equal(final.welcomeStatus,'sent');
 assert.equal(sentSms.length,2);assert.equal(sentSms[1].MessageText.length,68);assert.ok(sentSms[1].MessageText.endsWith('\nلغو11'));
 assert.equal(sql.prepare('SELECT day FROM service_activations WHERE serial=?').get(details.serial).day,final.activatedDay);
 const publicDossier=sql.prepare("SELECT data FROM flow_entities WHERE type='phone_activation_device' AND json_extract(data,'$.serial')=?").get(details.serial);
 assert.equal(JSON.parse(publicDossier.data).customer.address,'نشانی نمونه');
 assert.equal((await (await publicRequest(answer)).json()).welcomeStatus,'sent');
 assert.equal(sentSms.length,2,'retry sends no extra welcome');
 assert.equal((await publicRequest(startPublic)).status,409);

 env.PUBLIC_WARRANTY_ACTIVATION='0';
 const guestTest=await context.run(manager,()=>publicRequest({mode:'test-sms'}));
 assert.equal(guestTest.status,403);
 const adminTest=()=>context.run({userId:'test-panel-admin',email:'admin@test.local',name:'Admin',isAdmin:true,permissions:perms},()=>publicRequest({mode:'test-sms'}));
 const sms=await adminTest();assert.equal(sms.status,200,await sms.clone().text());assert.equal((await sms.json()).accepted,true);
 assert.deepEqual(sentSms[2].Mobiles,[env.PUBLIC_WARRANTY_TEST_MOBILE]);assert.equal(sentSms.length,3);assert.ok(sentSms[2].MessageText.endsWith('\nلغو11'));
 assert.equal((await adminTest()).status,429);assert.equal(sentSms.length,3);
 console.log('PASS public warranty: gate, origin, known device, pilot number, one-code registration, dossier, two SMS and replay.');

 console.log('PASS activation: 10,000 VB-compatible vectors; normalization, leading zeros, roles, account/origin, fresh permissions, rollback, reset freeze/backup contract, retry audit, isolated history and MCP scopes.');
})().catch(e=>{console.error(e);process.exit(1)});
