const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),cache={},leaves={};let slots=[],cursor=0,effects=[],reply,calls=[];
const react={...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i]},useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j]))effects.push(fn);slots[i]=deps}};
function leaf(name){return leaves[name]||(leaves[name]=function TestLeaf(){return null})}
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);if(n==='lucide-react')return new Proxy({},{get:(_,key)=>leaf(key)});if(n.includes('components/')||n.startsWith('./')&&file.endsWith('after-sales-panel.tsx'))return new Proxy({},{get:(_,key)=>leaf(key)});if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},fetch:async url=>{calls.push(url);return reply},crypto:webcrypto,Date,Intl,JSON,Map,Set,BigInt,console,window:{dispatchEvent(){}},Event},{filename:file});return exports;}
const {AfterSalesPanel}=load('components/trace/after-sales-panel.tsx');
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
const user=(id,roles=[],inventory=false,domains=['home'])=>({userId:id,email:'',name:id,isAdmin:id==='admin',permissions:{read:[],write:[],eventStages:[],serviceRoles:roles,serviceDomains:domains,flowRoles:inventory?['inventory']:[]}});
const catalog=roles=>({roles,cases:[],agents:[],tariffs:[],materials:[],lots:[],orders:[],claims:[],shipments:[],members:[],account:[],raw:[],ownAgent:''});
let current;
function tree(){cursor=0;return AfterSalesPanel({demo:false,user:current,onNavigate(){}})}
function navigation(){return nodes(tree()).find(n=>n.type===leaves.SubprogramNavigation)}
function go(key){navigation().props.onChange(key)}
function imports(){return nodes(tree()).filter(n=>n.type===leaves.ServicePartImport)}
async function mount(actor,result,status=200){slots=[];effects=[];calls=[];current=actor;reply={ok:status<400,json:async()=>result};tree();effects.splice(0).forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));tree()}
(async()=>{
 await mount(user('admin'),{error:'GENERAL_CATALOG_UNAVAILABLE'},500);
 assert.ok(navigation().props.items.some(([key])=>key==='settings'),'administrator settings cannot depend on the failed catalog response');
 assert.equal(navigation().props.items.length,6);assert.equal(imports().length,0);go('settings');assert.equal(imports().length,1,'dedicated importer remains reachable when general service catalog fails');
 const workspace=tree();assert.equal(workspace.type,leaves.ProgramWorkspace);assert.ok(text(workspace.props.status).includes('GENERAL_CATALOG_UNAVAILABLE'),'error must be outside the hidden workspace body');assert.ok(nodes(workspace.props.status).some(n=>n.type==='button'),'visible failure offers retry');
 reply={ok:true,json:async()=>catalog(undefined)};await nodes(workspace.props.status).find(n=>n.type==='button').props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(tree().props.status,null);assert.equal(imports().length,1);assert.ok(navigation().props.items.some(([key])=>key==='settings'),'successful response without roles must preserve administrator navigation');
 await mount(user('manager',['manager'],true),{error:'GENERAL_CATALOG_UNAVAILABLE'},500);go('settings');assert.equal(imports().length,1);
 await mount(user('manager-no-inventory',['manager']),catalog([]));go('settings');assert.equal(imports().length,0,'service manager alone cannot define material masters');
 await mount(user('technician',['technician'],true),catalog(['manager']));assert.ok(!navigation().props.items.some(([key])=>key==='settings'),'data.roles cannot grant settings to an ordinary authenticated role');go('settings');assert.equal(imports().length,0);
 await mount(user('inventory-only',[],true),catalog(['manager']));assert.ok(!navigation().props.items.some(([key])=>key==='settings'));go('settings');assert.equal(imports().length,0);
 await mount(user('no-domain',['manager'],true,[]),catalog(['manager']));assert.ok(!navigation().props.items.some(([key])=>key==='settings'));go('settings');assert.equal(imports().length,0,'missing domain authorization cannot open settings');
 await mount(user('agent',['agent'],false),catalog(['manager']));current.permissions.serviceAgentId='agent-id';assert.ok(!navigation().props.items.some(([key])=>key==='settings'));
 console.log('PASS after-sales navigation: administrator and scoped service manager retain settings during catalog failure or absent response roles; importer independently reachable with material permission; spoofed roles and missing domain cannot grant access; visible failure and retry recover.');
})().catch(e=>{console.error(e);process.exitCode=1});
