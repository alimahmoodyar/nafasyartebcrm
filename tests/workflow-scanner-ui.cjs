const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{webcrypto}=require('node:crypto');
const listeners=new Map();const win={addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k),dispatchEvent:e=>listeners.get(e.type)?.(e),location:{origin:'https://test.local'}};
const root=path.resolve(__dirname,'..'),cache={},leaves={};let slots=[],cursor=0,effects=[],reply,postReply=null,calls=[];
const react={...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i]},useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j]))effects.push(fn);slots[i]=deps}};
function leaf(name){return leaves[name]||(leaves[name]=function TestLeaf(){return null})}
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);if(n==='lucide-react')return new Proxy({},{get:(_,key)=>leaf(key)});if(n.startsWith('./')||n.includes('components/')||n.startsWith('./')&&/(warehouse-(hub|returns-panel|stock-panel)|personal-home|production-panel|material-flow)\.tsx$/.test(file))return new Proxy({},{get:(_,key)=>leaf(key)});if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},fetch:async (url,options={})=>{calls.push({url,...options});return options.method?postReply||reply:reply},crypto:webcrypto,URL,URLSearchParams,Date,Intl,JSON,Map,Set,BigInt,console,window:win,Event,localStorage:{getItem:()=>JSON.stringify(['sales','flow','inventory','batch','fulfillment','personnel']),setItem(){}}},{filename:file});return exports;}





const {WorkflowScanner}=load('components/trace/workflow-scanner.tsx');
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
let navigated=[],key='warehouse';function tree(){cursor=0;return WorkflowScanner({accountKey:key,user:{userId:'test',permissions:{}},onNavigate:(...args)=>{navigated.push(args);return true}})}
function flush(){const f=effects;effects=[];for(const fn of f)fn()}
function open(){win.dispatchEvent({type:'nafasyar-workflow-scan',detail:{}});return tree()}
const idle=()=>new Promise(r=>setImmediate(r));
(async()=>{
let t=tree();flush();assert.equal(nodes(t).filter(n=>n.props.autoStart).length,0);
t=open();assert.ok(nodes(t).some(n=>n.props.autoStart));const nav={id:'a',title:'Receive',kind:'navigate',section:'warehouse',target:'exact'};
reply={ok:true,json:async()=>({kind:'batch',message:'ok',actions:[nav]})};nodes(t).find(n=>n.props.autoStart).props.onScan('batch');await idle();assert.equal(navigated.length,1);assert.equal(navigated[0][1],'exact');assert.equal(nodes(tree()).filter(n=>n.props.autoStart).length,0);
t=open();reply={ok:true,json:async()=>({kind:'batch',message:'choose',actions:[nav,{...nav,id:'b',title:'QC',target:'qc'}]})};nodes(t).find(n=>n.props.autoStart).props.onScan('batch');await idle();assert.equal(navigated.length,1);t=tree();nodes(t).find(n=>n.type==='button'&&text(n)==='QC').props.onClick();assert.equal(navigated[1][1],'qc');
t=open();reply={ok:true,json:async()=>({kind:'receipt',message:'ok',actions:[{id:'r',title:'Receipt',kind:'receipt',code:'receipt',intake:true,domain:'home'}]})};nodes(t).find(n=>n.props.autoStart).props.onScan('receipt');await idle();t=tree();const receipt=nodes(t).find(n=>n.type===leaves.DriverReceiptsPanel);assert.equal(receipt.props.intake,true);receipt.props.onCreateCase({id:'receipt-id',data:{domain:'home',serial:'SN'}});assert.equal(nodes(tree()).find(n=>n.type===leaves.AfterSalesPanel).props.intakeReceipt.id,'receipt-id','Case remains atomically linked to original receipt');
// A response from a previously selected role must never open a form after role change.
t=open();let resolve;reply={ok:true,json:()=>new Promise(r=>resolve=r)};nodes(t).find(n=>n.props.autoStart).props.onScan('old');await idle();key='other-role';tree();flush();resolve({kind:'batch',actions:[nav]});await idle();assert.equal(navigated.length,2);assert.equal(nodes(tree()).filter(n=>n.props.autoStart).length,0);
assert.ok(calls.every(c=>!c.method&&c.url.startsWith('/api/workflow-scan?')));
console.log('PASS shared scan UI: camera only after gesture, one route auto-opens, multiple choices, exact receipt linkage, stale-role response ignored, read-only resolution.');
})().catch(e=>{console.error(e);process.exitCode=1});
