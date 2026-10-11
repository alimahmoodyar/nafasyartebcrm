const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let slots=[],cursor=0,effects=[],defer=false,pending=[];
const state=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
const react={useState:state,useRef:init=>{const i=cursor++;return slots[i]??=( {current:init});},useEffect:(run,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n]))){old?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=run();});}}};
const jsx=(type,props)=>({type,props}),exportsObject={};
const catalog={today:'2026-10-11',me:'sales-person',roles:{agent:false},agents:[{id:'baran',data:{name:'باران سلامت',kind:'representative',active:true}}],products:[{id:'soshia',name:'سوشیا',status:'فعال'}],templates:[{id:'template',type:'sales_template',created:'now',data:{kind:'representative',version:1,discountBps:1000,cashBps:5000,months:1,minCashBps:3000,maxCashBps:7000,minMonths:1,maxMonths:3}}]};
const quoteFor=args=>({quoteHash:'quote-'+args.items[0].quantity,amount:String(args.items[0].quantity*900),discount:String(args.items[0].quantity*100),deliveryMode:'sale',lines:[{productId:'soshia',name:'سوشیا',quantity:args.items[0].quantity,unitPrice:'1000',discountBps:1000,unitNet:'900'}],salesTerms:{...catalog.templates[0].data,standardCashBps:5000,standardMonths:1},installments:[]});
const mockFetch=async(url,options)=>{
 if(url==='/api/sales')return Response.json(catalog);
 assert.equal(url,'/api/sales/quote');const args=JSON.parse(options.body);
 if(defer)return new Promise(resolve=>pending.push({args,resolve}));
 if(args.salesTerms?.cashBps<3000)return Response.json({error:'شرایط خارج از دامنه مجاز است.'},{status:400});
 return Response.json(quoteFor(args));
};
const pureCache={};function pure(file){if(pureCache[file])return pureCache[file];const exports={};pureCache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl,Date,require:n=>pure(require('node:path').resolve(require('node:path').dirname(file),n+'.ts'))});return exports;}
const source=ts.transpileModule(fs.readFileSync('components/trace/sales-order-workspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports:exportsObject,require:n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n.endsWith('sales-network-contract')?{partnerKinds:{representative:'نماینده'}}:n.endsWith('sales-contract')?{salesRequestChannels:{phone:'تلفن'}}:n.endsWith('persian-date')?{formatDate:v=>v,localDay:()=>catalog.today}:n.endsWith('sales-template')?pure(require('node:path').resolve('lib/sales-template.ts')):n==='./number-input'?{NumberInput:'input'}:n==='./solar-date'?{SolarDate:'date'}:{},fetch:mockFetch,AbortController,JSON,Number,BigInt,Response,console});
let form={tool:'sales_apply',args:{mode:'order',agentId:'baran',items:[{productId:'soshia',quantity:5}],requestSource:{channel:'phone',contactName:'Requester',day:'2026-10-11'}}},prepared=[],reviewReady=false,accountId='sales-person';
const onReviewReady=value=>reviewReady=value;
function flatten(node){if(Array.isArray(node))return node.flatMap(flatten);if(!node||typeof node!=='object')return [];if(typeof node.type==='function')return flatten(node.type(node.props));return [node,...flatten(node.props?.children)];}
function render(){cursor=0;const tree=exportsObject.SalesOrderWorkspace({form,accountId,locked:!!form.actionId,onChange:next=>form=next,onPrepare:args=>prepared.push(args),onReviewReady});const queued=effects;effects=[];queued.forEach(f=>f());return flatten(tree);}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const button=(nodes,text)=>nodes.find(n=>n.type==='button'&&n.props.children===text);
const quantity=nodes=>nodes.find(n=>n.type==='input'&&n.props.fieldKey==='quantity');
(async()=>{
 render();await settle();let nodes=render();
 assert.equal(nodes.filter(n=>n.type==='select').length,3,'Internal sale has buyer, product and receipt channel selectors; reference is optional');
 assert.equal(quantity(nodes).props.value,5);assert.equal(form.args.salesTerms,undefined);
 assert.equal(button(nodes,'بررسی و آماده‌سازی سفارش').props.disabled,false);
 button(nodes,'بررسی و آماده‌سازی سفارش').props.onClick();assert.equal(prepared[0].quoteHash,'quote-5');assert.equal(prepared[0].salesTerms,undefined,'Approved defaults are never zeroed by the UI');
 // Responses arriving out of order cannot restore a stale total or quoteHash.
 defer=true;quantity(nodes).props.onChange({target:{value:'6'}});nodes=render();assert.equal(button(nodes,'بررسی و آماده‌سازی سفارش').props.disabled,true);
 quantity(nodes).props.onChange({target:{value:'7'}});render();assert.equal(pending.length,2);
 pending[1].resolve(Response.json(quoteFor(pending[1].args)));await settle();nodes=render();button(nodes,'بررسی و آماده‌سازی سفارش').props.onClick();assert.equal(prepared.at(-1).quoteHash,'quote-7');
 pending[0].resolve(Response.json(quoteFor(pending[0].args)));await settle();nodes=render();button(nodes,'بررسی و آماده‌سازی سفارش').props.onClick();assert.equal(prepared.at(-1).quoteHash,'quote-7');assert.equal(prepared.at(-1).items[0].quantity,7);
 // Invalid negotiated input stays editable after its preview is rejected.
 defer=false;button(nodes,'واردکردن شرایط پیشنهادی').props.onClick();nodes=render();await settle();nodes=render();
 let cash=nodes.find(n=>n.type==='input'&&n.props.fieldKey==='cashBps');cash.props.onChange({target:{value:'20'}});render();await settle();nodes=render();
 cash=nodes.find(n=>n.type==='input'&&n.props.fieldKey==='cashBps');assert.ok(cash,'Invalid override remains visible for correction');assert.equal(cash.props.value,20);assert.equal(button(nodes,'بررسی و آماده‌سازی سفارش').props.disabled,true);
 cash.props.onChange({target:{value:'50'}});render();await settle();nodes=render();assert.equal(button(nodes,'بررسی و آماده‌سازی سفارش').props.disabled,false);
 form={...form,actionId:'pending',args:{...form.args,quoteHash:'stale-quote'}};render();assert.equal(reviewReady,false,'Stale pending quote cannot be confirmed');
 form={...form,args:{...form.args,quoteHash:'quote-7'}};render();assert.equal(reviewReady,true);
 accountId='different-account';nodes=render();assert.ok(!nodes.some(n=>n.props?.['aria-label']==='خلاصه فروش'),'Switching accounts immediately hides the previous quote');assert.equal(nodes.filter(n=>n.type==='option'&&n.props.value==='baran').length,0,'Previous account catalog must not flash during reload');
 console.log('PASS sales workspace: automatic server quote, compact inputs, quantity edits, stale response isolation, hash invalidation, editable rejected overrides, confirmation gating.');
})().catch(e=>{console.error(e);process.exitCode=1});
