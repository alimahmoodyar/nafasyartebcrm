const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..'),cache={},leaves={};let slots=[],cursor=0,effects=[],reply;
const react={...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useEffect:fn=>effects.push(fn)};
function leaf(key){return leaves[key]||(leaves[key]=function Leaf(){return null})}
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);if(n==='lucide-react'||n.includes('components/')||n.startsWith('./')&&file.endsWith('sales-panel.tsx'))return new Proxy({},{get:(_,key)=>leaf(key)});if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'))},fetch:async()=>reply,crypto:globalThis.crypto,Date,Intl,JSON,Map,Set,BigInt,console},{filename:file});return exports;}
const {SalesPanel}=load('components/trace/sales-panel.tsx');
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[];
const text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
function tree(){cursor=0;return SalesPanel({demo:false,onNavigate(){}})}
function nav(){return nodes(tree()).find(n=>n.type===leaves.SubprogramNavigation)}
function data(roles,agents){return{today:'2026-10-12',meName:'Sales',roles,agents,products:[{id:'p',name:'Soshia'}],accounts:[],pipeline:[],tasks:[],orders:[],deliveries:[],targets:[],prices:[],openings:[],members:[],files:[],goals:[],templates:[],allocationPlans:[],help:[]}}
async function mount(d){slots=[];effects=[];reply={ok:true,json:async()=>d};tree();effects.splice(0).forEach(f=>f());await new Promise(r=>setImmediate(r));tree();effects=[]}
(async()=>{
 const assigned={id:'owned',canOperate:true,data:{name:'Assigned buyer',kind:'representative',province:'',city:''}},other={id:'other',canOperate:false,data:{name:'REPORT_ONLY_BUYER',kind:'representative',province:'',city:''}};
 await mount(data({staff:true,manager:false,finance:false,agent:false,leads:true},[assigned,other]));
 const menu=nav().props.items;for(const key of ['new_order','new_payment','leads','orders','home'])assert.ok(menu.some(([id])=>id===key),key);
 for(const key of ['terms','bank','setup','assignments'])assert.ok(!menu.some(([id])=>id===key),'No manager/finance settings '+key);
 assert.equal(menu.find(([key])=>key==='new_order')[1],'ثبت فروش جدید');
 nav().props.onChange('new_order');let dialog=nodes(tree()).find(n=>n.type===leaves.Dialog);assert.equal(dialog.props.open,true,'Launcher opens actual order form');
 const form=nodes(dialog).find(n=>n.type==='form'),select=nodes(form).find(n=>n.type==='select');assert.ok(text(select).includes('Assigned buyer'));assert.ok(!text(select).includes('REPORT_ONLY_BUYER'),'Report grant is not a write grant');
 assert.ok(nodes(form).some(n=>n.type==='button'&&text(n).includes('پیش')),'Actual quote/confirmation form');
 await mount(data({staff:true,manager:false,finance:false,agent:false,leads:true},[assigned,other]));nav().props.onChange('new_payment');dialog=nodes(tree()).find(n=>n.type===leaves.Dialog);assert.equal(dialog.props.open,true);const buyer=nodes(dialog).find(n=>n.type===leaves.BuyerSelect);assert.deepEqual(buyer.props.choices.map(c=>c.id),['owned']);
 await mount(data({staff:false,manager:false,finance:false,agent:false,leads:false},[other]));for(const key of ['new_order','new_payment','leads','terms','bank','setup','assignments'])assert.ok(!nav().props.items.some(([id])=>id===key),'Viewer hides '+key);assert.ok(nav().props.items.some(([id])=>id==='home'));
 await mount(data({staff:true,manager:false,finance:false,agent:false,leads:true},[other]));assert.ok(text(nodes(tree()).find(n=>n.type===leaves.ProgramWorkspace).props.status).includes('تخصیص'));assert.equal(nav().props.onChange('new_order'),false);dialog=nodes(tree()).find(n=>n.type===leaves.Dialog);assert.equal(dialog.props.open,false,'Unassigned buyer does not open a misleading empty order form');
 assert.ok(text(nodes(tree()).find(n=>n.type===leaves.ProgramWorkspace).props.status).includes('فروش ← تخصیص خریدار به کارشناس'));
 await mount(data({staff:true,manager:true,finance:false,agent:false,leads:true},[assigned,other]));assert.ok(nav().props.items.some(([id])=>id==='assignments'));nav().props.onChange('assignments');assert.ok(nodes(tree()).some(n=>n.type===leaves.SalesBuyerAssignments),'Manager opens assignment form');assert.ok(!nodes(tree()).some(n=>n.type==='select'&&text(n).includes('همه نمایندگان')),'No duplicated buyer filter on assignment page');
 assert.equal(nav().props.items.find(([id])=>id==='terms')[1],'الگوهای فروش');nav().props.onChange('terms');const catalog=nodes(tree()).find(n=>n.type===leaves.SalesNetworkPanel);assert.ok(catalog,'Manager sales-template icon opens its independent workspace');assert.equal(catalog.props.templatesOnly,true);
 for(const roles of [{staff:true,manager:false,finance:false,agent:false},{staff:false,manager:false,finance:true,agent:false},{staff:false,manager:false,finance:false,agent:true}]){await mount(data(roles,[assigned]));assert.ok(!nav().props.items.some(([id])=>id==='terms'),'No sales-template management icon for staff, finance or external representative');}
 // Render the real home launcher so concise labels cannot overwrite workflow
 // labels like production request / shipment tracking.
 const home={},source=ts.transpileModule(fs.readFileSync(path.join(root,'components/trace/personal-home.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports:home,require:n=>{if(n.endsWith('.css'))return{};if(n==='@/components/trace/number-input')return{NumberInput:()=>null};return require(n)},console});
 const markup=require('react-dom/server').renderToStaticMarkup(React.createElement(home.PersonalHome,{accountId:'sales',name:'Sales',apps:[{key:'sourcing',title:'درخواست تولید',shortTitle:'درخواست تولید',icon:()=>null},{key:'transport',title:'پیگیری ارسال سفارش',shortTitle:'پیگیری ارسال سفارش',icon:()=>null}],onNavigate(){}}));
 assert.ok(markup.includes('درخواست تولید'));assert.ok(markup.includes('پیگیری ارسال سفارش'));assert.ok(!markup.includes('<strong>تأمین</strong>'));assert.ok(!markup.includes('<strong>حمل‌ونقل</strong>'));
 console.log('PASS sales launcher: real order/payment dialogs, role-specific tools, report-only buyers excluded from edits, explicit assignment blocker and viewer-only report navigation.');
})().catch(e=>{console.error(e);process.exit(1)});
