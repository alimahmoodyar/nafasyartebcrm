const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{webcrypto}=require('node:crypto');
const listeners=new Map();const win={addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k),dispatchEvent:e=>listeners.get(e.type)?.(e),location:{origin:'https://test.local'}};
const root=path.resolve(__dirname,'..'),cache={},leaves={};let slots=[],cursor=0,effects=[],reply,postReply=null,calls=[];
const react={...React,useId:()=>':declaration-review:',useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i]},useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j]))effects.push(fn);slots[i]=deps}};
function leaf(name){return leaves[name]||(leaves[name]=function TestLeaf(){return null})}
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);if(n==='lucide-react')return new Proxy({},{get:(_,key)=>leaf(key)});if(n.startsWith('./')||n.includes('components/')||n.startsWith('./')&&/(warehouse-(hub|returns-panel|stock-panel)|personal-home|production-panel|material-flow)\.tsx$/.test(file))return new Proxy({},{get:(_,key)=>leaf(key)});if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},fetch:async (url,options={})=>{calls.push({url,...options});return options.method?postReply||reply:reply},crypto:webcrypto,URL,URLSearchParams,Date,Intl,JSON,Map,Set,BigInt,console,window:win,Event,CustomEvent,localStorage:{getItem:()=>JSON.stringify(['sales','flow','inventory','batch','fulfillment','personnel']),setItem(){}}},{filename:file});return exports;}






