const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..'),leaves={};let slots=[],cursor=0,effects=[],response,navigation=[],profileRequests=[];
const leaf=n=>leaves[n]||(leaves[n]=function Leaf(){}),react={...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i]},useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j]))effects.push(fn);slots[i]=deps}};
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>n==='react'?react:n==='react/jsx-runtime'?require(n):new Proxy({},{get:(_,key)=>leaf(key)}),fetch:async(url,options)=>{profileRequests.push({url,options});return {ok:true,json:async()=>response}},crypto:globalThis.crypto,Date,Intl,console,window:{addEventListener(){},removeEventListener(){},dispatchEvent(){}},Event,CustomEvent:class{},setTimeout,clearTimeout});return exports;}
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
async function mount(render){slots=[];effects=[];render();for(let i=0;i<5;i++){for(const fn of effects.splice(0))fn();await new Promise(r=>setImmediate(r));render();}}
const navigate=(...args)=>navigation.push(args),{RoleTestingPanel}=load('components/trace/role-testing-panel.tsx'),{TasksPanel}=load('components/trace/tasks-panel.tsx');
(async()=>{
for(const operational of [true,false]){response={activeProfile:'central-store',profile:{id:'central-store',title:'مسئول انبار مرکزی',operational,links:[],gaps:[]},work:[{id:'shelf',title:'جانمایی'}],unverified:[]};const render=()=>{cursor=0;return RoleTestingPanel({targetId:'central-store',onNavigate:navigate,onProfile(){}})};await mount(render);const button=nodes(render()).find(n=>n.type==='button'&&text(n).startsWith('کارتابل'));assert.ok(button);button.props.onClick();assert.deepEqual(navigation.pop(),['tasks']);const mailbox=nodes(render()).find(n=>n.type==='button'&&text(n)==='صندوق پیام آزمایشی');assert.equal(mailbox,undefined,'Direct messages are accessed from the shared cartable');assert.equal(nodes(render()).filter(n=>n.type==='h3'&&text(n).includes('کارتابل فرایندی')).length,0,'One shared cartable, no parallel task list');}
const hospital={id:'hospital-sales',title:'کارشناس فروش بیمارستانی',operational:true,buyerScope:'optional',links:[],gaps:[]};
response={profiles:[hospital]};const renderCatalog=()=>{cursor=0;return RoleTestingPanel({onNavigate:navigate,onProfile(){}})};await mount(renderCatalog);
profileRequests=[];nodes(renderCatalog()).find(n=>n.type==='button'&&text(n).includes(hospital.title)).props.onClick();await new Promise(r=>setImmediate(r));
assert.equal(profileRequests[0].options.method,'POST','Opening a role with optional buyer scope enters it directly');
assert.equal(JSON.parse(profileRequests[0].options.body).buyerId,'');
assert.deepEqual(navigation.pop(),['role-testing','hospital-sales']);
response={activeProfile:hospital.id,profile:hospital,work:[],unverified:[],buyerChoices:[{id:'buyer',name:'بیمارستان نمونه'}]};
const renderHospital=()=>{cursor=0;return RoleTestingPanel({targetId:hospital.id,onNavigate:navigate,onProfile(){}})};await mount(renderHospital);
assert.ok(nodes(renderHospital()).some(n=>n.type==='button'&&text(n).startsWith('کارتابل')));
nodes(renderHospital()).find(n=>n.type==='button'&&text(n)==='انتخاب پرونده خریدار').props.onClick();await new Promise(r=>setImmediate(r));
assert.ok(nodes(renderHospital()).some(n=>n.type==='option'&&n.props.value==='buyer'));
// Layout back can reach the role catalog while the server still has the previous role cookie.
for(const activeProfile of ['home-sales','central-store']){
 response={profiles:[hospital],activeProfile};
 const roles=[];
 const renderExitedCatalog=()=>{cursor=0;return RoleTestingPanel({onNavigate:navigate,onProfile:p=>roles.push(p)})};
 await mount(renderExitedCatalog);
 const writes=profileRequests.filter(r=>r.options?.method==='POST').map(r=>JSON.parse(r.options.body));
 assert.equal(writes.at(-1)?.mode,'exit_profile');
 assert.equal(roles.at(-1),null);
 assert.deepEqual(navigation.pop(),['role-testing','']);
 assert.ok(nodes(renderExitedCatalog()).some(n=>n.type==='button'&&text(n).includes(hospital.title)));
}
const representative={id:'sales-representative',title:'نماینده فروش',operational:true,buyerScope:'required',links:[{title:'ثبت درخواست خرید',section:'sales',target:'rep-new-order'},{title:'پیگیری ارسال و دریافت',section:'transport',target:'rep-shipments'}],gaps:[]};
response={profiles:[representative]};await mount(renderCatalog);
profileRequests=[];nodes(renderCatalog()).find(n=>n.type==='button'&&text(n).includes(representative.title)).props.onClick();await new Promise(r=>setImmediate(r));
assert.equal(profileRequests[0].options.method,'POST');
assert.equal(JSON.parse(profileRequests[0].options.body).buyerId,'');
assert.deepEqual(navigation.pop(),['role-testing','sales-representative']);
response={activeProfile:representative.id,profile:representative,work:[],unverified:[],sample:true};
const renderRepresentative=()=>{cursor=0;return RoleTestingPanel({targetId:representative.id,onNavigate:navigate,onProfile(){}})};
await mount(renderRepresentative);
assert.ok(!nodes(renderRepresentative()).some(n=>n.type==='select'));
assert.equal(nodes(renderRepresentative()).find(n=>n.type==='button'&&text(n).startsWith('کارتابل')).props.disabled,false);
assert.ok(!nodes(renderRepresentative()).some(n=>n.type==='button'&&text(n)==='ورود به پروفایل'));
for(const item of representative.links){
 const button=nodes(renderRepresentative()).find(n=>n.type==='button'&&text(n)===item.title);
 assert.ok(button);
 button.props.onClick();
 assert.deepEqual(navigation.pop(),[item.section,item.target]);
}
response={profileReview:{id:'central-store',title:'مسئول انبار مرکزی'},positionWork:[],pendingQuality:2,tasks:[],notifications:[],definitions:[],ownPositions:[],isAdmin:false};const render=()=>{cursor=0;return TasksPanel({demo:false,onNavigate:navigate})};await mount(render);assert.ok(text(render()).includes('پس از تأیید، کار جانمایی همین‌جا ظاهر می‌شود'));assert.ok(nodes(render()).some(n=>n.type===leaves.SubprogramNavigation&&n.props.items.some(i=>i[0]==='inbox')&&n.props.items.some(i=>i[0]==='process')));
response={...response,positionWork:[{id:'shelf',title:'جانمایی محموله تأییدشده',section:'warehouse',target:'specific-receipt'}],pendingQuality:0};await mount(render);const work=nodes(render()).find(n=>n.type==='article'&&text(n).includes('جانمایی محموله'));assert.ok(work);nodes(work).find(n=>n.type==='button').props.onClick();assert.deepEqual(navigation.pop(),['warehouse','specific-receipt']);assert.ok(!text(render()).includes('تعیین و برنامه‌ها را فعال کنید'));
const renderInbox=()=>{cursor=0;return TasksPanel({demo:false,onNavigate:navigate,targetId:'inbox'})};
await mount(renderInbox);
assert.ok(nodes(renderInbox()).some(n=>n.type===leaves.SubprogramNavigation&&n.props.value==='inbox'),'Direct navigation opens the inbox tab for the role profile');
assert.ok(nodes(renderInbox()).some(n=>n.type===leaves.DirectMessages));
console.log('PASS clear cartable entry for operational/personal profiles, no duplicate role queue, shared direct/process tabs, useful pending-QC empty state, exact domain task navigation.');
})().catch(e=>{console.error(e);process.exitCode=1});
