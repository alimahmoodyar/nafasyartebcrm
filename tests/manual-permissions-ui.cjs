const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache={};let search='';
const react={...React,useState:()=>[search,v=>search=typeof v==='function'?v(search):v]};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{
  if(n==='react')return react;if(n==='cloudflare:workers')return {env:{}};if(n==='next/headers')return {};if(n==='@/app/chatgpt-auth')return {};
  if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(path.extname(p)?p:fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx');}return require(n);
 },Response,Request,URL,URLSearchParams,Date,Intl,Map,Set,TextEncoder,TextDecoder,crypto:globalThis.crypto,console},{filename:file});return exports;
}
const {ManualPermissionsPicker}=load('components/trace/manual-permissions-picker.tsx'),policy=load('lib/permissions.ts'),{manualPermissionSections:catalog}=load('lib/manual-permissions-catalog.ts'),{names}=load('lib/model.ts');
const blank=()=>({read:[],write:[],eventStages:[]});let current=blank();
const salesAgents=[{id:'rep',data:{name:'نماینده فعال',active:true}},{id:'disabled',data:{name:'DISABLED_REP',active:false}}],serviceAgents=[{id:'hospital-rep',data:{name:'نمایندگی بیمارستانی',domain:'hospital',active:true}}];
const element=()=>React.createElement(ManualPermissionsPicker,{permissions:current,onChange:p=>current=p,salesAgents,serviceAgents});
function expand(x){if(Array.isArray(x))return x.map((v,i)=>{const n=expand(v);return React.isValidElement(n)&&n.key===null?React.cloneElement(n,{key:i}):n;});if(!React.isValidElement(x))return x;if(typeof x.type==='function')return expand(x.type(x.props));return React.cloneElement(x,{},expand(x.props.children));}
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[];
const tree=()=>expand(element()),html=()=>renderToStaticMarkup(element()),all=()=>nodes(tree());
const checkbox=label=>{const n=all().find(n=>n.type==='input'&&n.props.type==='checkbox'&&n.props['aria-label']===label);assert.ok(n,'Missing actual checkbox '+label);return n;};
const click=(label,checked)=>checkbox(label).props.onChange({target:{checked}});
const preview=key=>{const n=all().find(n=>n.props['data-section']===key);assert.ok(n,'Missing icon '+key);return n.props['data-access'];};
function reset(p=blank()){current=p;search='';}
assert.equal(catalog.length,40);assert.equal(new Set(catalog.map(s=>s.key)).size,40,'catalog cannot duplicate home icons');
assert.equal(all().filter(n=>n.props['data-section']).length,40,'all admin icons appear immediately');
for(const key of ['users','llm','llm-usage','finance','system-reset'])assert.equal(preview(key),'admin-only');
for(const key of ['reminders','tasks','development','mobile-install','personnel'])assert.equal(preview(key),'visible');
for(const key of ['costing','finance-control','treasury','guarantees','product','transport','assets'])assert.equal(preview(key),'hidden');
assert.ok(!all().some(n=>n.type==='details'),'manual choices must not be hidden under advanced disclosure');
for(const link of all().filter(n=>n.type==='a'))assert.ok(all().some(n=>n.props.id===link.props.href.slice(1)),'icon must lead to real choices '+link.props.href);
assert.ok(html().includes('فقط مدیر سامانه'),'owner-only controls are explained');
assert.ok(!all().some(n=>n.props['aria-label']==='کنترل مالی کلی'),'generic finance is not a grant option');

for(const [id,title] of [['costing','بهای تمام‌شده'],['control','کنترل مالی'],['transport','مالی حمل‌ونقل']]){
 reset();click('ثبت و بررسی '+title,true);assert.deepEqual(Array.from(current.financialRead),[id]);assert.deepEqual(Array.from(current.financialWrite),[id]);policy.validatePermissions(current);
 assert.equal(preview(id==='control'?'finance-control':id),'visible');
 for(const other of ['costing','finance-control','transport'].filter(x=>x!==(id==='control'?'finance-control':id)))assert.equal(preview(other),'hidden','one financial card cannot open '+other);
 click('مشاهده '+title,false);assert.equal(current.financialWrite.length,0,'revoking read also removes write');assert.equal(preview(id==='control'?'finance-control':id),'hidden');
}
reset();const treasury=all().find(n=>n.type==='input'&&n.props['aria-label']?.startsWith('خزانه‌داری؛ خزانه‌دار'));treasury.props.onChange({target:{checked:true}});policy.validatePermissions(current);
for(const key of ['treasury','guarantees','sales-bank'])assert.equal(preview(key),'visible');
for(const key of ['costing','pricing','finance-control'])assert.equal(preview(key),'hidden','treasurer has no financial spillover');
assert.equal(all().filter(n=>n.type==='input'&&n.props['aria-label']?.startsWith('خزانه‌داری؛')).length,4,'all independent workflow authorities available');
assert.ok(all().some(n=>n.type==='input'&&n.props['aria-label']==='خدمات پس از فروش؛ تدارکات خدمات'));
assert.ok(all().some(n=>n.type==='input'&&n.props['aria-label']?.startsWith('گردش مواد؛ تدارکات')));

