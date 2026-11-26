const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');

const slots=[],effects=[],timers=new Set(),posts=[];
let cursor=0,resolveSlow,slowSignal;
const hooks={
 ...React,
 useState(initial){
  const index=cursor++;
  if(!(index in slots))slots[index]=initial;
  return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];
 },
 useRef(initial){const index=cursor++;return slots[index]??={current:initial};},
 useEffect(effect,deps){
  const index=cursor++,previous=slots[index];
  if(previous&&deps.every((value,i)=>Object.is(value,previous.deps[i])))return;
  effects.push(()=>{previous?.cleanup?.();slots[index]={deps,cleanup:effect()};});
 },
};
const accountId='test';
function lookup(serial,purpose){
 const known=serial==='55060108';
 return {accountId,snapshot:serial+purpose,today:'2026-11-24',linkedProductId:'',
  device:{serial,state:known?'activated':'new',months:24,devicesKnown:known,activatedDay:known?'2026-11-03':'',
   canCorrectLegacy:!known,customer:purpose==='board'?{}:{name:known?'مشتری نمونه':''},history:[],model:'مدل نمونه',dealer:''}};
}
async function fetchFixture(url,options){
 if(options.method==='POST'){
  const body=JSON.parse(options.body);
  posts.push(body);
  return Response.json({accountId,activationCode:'04726',actorName:'کارشناس نمونه',at:'2026-11-24T08:00:00Z',first:body.serial!=='55060108',activatedDay:body.warrantyStartDay||'2026-11-24',corrected:body.purpose==='legacy-correction'&&!!body.warrantyStartDay});
 }
 const query=new URL(url,'https://test.local').searchParams;
 const serial=query.get('serial'),purpose=query.get('purpose');
 if(serial==='55060000'){
  slowSignal=options.signal;
  return new Promise(resolve=>{resolveSlow=()=>resolve(Response.json(lookup(serial,purpose)));});
 }
 return Response.json(lookup(serial,purpose));
}
const root=path.join(__dirname,'..');
function load(file){
 const exports={};
 const source=fs.readFileSync(path.join(root,file),'utf8');
 const compilerOptions={jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions}).outputText,{
  exports,AbortController,URLSearchParams,Intl,crypto:globalThis.crypto,fetch:fetchFixture,
  setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),
  require(name){
   if(name==='react')return hooks;
   if(name==='./solar-date')return {SolarDate:function SolarDate(){return null;}};
   if(name==='./activation-dossier')return {ActivationDossier:()=>null};
   if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
   if(name.startsWith('.'))return load(path.join(path.dirname(file),name)+'.ts');
   return require(name);
  },
 },{filename:file});
 return exports;
}
const {PhoneActivationPanel}=load('components/trace/phone-activation-panel.tsx');
function nodes(){
 cursor=0;
 const tree=PhoneActivationPanel({accountId});
 for(const effect of effects.splice(0))effect();
 function walk(node){
  if(Array.isArray(node))return node.flatMap(walk);
  return node?.props?[node,...walk(node.props.children)]:[];
 }
 return walk(tree);
}
const input=label=>inputFrom(nodes(),label);
const update=(node,value)=>node.props.onChange({target:{value}});
async function settleLookup(){
 nodes();
 for(const timer of [...timers]){
  timers.delete(timer);
  void timer();
 }
 await new Promise(resolve=>setImmediate(resolve));
}
const send=()=>nodes().find(node=>node.type==='form').props.onSubmit({preventDefault(){}});

(async()=>{
 const initial=nodes();
 assert.equal(initial.find(node=>node.type==='input'),inputFrom(initial,'کد ۱۰رقمی نمایشگر'));
 assert.equal(initial.some(node=>node.type==='label'&&/علت صدور|پیگیری/.test(String(node.props.children))),false);
 update(input('کد ۱۰رقمی'),'۰۰۱۰۱۲۳۴۵۶');
 update(input('سریال روی بدنه'),'55060000');
 await settleLookup();
 update(input('سریال روی بدنه'),'55060108');
 assert.equal(slowSignal.aborted,true);
 await settleLookup();
 resolveSlow();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(input('کد ۱۰رقمی').props.value,'0010123456');
 assert.ok(nodes().some(node=>node.type==='details'));
 await send();
 assert.equal(posts[0].snapshot,'55060108activate');
 assert.equal(posts[0].deviceCode,'0010123456');
 assert.equal('reference' in posts[0],false);

 update(input('نوع درخواست'),'board');
 await settleLookup();
 assert.equal(input('کد ۱۰رقمی').props.value,'0010123456');
 await send();
 assert.equal(posts[1].purpose,'board');
 assert.equal('customer' in posts[1],false);

 update(input('نوع درخواست'),'activate');
 update(input('سریال روی بدنه'),'55061234');
 await settleLookup();
 assert.equal(input('کد پستی').props.required,false);
 assert.equal(input('محصول و مدل').props.readOnly,true);
 update(input('نام و نام خانوادگی'),'مشتری نمونه');
 await send();
 assert.equal(posts[2].customer.postalCode,'');
 assert.equal(posts[2].serial,'55061234');
 update(input('نوع درخواست'),'legacy-correction');
 await settleLookup();
 const chosen='2026-10-22';
 const dateField=()=>nodes().find(node=>node.props.label==='تاریخ شروع گارانتی');
 assert.equal(dateField().props.value,'');
 await send();
 assert.equal(posts.length,3,'requires an explicitly chosen day');
 dateField().props.onChange('2026-11-25');
 await send();
 assert.equal(posts.length,3,'blocks a future day');
 dateField().props.onChange(chosen);
 await send();
 assert.equal(posts[3].purpose,'legacy-correction');
 assert.equal(posts[3].warrantyStartDay,chosen);
 assert.equal(nodes().find(node=>node.props.record?.warrantyStartDay).props.record.warrantyStartDay,chosen);
 update(input('سریال روی بدنه'),'55060108');
 await settleLookup();
 assert.equal(dateField(),undefined);
 await send();
 assert.equal(posts.length,5,'issues a code for an existing activation');
 assert.equal(posts[4].purpose,'legacy-correction');
 assert.equal('warrantyStartDay' in posts[4],false,'never submit an editable date for a stored activation');
 assert.equal('customer' in posts[4],false);
 assert.equal(nodes().find(node=>node.type==='details').props.open,true);
 assert.equal(nodes().find(node=>node.props.showStoredStart).props.showStoredStart,'2026-11-03');
 console.log('PASS correction form: Persian date component, missing/future date, exact submitted day and immediate dossier.');
 console.log('PASS phone form: code-first order, stale lookup ignored, retained code, no reference field, board and first activation with optional postcode.');
})().catch(error=>{console.error(error);process.exitCode=1;});

function inputFrom(elements,label){
 return elements.find(node=>node.type==='label'&&String(node.props.children[0]).includes(label)).props.children.at(-1);
}
