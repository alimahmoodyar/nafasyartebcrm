const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),cache={},leaves={};let slots=[],cursor=0,effects=[],reply,calls=[],tab='tasks';
const react={...React,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i]},useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j]))effects.push(fn);slots[i]=deps}};
function leaf(name){return leaves[name]||(leaves[name]=function TestLeaf(){return null})}
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n==='react')return react;if(n==='react/jsx-runtime')return require(n);if(n==='lucide-react')return new Proxy({},{get:(_,key)=>leaf(key)});if(n.includes('components/')||n.startsWith('./')&&/material-flow\.tsx$/.test(file))return new Proxy({},{get:(_,key)=>leaf(key)});if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},fetch:async(url,options={})=>{calls.push({url,...options});return reply},crypto:webcrypto,Date,Intl,JSON,Map,Set,BigInt,console,window:{dispatchEvent(){}},Event,localStorage:{getItem:()=>null,setItem(){}}},{filename:file});return exports;}
const {MaterialFlow}=load('components/trace/material-flow.tsx'),nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(x.props.children):x==null?'':String(x);
const request={id:'request-1',type:'request',created:'2026-11-03T08:00:00Z',data:{materialId:'material-1',quantity:5000,state:'awaiting_line_receipt',requestedBy:'Planner',issuedBy:'Warehouse',issuedAt:'2026-11-03T08:00:00Z',allocations:[{batchId:'batch-1',location:'WH1|A-1-1-1',quantity:'5'}]}};
const fixture={roles:['production'],entities:[request,{id:'material-1',type:'material',data:{name:'فیلتر',unit:'عدد'}},{id:'batch-1',type:'receipt',data:{materialId:'material-1',state:'stored',warehouseId:'WH1',quantity:5000}}],rows:[{id:'batch-1',kind:'batch',data:{code:'LOT-1',part:'فیلتر',partCode:'01',unit:'عدد'}}],warehouses:[{id:'WH1',data:{name:'انبار مواد',active:true}}],warehouseIds:[],balances:[{item_id:'batch-1',warehouse:'transit',quantity:5000}],slots:[],boms:[],lowStock:[],purchaseOrders:[]};
function tree(){cursor=0;return MaterialFlow({initialTab:tab,embedded:true,demo:false,onSaved(){},onOpen(){}})}
function button(label){return nodes(tree()).find(n=>n.type==='button'&&text(n)===label)}
async function mount(){slots=[];effects=[];calls=[];reply={ok:true,json:async()=>fixture};tree();effects.splice(0).forEach(f=>f());await new Promise(r=>setImmediate(r));return tree()}
(async()=>{
 let t=await mount();assert.ok(text(t).includes('در انتظار تأیید دریافت خط'));const approve=button('تأیید دریافت مواد در خط');assert.ok(approve,'Production role sees the receipt confirmation action');approve.props.onClick();t=tree();assert.ok(text(t).includes('پس از تأیید، مقدار به موجودی قابل‌مصرف خط تولید منتقل می‌شود.'));assert.ok(text(t).includes('LOT-1'));
 let form=nodes(t).find(n=>n.type==='form'),notes=nodes(t).find(n=>n.type?.name==='Input'&&n.props.label==='توضیح دریافت یا مغایرت');assert.ok(form&&notes,'The confirmation dialog provides a notes field');notes.props.onChange('Received all five');t=tree();form=nodes(t).find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));const body=JSON.parse(calls.find(c=>c.method==='POST').body);assert.equal(body.mode,'confirm_line_receipt');assert.equal(body.requestId,'request-1');assert.equal(body.notes,'Received all five');
 tab='tasks';fixture.roles=['inventory'];t=await mount();assert.ok(!text(t).includes('در انتظار تأیید دریافت خط'),'Only production sees line receipt confirmations');
 request.data.state='pending';fixture.warehouseIds=['raw'];request.data.warehouseId='WH1';fixture.warehouses[0].canIssue=true;
 const openIssue=async()=>{await mount();const open=button('تأیید و تحویل به خط');assert.ok(open);open.props.onClick();return tree();};
 t=await openIssue();
 assert.ok(text(t).includes('بچ قابل برداشت پیدا نشد'));
 assert.ok(!text(t).includes('افزودن بچ دیگر'));
 assert.ok(button('تأیید و ثبت').props.disabled);
 fixture.slots=[{batch_id:'batch-1',location:'WH1|A-1-1-1',quantity:2000}];
 t=await openIssue();
 assert.ok(text(t).includes('می‌توانید مقدار موجود را ارسال کنید'));
 assert.equal(button('تأیید و ثبت').props.disabled,false);
 fixture.slots[0].quantity=5000;
 t=await openIssue();
 assert.ok(text(t).includes('اسکن لیبل بچ برداشت‌شده'));
 assert.ok(nodes(t).some(node=>node.props.label==='مقدار واقعی برداشت‌شده'));
 assert.equal(button('تأیید و ثبت').props.disabled,false);
 console.log('PASS line receipt UI: production confirmation action, transfer summary, optional discrepancy note and role visibility.');
})().catch(e=>{console.error(e);process.exitCode=1});
