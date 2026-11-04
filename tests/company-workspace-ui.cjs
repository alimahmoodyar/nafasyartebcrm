const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..'),leaves={};let slots=[],cursor=0,effects=[],calls=[],search='';
const leaf=name=>leaves[name]||(leaves[name]=function Leaf(){return null});
const react={...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;return slots[i]||(slots[i]={current:init})},useMemo:fn=>fn(),useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||!deps||deps.some((v,j)=>v!==old[j]))effects.push(fn);slots[i]=deps}};
const user={userId:'real-user',name:'Company user',username:'user',isAdmin:true,authType:'password',permissions:{read:['product','batch'],write:['product'],eventStages:[]}};
const nav=[{key:'product',title:'Products'},{key:'warehouse',title:'Warehouse'},{key:'device',title:'Devices'}];
const modules={
 '@/lib/manual-permissions-catalog':{manualPermissionSections:nav},
 '@/lib/navigation-access':{warehouseHomeApps:a=>a,warehouseHomeAliases:()=>({}),canOpenSection:()=>true,sectionDestination:(_u,section,target)=>({section,target}),workflowSectionTitle:(_u,_key,title)=>title},
 '@/lib/service-navigation':{serviceHomeApps:a=>a},'@/lib/financial-access':{financialAccess:()=>false},
 '@/lib/model':{names:{product:'Product',batch:'Batch',device:'Device'},fields:{product:[],batch:[],device:[]},editable:{product:[],device:[]},adminBatchEditable:[],label:r=>r.data.name||r.data.code,recordFields:()=>[],productProductionMode:()=> 'routine'},
 '@/lib/persian-date':{formatDate:s=>s,localDay:()=> '2026-11-03',calendarDisplay:x=>x},
 '@/lib/account-change':{notifyAccountChange:()=>{}},'@/lib/product-families':{productFamilyValues:()=>[]},
};
const win={location:{get search(){return search}},addEventListener(){},removeEventListener(){},setInterval(){return 1},clearInterval(){}};
const pageExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'app/page.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:pageExports,require:n=>{
 if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);if(modules[n])return modules[n];
 if(n.startsWith('@/components/')||n==='lucide-react')return new Proxy({},{get:(_,key)=>leaf(key)});
 throw Error('Company workspace must not import sample data or training transport: '+n);
},window:win,document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},fetch:async(url,options={})=>{calls.push({url,options});return {ok:true,json:async()=>url==='/api/session'?user:{accountId:user.userId,records:[{id:'real-product',kind:'product',data:{name:'Real product'},created:'2026-11-03'}]}}},URLSearchParams,AbortController,Date,Intl,Set,Map,console});
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
const render=fn=>{cursor=0;return fn()},tick=async()=>{effects.splice(0).forEach(f=>f());for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r))};
(async()=>{
 // Existing practice bookmarks stop before mounting a company session.
 search='?training=role-8';render(pageExports.default);await tick();let tree=render(pageExports.default);
 assert.equal(tree.type,'main');assert.ok(nodes(tree).some(n=>n.type==='a'&&n.props.href==='/'));assert.equal(calls.length,0);
 // Ordinary navigation fetches company records and contains neither old marker.
 slots=[];effects=[];search='';render(pageExports.default);await tick();const Workspace=render(pageExports.default).type;slots=[];effects=[];
 tree=render(Workspace);await tick();tree=render(Workspace);await tick();tree=render(Workspace);
 for(const section of ['home','product','warehouse']){
  if(section!=='home'){nodes(tree).find(n=>n.type===leaf('Tabs')).props.onValueChange(section);tree=render(Workspace)}
  assert.ok(!/اطلاعات نمونه و آزمایش نقش‌ها|اطلاعات شرکت —|محیط نمونه/.test(text(tree)),section);
  assert.ok(!nodes(tree).some(n=>String(n.props.className||'').includes('workspace-mode')),section);
 }
 assert.ok(calls.some(c=>c.url==='/api/records'));assert.ok(calls.every(c=>!c.url.includes('/training')&&(!c.options.method||c.options.method==='GET')));
 // A product passport is a read-only list of linked devices, never a create shortcut.
 user.permissions.read.push('device');user.permissions.write.push('device');
 nodes(tree).find(n=>n.type===leaf('Tabs')).props.onValueChange('product');tree=render(Workspace);
 nodes(tree).find(n=>n.type==='button'&&n.props.className==='link'&&text(n).includes('Real product')).props.onClick();tree=render(Workspace);
 const passport=nodes(tree).find(n=>n.type===leaf('Dialog')&&text(n).includes('دستگاه‌های این محصول'));
 assert.ok(passport);assert.ok(!nodes(passport).some(n=>n.type==='button'&&text(n).includes('ثبت Device')),'Empty linked-device list must not offer manual registration');assert.ok(!text(passport).includes('با ثبت اولین Device'));
 passport.props.onOpenChange(false);tree=render(Workspace);nodes(tree).find(n=>n.type===leaf('Tabs')).props.onValueChange('device');tree=render(Workspace);
 const legacy=nodes(tree).find(n=>n.type==='details'&&nodes(n).some(c=>c.type==='summary'&&text(c)==='ثبت دستگاه‌های قبلی'));assert.ok(legacy);assert.ok(!legacy.props.open,'Historical entry is collapsed by default');
 const create=nodes(legacy).find(n=>n.type==='button'&&text(n)==='ثبت دستگاه قبلی');assert.ok(create);assert.ok(!nodes(tree).some(n=>n.type==='button'&&text(n)==='ثبت Device'),'No generic new-device toolbar or empty-list shortcut');
 create.props.onClick();tree=render(Workspace);assert.ok(nodes(tree).some(n=>n.type===leaf('DialogTitle')&&text(n)==='ثبت دستگاه قبلی'));
 nodes(tree).find(n=>n.type===leaf('Dialog')).props.onOpenChange(false);user.permissions.write=['product'];tree=render(Workspace);assert.ok(!nodes(tree).some(n=>n.type==='summary'&&text(n)==='ثبت دستگاه‌های قبلی'),'Read-only device users never receive the entry control');
 assert.ok(calls.every(c=>!c.options.method||c.options.method==='GET'),'Opening legacy entry never writes data');
 console.log('Company workspace: old links stop safely; home, catalog and warehouse have no training section/company badge; reads only, no sample import.');
})().catch(e=>{console.error(e);process.exitCode=1});