for(const kind of policy.modules){reset();click('ثبت و ویرایش '+names[kind],true);policy.validatePermissions(current);assert.ok(current.read.includes(kind)&&current.write.includes(kind));click('مشاهده '+names[kind],false);assert.ok(!current.write.includes(kind));}
reset();click('ثبت و ویرایش '+names.event,true);assert.deepEqual(Array.from(current.eventStages),Array.from(policy.stages));for(const stage of policy.stages)assert.ok(checkbox('ثبت مرحله '+stage));click('مشاهده '+names.event,false);assert.equal(current.eventStages.length,0);
reset(policy.toManualPermissions(policy.validatePermissions({roleAssignment:{roles:['engineering']}})));assert.equal(preview('product'),'hidden','role dependency must stay hidden on conversion');assert.equal(preview('sourcing'),'visible');click('ثبت و ویرایش '+names.product,true);assert.equal(preview('product'),'visible','explicit manual operation activates its icon');assert.equal(preview('sourcing'),'visible','manual edit preserves converted workflow icons');policy.validatePermissions(current);
reset({...blank(),manualPrograms:[]});click('مشاهده بهای تمام‌شده',true);assert.equal(preview('costing'),'visible','new manual grant activates its business icon');click('مشاهده بهای تمام‌شده',false);assert.equal(preview('costing'),'hidden');assert.equal(preview('personnel'),'visible','personal apps survive manual business mask');
reset({...blank(),financialRead:['costing'],manualPrograms:[]});click('ثبت و بررسی بهای تمام‌شده',true);assert.equal(preview('costing'),'visible','explicit write opens an icon whose dependency read already exists');assert.equal(preview('pricing'),'visible');assert.equal(preview('finance-control'),'hidden');assert.equal(preview('build-projects'),'hidden','explicit financial operation preserves other hidden programs');policy.validatePermissions(current);
reset({...blank(),flowRoles:['inventory'],warehouses:['raw']});assert.ok(all().some(n=>n.type==='fieldset'&&renderToStaticMarkup(n).includes('انبارهای تحت مسئولیت')));const warehouse=all().find(n=>n.type==='input'&&n.props['aria-label']?.startsWith('دسترسی انبار')&&n.props.checked);warehouse.props.onChange({target:{checked:false}});assert.equal(current.warehouses.length,0);

reset();click('حساب بیرونی نماینده فروش',true);assert.deepEqual(Array.from(current.salesRoles),['agent']);assert.equal(preview('personnel'),'hidden','pending agent must not preview internal pages');
assert.ok(all().find(n=>n.type==='fieldset'&&n.props.id==='manual-treasury').props.disabled);assert.ok(!html().includes('DISABLED_REP'));
let selector=all().find(n=>n.type==='select');selector.props.onChange({target:{value:'rep'}});policy.validatePermissions(current);assert.equal(current.salesAgentId,'rep');assert.equal(preview('sales'),'visible');assert.equal(preview('costing'),'hidden');
click('حساب بیرونی نماینده خدمات',true);selector=all().find(n=>n.type==='select');selector.props.onChange({target:{value:'hospital-rep'}});policy.validatePermissions(current);assert.deepEqual(Array.from(current.serviceDomains),['hospital']);assert.equal(current.serviceAgentId,'hospital-rep');assert.ok(!current.salesAgentId);assert.equal(preview('personnel'),'hidden');
click('حساب بیرونی نماینده خدمات',false);assert.equal(preview('personnel'),'visible');assert.equal(current.serviceAgentId,undefined);

reset();const searchInput=all().find(n=>n.type==='input'&&n.props.placeholder);searchInput.props.onChange({target:{value:'ضمانت‌نامه'}});assert.ok(all().some(n=>n.type==='fieldset'&&n.props.id==='manual-treasury'),'search retains related selectable actions');assert.ok(!all().some(n=>n.type==='fieldset'&&n.props.id==='manual-assets'));assert.equal(preview('guarantees'),'hidden');search='';assert.equal(all().filter(n=>n.props['data-section']).length,40);
const page=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');assert.ok(page.includes("const sections=manualPermissionSections.filter(s=>s.key!=='users')"),'account choices and home use the same catalog');assert.ok(page.includes('visibleSections.some(s=>s.key==="costing")&&<TabsContent value="costing">'),'costing read-only must mount its page');
console.log('PASS manual UI: 40 shared icons, real checkbox grants/revocation, treasury separation, module dependencies/stages, scopes, external isolation, search and read-only costing render.');
if(process.env.MANUAL_PREVIEW){reset({...blank(),treasuryWorkflowRoles:['treasury']});fs.writeFileSync(path.join(root,'tmp/manual-access-preview.html'),'<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app/globals.css"><style>body{margin:0;background:#f3f6fc;color:#253654;font-family:Tahoma,sans-serif;--border:#d8e0ec}.preview{max-width:880px;margin:30px auto;padding:26px;background:white;border-radius:18px}.subtle{color:#64748b;line-height:1.9}input:not([type=checkbox]),select{box-sizing:border-box;padding:12px;border:1px solid #ccd8e8;border-radius:9px}.notice{padding:14px;background:#eff4ff;border-radius:9px}.error{color:#b91c1c}.field{display:block}fieldset{margin:0}h3{font-size:22px}</style><div class="preview"><h2>تعریف حساب — انتخاب دستی دسترسی‌ها</h2><p class="subtle">پیش‌نمایش ظاهری فرم؛ اطلاعات واقعی ثبت نمی‌شود.</p>'+html()+'</div></html>');}