const {CustodianHome,custodyTime}=load('components/trace/custodian-home.tsx');
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
let opened=[],navigated=[],registered=0;const props={data:{accountId:'custodian',records:[{id:'all-asset',data:{name:'All asset',code:'AM1',holderName:'Company',location:'Warehouse',condition:'good'}}],hasMore:false},offset:0,checkedIds:[],onToggle(){},onRegister(){registered++},onOpen:id=>opened.push(id),onWork(){},onSearch(){},onPage(){},onNavigate:section=>navigated.push(section)};
function tree(){cursor=0;return CustodianHome(props)}function flush(){const f=effects;effects=[];for(const fn of f)fn()}const idle=()=>new Promise(r=>setImmediate(r));
function button(t,name){const b=nodes(t).find(n=>n.type==='button'&&text(n).includes(name));assert.ok(b,'Button '+name);return b}
(async()=>{
 reply={ok:true,json:async()=>({accountId:'custodian',work:[],workHasMore:false})};let t=tree();assert.match(text(t),/در حال دریافت کارها/);flush();await idle();t=tree();assert.match(text(t),/All asset/);button(t,'ثبت مال جدید').props.onClick();assert.equal(registered,1);button(t,'کارتابل').props.onClick();assert.deepEqual(navigated,['tasks']);
 nodes(t).find(n=>n.props['aria-label']==='نام شخص').props.onChange({target:{value:'علی'}});t=tree();reply={ok:true,json:async()=>({people:[{id:'alice',name:'علی رضایی',unit:'Sales',active:true}],hasMore:false})};const search=nodes(t).find(n=>n.type==='form'&&text(n).includes('جست‌وجوی شخص'));await search.props.onSubmit({preventDefault(){}});await idle();t=tree();assert.match(text(t),/علی رضایی/);
 reply={ok:true,json:async()=>({person:{id:'alice',name:'علی رضایی',unit:'Sales',active:true},currentTotal:1,records:[{id:'mine',data:{name:'Alice laptop',code:'AM2',location:'Desk',handedDay:'2026-01-01',condition:'good'}}],hasMore:false})};button(t,'علی رضایی').props.onClick();await idle();t=tree();assert.match(text(t),/اموال فعلاً تحویل علی رضایی/);assert.match(text(t),/Alice laptop/);assert.ok(!text(t).includes('All asset'));assert.match(text(t),/ساعت ثبت نشده/);assert.ok(!text(t).includes('۰۰:۰۰'));button(t,'شناسنامه').props.onClick();assert.deepEqual(opened,['mine']);
 reply={ok:true,json:async()=>({person:{id:'alice',name:'علی رضایی',active:true},currentTotal:0,history:[{id:'event',assetId:'old',assetName:'Returned chair',assetCode:'AM0',direction:'released',at:'2026-01-01T09:00:00Z',toName:'Bob',location:'Old office'}],hasMore:false})};button(t,'سابقهٔ تحویل').props.onClick();await idle();t=tree();assert.match(text(t),/Returned chair/);assert.match(text(t),/برگشت \/ انتقال از شخص/);assert.ok(!text(t).includes('Alice laptop'));button(t,'نمایش همهٔ اموال').props.onClick();t=tree();assert.match(text(t),/All asset/);assert.ok(!text(t).includes('Returned chair'));
 // A late search cannot repopulate a cleared selection/query.
 nodes(t).find(n=>n.props['aria-label']==='نام شخص').props.onChange({target:{value:'قدیمی'}});t=tree();let resolve;reply={ok:true,json:()=>new Promise(r=>resolve=r)};const pending=nodes(t).find(n=>n.type==='form'&&text(n).includes('جست‌وجوی شخص')).props.onSubmit({preventDefault(){}});await idle();nodes(tree()).find(n=>n.props['aria-label']==='نام شخص').props.onChange({target:{value:'جدید'}});resolve({people:[{id:'stale',name:'Stale person'}],hasMore:false});await pending;await idle();assert.ok(!text(tree()).includes('Stale person'));
 assert.ok(calls.every(c=>!c.method),'Dashboard search/history never writes');
 const {AssetDeclarationsPanel}=load('components/trace/asset-declarations-panel.tsx');
 slots=[];effects=[];calls=[];listeners.clear();
 const first={id:'decl-1',revision:2,updated:'2026-11-25T09:00:00Z',files:[],data:{memberId:'alice',memberName:'First employee',state:'submitted',items:[],noAssets:true}};
 const second={...first,id:'decl-2',data:{...first.data,memberName:'Second employee'}};
 const result={...first,revision:3,data:{...first.data,state:'approved',groupId:'labels-first',reviewedName:'Keeper'}};
 const fixture=records=>({ok:true,json:async()=>({records,me:'keeper',accountId:'custodian'})});
 const scrolls=[],focuses=[];
 const detail={style:{},closest:()=>({querySelector:()=>({getBoundingClientRect:()=>({height:94})})}),focus:options=>focuses.push(options),scrollIntoView:options=>scrolls.push(options)};
 function reviewTree(){
  cursor=0;const view=AssetDeclarationsPanel({review:true});
  const element=nodes(view).find(node=>node.props.className==='asset-declaration-detail');
  if(element)element.props.ref.current=detail;
  return view;
 }
 reply=fixture([first,second]);reviewTree();flush();await idle();let review=reviewTree();flush();
 assert.equal(new URL(calls[0].url,'https://test.local').searchParams.get('queue'),'true');
 assert.equal(scrolls.length,0,'Opening the queue without selecting a record does not move the page');
 button(review,'First employee').props.onClick();
 review=reviewTree();flush();
 assert.equal(button(review,'First employee').props['aria-pressed'],true);
 assert.equal(focuses[0].preventScroll,true);assert.equal(scrolls[0].block,'start');assert.equal(detail.style.scrollMarginBlockStart,'110px');
 assert.equal(nodes(review).find(n=>n.type==='input'&&n.props.type==='checkbox').props.checked,false);
 nodes(review).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
 reply=fixture([second]);postReply={ok:true,json:async()=>({record:result})};
 button(reviewTree(),'تأیید موجودی نزد این فرد').props.onClick();await idle();review=reviewTree();flush();
 const queue=nodes(review).find(n=>n.type==='aside');
 assert.doesNotMatch(text(queue),/First employee/);assert.match(text(queue),/Second employee/);
 assert.match(text(review),/از صف بررسی خارج شد/);
 assert.ok(nodes(review).some(n=>n.type==='a'&&n.props.href.includes('labels-first')));
 assert.equal(scrolls.length,2,'The approval result is brought into view while the next record stays available');
 console.log('PASS unified custodian UI: direct actions, exact person selection/current/history/clear, day-only display, cartable/detail navigation, stale-response guard and read-only calls');
})().catch(e=>{console.error(e);process.exitCode=1});
