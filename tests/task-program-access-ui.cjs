const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../components/trace/tasks-panel.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function render(data,tab='mine'){
 let state=0,mounts=0;const effects=[],values=[data,tab,null,'',false,'',[],false,'','all'],exports={};
 const children=({children})=>React.createElement('div',null,children),empty=()=>null;
 vm.runInNewContext(source,{exports,require:n=>{
  if(n==='react')return {...React,useState:initial=>[state<values.length?values[state++]:initial,()=>{}],useEffect:fn=>effects.push(fn)};
  if(n==='react/jsx-runtime')return require(n);
  if(n==='./program-workspace')return {ProgramWorkspace:children,IconActions:children,IconDisclosure:children,SubprogramNavigation:({items})=>React.createElement('nav',null,items.map(([id,title])=>React.createElement('button',{key:id,'data-program':id},title)))};
  if(n==='./purchase-services-panel')return {PurchaseServicesPanel:()=>{mounts++;return React.createElement('section',null,'Service workspace')}};
  if(n==='./inbox-panel')return {InboxPanel:empty};if(n==='./workflow-guide')return {WorkflowGuide:empty};
  if(n==='./solar-date')return {SolarDate:empty};if(n==='@/components/trace/number-input')return {NumberInput:empty};
  if(n==='@/lib/persian-date')return {formatDateTime:s=>s};if(n==='@/lib/serials')return {tehranDay:()=> '2026-10-12'};
  if(n.startsWith('@/components/ui/'))return new Proxy({},{get:()=>children});throw Error(n);
 },Date,Intl,console},{filename:'tasks-panel.tsx'});
 const html=renderToStaticMarkup(React.createElement(exports.TasksPanel,{demo:false,onNavigate:()=>{}}));return {html,mounts};
}
const base={memberId:'me',isAdmin:false,tasks:[],notifications:[],definitions:[],ownPositions:[]};
for(const capability of [false,undefined]){const r=render({...base,canPurchaseServices:capability},'purchase-services');assert.ok(!r.html.includes('data-program="purchase-services"'));assert.equal(r.mounts,0);for(const key of ['inbox','mine','review','history'])assert.ok(r.html.includes('data-program="'+key+'"'));assert.ok(!r.html.includes('data-program="management"'));}
let r=render({...base,canPurchaseServices:true},'purchase-services');assert.ok(r.html.includes('data-program="purchase-services"'));assert.equal(r.mounts,1);
r=render({...base,isAdmin:true,canPurchaseServices:true});for(const key of ['purchase-services','management','definitions'])assert.ok(r.html.includes('data-program="'+key+'"'));
r=render(null,'purchase-services');assert.equal(r.mounts,0);assert.ok(!r.html.includes('data-program="purchase-services"'));
console.log('PASS task UI: irrelevant/loading icons hidden, stale selection cannot mount service workspace, allowed receiver/purchase navigation and administrator tools preserved.');
