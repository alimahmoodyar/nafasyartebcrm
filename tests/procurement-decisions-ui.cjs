const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache={},leaves={};let state=[],cursor=0,calls=[],responseDetail,responseCatalog;
const fakeReact={...React,useEffect(){},useRef:()=>({current:0}),useState:init=>{const i=cursor++;if(!(i in state))state[i]=typeof init==='function'?init():init;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v]}};
const leaf=name=>leaves[name]??=(props=>React.createElement(React.Fragment,null,props.children,props.items?.map((x,i)=>React.createElement('section',{key:i},x.content))));
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{if(n.endsWith('sourcing-review-contract'))return load('lib/sourcing-review-contract.ts');
 if(n.endsWith('procurement-decision-labels'))return load('lib/procurement-decision-labels.ts');if(n==='react')return fakeReact;if(n==='react/jsx-runtime')return require(n);
 if(n==='./sourcing-quote-fields')return load('components/trace/sourcing-quote-fields.tsx');if(n==='./sourcing-quote-comparison')return load('components/trace/sourcing-quote-comparison.tsx');if(n==='@/lib/sourcing-quote-comparison')return load('lib/sourcing-quote-comparison.ts');
 if(n.endsWith('sourcing-delivery'))return load('lib/sourcing-delivery.ts');if(n.endsWith('persian-date'))return {formatDate:x=>x,formatDateTime:x=>x};if(n.endsWith('serials'))return {tehranDay:()=> '2026-11-05'};
 if(n.endsWith('sourcing-workflow'))return {isMaterialSupply:p=>['replenishment','project_material'].includes(p.data.origin)};
 if(n.endsWith('sourcing-labels'))return {supplyRoles:{domestic:'داخلی'},supplyStates:{sourcing:'در استعلام'}};
 if(n.endsWith('ui/select'))return {Select:p=>React.createElement('select',{value:p.value,onChange:e=>p.onValueChange(e.target.value)},p.children),SelectTrigger:leaf('SelectTrigger'),SelectContent:leaf('SelectContent'),SelectItem:p=>React.createElement('option',{value:p.value},p.children),SelectValue:leaf('SelectValue')};
 if(n.endsWith('ui/checkbox'))return {Checkbox:p=>React.createElement('input',{type:'checkbox',checked:p.checked,onChange:e=>p.onCheckedChange(e.target.checked)})};
 if(n.endsWith('number-input'))return {NumberInput:p=>React.createElement('input',p)};
 return new Proxy({},{get:(_,key)=>key==='useWorkspaceBack'?()=>null:leaf(key)});
 },crypto:require('node:crypto').webcrypto,window:{dispatchEvent(){}},Event,fetch:async(url,options)=>{calls.push({url,...options});return {ok:true,json:async()=>options?.method?{saved:true,planId:'p'}:url.includes('?')?responseDetail:responseCatalog}}});return exports;}

const {ProcurementDecisions}=load('components/trace/procurement-decisions.tsx');
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...(typeof x.type==='function'?nodes(x.type(x.props)):nodes(x.props.children))]:[],text=x=>Array.isArray(x)?x.map(text).join(''):React.isValidElement(x)?text(typeof x.type==='function'?x.type(x.props):x.props.children):x==null?'':String(x);
const plan={id:'plan',revision:9,data:{lines:[{partCode:'41',name:'Part'}],exceptions:[{id:'ex',kind:'unforeseen',partCode:'41',title:'Problem',notes:'Reason',evidence:'Document',state:'pending',history:[]}]}};
let roles=['ceo'];const props={plan,quotes:[],orders:[],receipts:[],resolutionOrders:[],can:r=>roles.includes(r),onSaved(){},onNavigate(){}};
const render=()=>{cursor=0;return ProcurementDecisions(props)};
let tree=render();assert.ok(text(tree).includes('ثبت تصمیم مدیرعامل'));roles=['domestic'];assert.ok(!text(render()).includes('ثبت تصمیم مدیرعامل'));
roles=['ceo'];nodes(render()).find(n=>n.type==='button'&&text(n)==='ثبت تصمیم مدیرعامل').props.onClick();tree=render();
const select=nodes(tree).find(n=>n.type==='select');select.props.onChange({target:{value:'development'}});tree=render();nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'Add requested behavior'}});tree=render();nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
(async()=>{await nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});const sent=JSON.parse(calls.at(-1).body);assert.equal(sent.mode,'decide_exception');assert.equal(sent.exceptionId,'ex');assert.equal(sent.revision,9);assert.equal(sent.decision,'development');assert.equal(sent.confirmed,true);assert.equal(sent.notes,'Add requested behavior');console.log('PASS procurement decisions UI: role-specific controls, explicit confirmation, linked development decision and current revision payload.');})().catch(e=>{console.error(e);process.exit(1)});
