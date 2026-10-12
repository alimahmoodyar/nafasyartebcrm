const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')&&(!process.env.TEST_PRE_PASSWORD_MIGRATION||f<'0017')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
let cookie="";const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='next/headers')return {cookies:async()=>({get:()=>cookie?{value:cookie}:undefined})};if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}

const policy=load('lib/permissions.ts'),auth=load('lib/authorization.ts'),flow=load('lib/material-flow.ts'),supply=load('lib/sourcing.ts'),sales=load('lib/sales-access.ts'),service=load('lib/after-sales.ts'),serviceAccess=load('lib/service-access.ts'),hospital=load('lib/hospital.ts'),qms=load('lib/qms.ts'),hr=load('lib/personnel.ts'),assets=load('lib/assets.ts'),transport=load('lib/transport.ts'),cost=load('lib/costing.ts'),finance=load('lib/financial-workflow-roles.ts'),nav=load('lib/navigation-access.ts');
const ids=(...v)=>new Set(v),has=(set,id)=>set.has(id);
const expected={
 salesManager:ids('sales_manager'),salesStaff:ids('sales','sales_manager','home_sales','hospital_sales','sales_manager_assistant','delivery'),
 salesFinance:ids('sales_finance'),
 transportManager:ids('transport_manager'),transportDriver:ids('driver'),
 productWrite:ids('product_manager'),firmwareWrite:ids('firmware'),
 design:ids('engineering','ceo'),custodian:ids('custodian'),
 financeWrite:ids('finance'),
 treasury:ids('treasurer'),financialManager:ids('finance_director'),accountant:ids('accounting_head'),ceoPayment:ids('ceo_payment')
};

// Independent expectations for every legacy module and every production event stage.
const legacy={
 inventory:{read:['batch'],write:['batch']},warehouse_supervisor:{read:['batch'],write:['batch']},production_store_assistant:{read:['batch'],write:['batch']},
 production:{read:['product','batch','device','event'],write:['device','event'],stages:['مصرف قطعه','مونتاژ','بسته‌بندی']},
 qc:{read:['batch','device','event','service','action'],write:['batch','event','action'],stages:['آزمون نهایی']},
 delivery:{},
 product_manager:{read:['product'],write:['product']},firmware:{read:['device','firmware'],write:['firmware']},
 viewer:{read:['product','batch','device','event','service','action','distribution','firmware']},warehouse_finance:{read:['batch']}
};
for(const id of ['planning','engineering','ceo'])legacy[id]={read:['product']};
for(const id of ['domestic','foreign'])legacy[id]={read:['batch']};
const qualityWriters={document:['qa','documents'],permit:['qa','regulatory','technical'],audit:['qa','auditor'],capa:['qa','qc','technical'],design:[],change:[],risk:[],calibration:['qa','calibration'],release:['qa','qc'],complaint:['qa','technical','regulatory'],training:['qa','documents','technical'],management:['qa'],software:['qa','technical'],form:['qa','documents'],response:['qa','documents','qc','technical']};

