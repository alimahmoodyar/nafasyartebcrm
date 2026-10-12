const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../lib/workspace-back.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,window:{getComputedStyle:node=>({visibility:node.visibility||'visible'})}});
const {currentWorkspaceBack,visibleWorkspaceBack}=exportsObject;
function node(parent=null,extra={}){return{parentElement:parent,isConnected:true,hidden:false,ariaHidden:false,closed:false,visibility:'visible',rects:[{}],getClientRects(){return this.rects},closest(){for(let current=this;current;current=current.parentElement)if(current.hidden||current.ariaHidden||current.closed)return current;return null},contains(other){for(let current=other;current;current=current.parentElement)if(current===this)return true;return false},...extra};}
let order=0;
function entry(element,priority=100,modal=false,handler=()=>{}){return{element:()=>element,priority,modal,handler,order:++order};}
const page=node(),menu=node(page),detail=node(menu),deep=node(detail),hiddenBranch=node(page,{hidden:true}),hiddenDetail=node(hiddenBranch),outside=node(page);
const parent=entry(menu),child=entry(detail),deepChild=entry(deep);
assert.equal(currentWorkspaceBack([parent,child,deepChild]),deepChild,'deepest active workspace must return locally before its parents');
assert.equal(currentWorkspaceBack([deepChild,entry(hiddenDetail,9999)]),deepChild,'mounted hidden workspaces cannot take back navigation');
for(const invisible of [null,node(page,{isConnected:false}),node(page,{rects:[]}),node(page,{ariaHidden:true}),node(page,{closed:true}),node(page,{visibility:'hidden'})]){const stale=entry(invisible,9999);assert.equal(visibleWorkspaceBack(stale),false);assert.equal(currentWorkspaceBack([stale,child]),child);}
const highPriority=entry(menu,200);assert.equal(currentWorkspaceBack([deepChild,highPriority]),highPriority,'explicit local state priorities can override nesting depth');
const first=entry(detail),last=entry(detail);assert.equal(currentWorkspaceBack([last,first]),last,'latest equally deep handler wins independently of input order');
const modalShell=node(page),modal=entry(modalShell,1000,true),modalChild=entry(node(modalShell),100),unrelated=entry(outside,5000);
assert.equal(currentWorkspaceBack([parent,modal,unrelated]),modal,'visible modal closes before navigation outside its focus scope');
assert.equal(currentWorkspaceBack([modal,modalChild,unrelated]),modalChild,'a nested dialog view returns before closing its containing dialog');
const innerModal=entry(node(modalShell),1000,true);assert.equal(currentWorkspaceBack([modal,innerModal,modalChild]),innerModal,'nested modal closes before its outer modal');
modalShell.closed=true;assert.equal(currentWorkspaceBack([parent,modal,modalChild,innerModal,unrelated]),unrelated,'closed modal registrations cannot trap ordinary navigation');
assert.equal(currentWorkspaceBack([]),undefined);
let navigated=0,blocked=0;
const blockedEntry=entry(detail,200,false,()=>blocked++),rootEntry=entry(page,100,false,()=>navigated++);
currentWorkspaceBack([rootEntry,blockedEntry]).handler();assert.equal(blocked,1);assert.equal(navigated,0,'a protected busy view consumes back without falling through to its parent');
console.log('PASS workspace back: visible depth, explicit priority, stable latest entry, hidden/disconnected/closed views ignored, modal focus scope, nested modal/view order, and busy handler prevents parent fall-through.');
