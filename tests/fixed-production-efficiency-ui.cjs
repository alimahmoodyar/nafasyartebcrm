const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),cache={},leaves={};let slots=[],cursor=0,effects=[],calls=[],fixture,reply,initial='receive',saved=0;
const react={...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j]))effects.push(fn);slots[i]=deps}};
const leaf=name=>leaves[name]||(leaves[name]=function Leaf(){return null});
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);if(n.startsWith('./')||n.startsWith('@/components/'))return new Proxy({},{get:(_,key)=>leaf(key)});if(!n.startsWith('@/'))return require(n);return load(path.join(root,n.slice(2))+'.ts')},fetch:async(url,options={})=>{calls.push({url,...options});return reply||{ok:true,json:async()=>fixture}},crypto:webcrypto,Date,Intl,JSON,Map,Set,console},{filename:file});return exports;}
const {RoutineProductionPanel}=load('components/trace/routine-production-panel.tsx');
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
function tree(){cursor=0;return RoutineProductionPanel({demo:false,finishedProduction:(id)=>React.createElement('section',{'data-finished-source':id})})}const tick=async()=>{for(let i=0;i<3;i++){effects.splice(0).forEach(f=>f());await new Promise(r=>setImmediate(r));tree()}};
const nav=()=>nodes(tree()).find(n=>n.type===leaves.SubprogramNavigation),button=t=>nodes(tree()).find(n=>n.type==='button'&&text(n)===t),picker=t=>nodes(tree()).find(n=>n.type===leaves.MaterialSelect&&n.props.title===t);
const routes=[{id:'route-old',data:{materialId:'part',partCode:'20100040',name:'کاور واسط',version:1,steps:[{title:'Cut',seconds:90,crewSize:1,allowancesIncluded:false,bom:[]}]}},{id:'route-current',data:{materialId:'part',partCode:'20100040',name:'کاور واسط',version:2,steps:[]}}];
const lot={id:'lot-existing',revision:7,data:{title:'Build 1',route:routes[1].data,count:10,pending:0,received:0,scrap:0,ready:[],rework:[],movements:[],quality:[]}};
async function mount(roles,extra={}){slots=[];effects=[];calls=[];reply=null;fixture={roles,jobs:[],routes,lots:[lot],policies:[],line:[],materials:[{id:'part',code:'20100040',name:'کاور واسط',unit:'عدد'},{id:'length',code:'11',name:'Raw length',unit:'متر'}],members:[],help:[],...extra};tree();await tick();}
(async()=>{
 await mount({staff:true,manager:true});nav().props.onChange('settings');button('زمان مفید').props.onClick();button('نسخه تنظیم زمان مفید').props.onClick();
 assert.ok(!nodes(tree()).some(n=>n.props.fieldKey==='efficiencyPercent'),'No editable efficiency input');
 for(const [key,value] of Object.entries({restMinutes:'60',setupMinutes:'20',lowerPercent:'90',upperPercent:'110'})){
  const field=nodes(tree()).find(n=>n.props.fieldKey===key);assert.ok(field,key);field.props.onChange({target:{value}});
 }
 assert.ok(text(nodes(tree()).find(n=>n.type===leaves.DialogDescription)).includes('۱۰۰٪'));
 await nodes(tree()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 const payload=JSON.parse(calls.findLast(c=>c.method==='POST').body);assert.equal(payload.efficiencyPercent,undefined);assert.equal(payload.restMinutes,60);assert.equal(payload.setupMinutes,20);assert.equal(payload.lowerPercent,90);assert.equal(payload.upperPercent,110);
 console.log('PASS useful-time UI: no efficiency field; fixed 100% explained; minute deductions and performance thresholds still submitted.');
})().catch(e=>{console.error(e);process.exitCode=1});