const validAssignment=id=>{const role=policy.jobRoles.find(r=>r.id===id);return {roles:[id],...(role.scope==='warehouses'?{warehouses:[id==='production_store_assistant'?'line':'raw']}:{}),...(['services','serviceAgent'].includes(role.scope)?{serviceDomains:['home']}:{}),...(role.scope==='salesAgent'?{salesAgentId:'rep-A'}:{}),...(role.scope==='serviceAgent'?{serviceAgentId:'service-A'}:{})};};
const members=[],users=[];
for(const role of policy.jobRoles){const p=policy.validatePermissions({roleAssignment:validAssignment(role.id)}),u={userId:'local:'+role.id,email:'',name:role.label,isAdmin:false,permissions:p};users.push([role.id,u]);members.push({id:role.id,subject:null,status:'active',permissions:JSON.stringify(p)});}
(async()=>{
let assertions=0;
const check=(actual,wanted,name,id)=>{assert.equal(!!actual,!!wanted,id+': '+name);assertions++;};
for(const [id,u] of users){
 const specification=legacy[id]||{};
 for(const kind of policy.modules)for(const operation of ['read','write'])check(auth.can(u,kind,operation),(specification[operation]||[]).includes(kind),operation+':'+kind,id);
 for(const stage of policy.stages)check(u.permissions.eventStages.includes(stage),(specification.stages||[]).includes(stage),'eventStage:'+stage,id);

 for(const [name,predicate] of Object.entries({salesManager:sales.salesManager,salesStaff:sales.salesStaff,salesFinance:sales.salesFinance,transportManager:transport.transportManager,transportDriver:transport.transportDriver,financeWrite:cost.costWrite}))check(predicate(u),has(expected[name],id),name,id);
 for(const predicate of ['hospitalManager','hospitalTech','hospitalInventory','hospitalLogistics'])check(hospital[predicate](u),false,predicate+':home isolation',id);
 check(hospital.hospitalFinance(u),false,'hospitalFinance',id);
 check(nav.canOpenSection(u,'hospital'),['ceo','sales_manager','service_manager'].includes(id),'hospital supervisory navigation',id);
 check(nav.canOpenSection(u,'costing'),['finance','finance_director','accounting_head','warehouse_finance'].includes(id),'costing exact role',id);
 check(nav.canOpenSection(u,'pricing'),['finance','finance_director','accounting_head','warehouse_finance','ceo'].includes(id),'pricing exact role',id);
 check(nav.canOpenSection(u,'finance-control'),['finance','finance_director','accounting_head'].includes(id),'control exact role',id);
 check(nav.canOpenSection(u,'guarantees'),['treasurer','finance_director'].includes(id),'guarantees exact role',id);
 check(nav.canOpenSection(u,'treasury'),['treasurer','finance_director','accounting_head','ceo_payment','purchase_finance'].includes(id),'treasury exact role',id);
 check(auth.can(u,'product','write'),has(expected.productWrite,id),'productWrite',id);check(auth.can(u,'firmware','write'),has(expected.firmwareWrite,id),'firmwareWrite',id);
 for(const [role,key] of [['treasury','treasury'],['manager','financialManager'],['accountant','accountant'],['ceo','ceoPayment']])check(finance.financialWorkflowRole(u.permissions,id,[],role),has(expected[key],id),'financial:'+role,id);
 check((await assets.assetActor(u,members).catch(()=>({custodian:false}))).custodian,has(expected.custodian,id),'custodian',id);
 const qa=await qms.qactor(u,members).catch(()=>null);check(qa?.design,has(expected.design,id),'privateDesign',id);
 for(const [kind,writers] of Object.entries(qualityWriters)){
  const privateRecord=['design','change','risk'].includes(kind),qualityRole=id==='qc'?'qc':id.startsWith('quality_')?id.slice(8):'';
  check(qa&&qms.qwrite({kind,private:privateRecord},qa),privateRecord?has(expected.design,id):id==='ceo'||writers.includes(qualityRole),'qmsWrite:'+kind,id);
 }
if(qa&&!qa.design)assert.equal(qms.qvisible({type:'qms_record',data:{private:true}},qa,[]),false,id+': design data leak');
 const actor=await hr.hrActor(u,members).catch(()=>null);for(const r of ['hr','payroll','approver','finance','treasury','executive_viewer','reporter'])check(actor?.has(r),id==='personnel_'+r||r==='executive_viewer'&&id==='ceo','personnel:'+r,id);
 check(service.domainAccess(u,'home'),id.startsWith('service_')||['ceo','sales_manager'].includes(id),'serviceHome',id);check(service.domainAccess(u,'hospital'),['ceo','sales_manager','service_manager'].includes(id),'serviceHospitalScope',id);
 check(serviceAccess.domainWriteAccess(u,'home'),id.startsWith('service_'),'serviceHomeWrite',id);check(serviceAccess.domainWriteAccess(u,'hospital'),false,'serviceHospitalWriteScope',id);
 if(id.startsWith('service_')&&id!=='service_agent')for(const r of ['support','intake','technician','coordinator','inventory','finance'])check(service.role(u,r),id==='service_'+r||id==='service_manager','service:'+r,id);
 check(flow.warehouseAccess(u,'raw'),['inventory','warehouse_supervisor'].includes(id),'warehouseRaw',id);check(flow.warehouseAccess(u,'finished'),false,'warehouseFinishedScope',id);check(flow.warehouseAccess(u,'line'),id==='production_store_assistant','warehouseLine',id);
 for(const r of ['ceo','engineering','domestic','foreign','finance','inventory','sales','production_planning','commerce_manager']){
 const allowed={ceo:['ceo'],engineering:['engineering'],domestic:['domestic','commerce','domestic_commerce_lead'],foreign:['foreign','commerce','foreign_commerce_lead'],finance:['purchase_finance'],inventory:['inventory','warehouse_supervisor'],sales:['sales','sales_manager','home_sales','hospital_sales','sales_manager_assistant'],production_planning:['planning'],commerce_manager:['commerce','domestic_commerce_lead','foreign_commerce_lead']}[r];check(supply.hasSupply(u,r),allowed.includes(id),'supply:'+r,id);
 }
 const forged=policy.validatePermissions({roleAssignment:validAssignment(id),read:policy.modules,write:policy.modules,eventStages:policy.stages,finance:'write',salesRoles:['manager'],supplyRoles:['ceo'],treasuryWorkflowRoles:['ceo'],qmsRoles:['qa']});assert.deepEqual(JSON.parse(JSON.stringify(forged)),JSON.parse(JSON.stringify(u.permissions)),id+': extra grants merged');assertions++;
 check(nav.canOpenSection(u,'qms'),!!u.permissions.qmsRoles?.length||has(expected.design,id),'QMS navigation',id);
 check(nav.canOpenSection(u,'sales'),has(expected.salesStaff,id)||has(expected.salesManager,id)||has(expected.salesFinance,id)||id==='sales_viewer'||id==='sales_agent','sales navigation',id);
 check(nav.canOpenSection(u,'routine-production'),['production','engineering','qc','ceo'].includes(id),'routine production navigation',id);
 check(nav.canOpenSection(u,'assets'),id==='custodian','assets navigation',id);
 check(nav.canOpenSection(u,'personnel'),!['sales_agent','service_agent'].includes(id),'personnel navigation',id);
 check(nav.canOpenSection(u,'guarantees'),['treasurer','finance_director'].includes(id),'guarantees navigation',id);
 check(nav.canOpenSection(u,'users'),false,'admin users',id);check(nav.canOpenSection(u,'llm'),false,'admin LLM',id);check(nav.canOpenSection(u,'system-reset'),false,'admin reset',id);
}
// Supervisory reading spans both domains, while operations remain explicitly scoped.
for(const role of policy.jobRoles.filter(r=>r.scope==='services')){const p=policy.validatePermissions({roleAssignment:{roles:[role.id],serviceDomains:['hospital']}}),u={isAdmin:false,permissions:p};check(service.domainAccess(u,'hospital'),true,'hospital',role.id);check(service.domainAccess(u,'home'),role.id==='service_manager','home supervisory read',role.id);check(serviceAccess.domainWriteAccess(u,'home'),false,'home write isolation',role.id);check(serviceAccess.domainWriteAccess(u,'hospital'),true,'hospital write scope',role.id);for(const [key,allowed] of Object.entries({hospitalManager:['service_manager','service_coordinator'],hospitalTech:['service_manager','service_coordinator','service_technician'],hospitalFinance:['service_finance'],hospitalInventory:['service_inventory'],hospitalLogistics:[]}))check(hospital[key](u),allowed.includes(role.id),key,role.id);check(nav.canOpenSection(u,'hospital'),true,'hospital navigation',role.id);}
for(const [id] of users.filter(([id])=>!['sales_agent','service_agent','quality_observer'].includes(id))){const combined=policy.validatePermissions({roleAssignment:{...validAssignment(id),roles:[id,'finance']}});assert.equal(combined.finance,'write');const removed=policy.validatePermissions({roleAssignment:validAssignment(id)});assert.equal(removed.finance,users.find(([x])=>x===id)[1].permissions.finance);assertions+=2;}
const scopes=load('lib/financial-access.ts'),treasuryDomain=load('lib/treasury.ts');
for(const grant of ['read','write']){const legacy={isAdmin:false,permissions:{read:[],write:[],finance:grant}};for(const d of ['costing','control','purchase','treasury','guarantees','hospital','transport']){assert.equal(scopes.financialAccess(legacy,d),false,'Generic finance must not grant '+d);assert.equal(scopes.financialAccess(legacy,d,true),false);}}
const tr=users.find(([id])=>id==='treasurer')[1];for(const d of ['costing','control','purchase','hospital','transport'])assert.equal(scopes.financialAccess(tr,d),false,'Treasurer leakage '+d);
const scoped=treasuryDomain.scopedTreasuryRows([{id:'pending',type:'treasury_request',data:{state:'review',createdBy:'other'}},{id:'ready',type:'treasury_request',data:{state:'approved'}},{id:'file1',type:'treasury_file',data:{caseId:'pending'}},{id:'file2',type:'treasury_file',data:{caseId:'ready'}},{id:'cost',type:'cost_price',data:{unitCost:'secret'}}],{treasury:true},'me');
assert.deepEqual(Array.from(scoped,r=>r.id),['ready','file2']);
console.log('PASS complete role access matrix: '+users.length+' job roles, '+assertions+' positive/negative scope and separation checks, exact grant derivation, forbidden admin access and role removal.');
})().catch(e=>{console.error(e);process.exit(1)});
