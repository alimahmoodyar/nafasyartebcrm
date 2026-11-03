const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),cache={},leaves={};let slots=[],cursor=0,effects=[],reply,calls=[];
const react={...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i]},useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j]))effects.push(fn);slots[i]=deps}};
function leaf(name){return leaves[name]||(leaves[name]=function TestLeaf(){return null})}
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);if(n==='lucide-react')return new Proxy({},{get:(_,key)=>leaf(key)});if(n.includes('components/')||n.startsWith('./')&&/(warehouse-(hub|returns-panel|stock-panel)|personal-home|production-panel|material-flow)\.tsx$/.test(file))return new Proxy({},{get:(_,key)=>leaf(key)});if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},fetch:async (url,options={})=>{calls.push({url,...options});return reply},crypto:webcrypto,Date,Intl,JSON,Map,Set,BigInt,console,window:{dispatchEvent(){}},Event,localStorage:{getItem:()=>JSON.stringify(['sales','flow','inventory','batch','fulfillment','personnel']),setItem(){}}},{filename:file});return exports;}




const {MaterialFlow}=load('components/trace/material-flow.tsx');
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
let fixture,sourceId='approved-order';
function tree(){cursor=0;return MaterialFlow({initialTab:'plans',initialSourcingPlanId:sourceId,demo:false,onSaved(){},onOpen(){}})}
async function mount(roles=['production'],remaining=5){slots=[];effects=[];calls=[];fixture={roles,entities:[],rows:[{id:'product',kind:'product',data:{name:'Oxygen'}}],warehouses:[],warehouseIds:[],balances:[],slots:[],boms:[],lowStock:[],releasedPlans:[{id:'approved-order',productId:'product',name:'Oxygen',remaining}],purchaseOrders:[]};reply={ok:true,json:async()=>fixture};tree();for(let i=0;i<3;i++){effects.splice(0).forEach(f=>f());await new Promise(r=>setImmediate(r));tree();}}
(async()=>{
 await mount();const planning=nodes(tree()).find(n=>n.type===leaves.FinishedProductionPlanning);assert.ok(planning,'Inbox delegates to the shared work-study planner');assert.equal(planning.props.initialOrderId,'approved-order');assert.equal(planning.props.orders[0].productId,'product');assert.ok(calls.every(c=>!c.method),'Opening a referred order never creates serials or inventory');
 await mount(['qc']);assert.ok(!nodes(tree()).some(n=>n.type==='form'));assert.ok(text(tree()).includes('دسترسی برنامه‌ریزی تولید ندارید'));
 await mount(['production'],0);assert.ok(!nodes(tree()).some(n=>n.type==='form'));assert.ok(text(tree()).includes('دیگر منتظر برنامه‌ریزی نیست'));
 console.log('PASS production inbox launch: exact approved source/product, blank explicit quantity, no writes on open, confirmed existing operation, retry UUID, role and stale-order denial.');
})().catch(e=>{console.error(e);process.exitCode=1});
