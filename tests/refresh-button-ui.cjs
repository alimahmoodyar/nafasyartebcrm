const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
let slots=[],cursor=0,effects=[],timers=new Map(),sequence=0,now=10000,hidden=false,editors=[],calls=0;
const listeners={window:new Map(),document:new Map()};
const events=scope=>({addEventListener:(name,fn)=>listeners[scope].set(name,fn),removeEventListener:(name,fn)=>{if(listeners[scope].get(name)===fn)listeners[scope].delete(name)}});
const document={...events('document'),visibilityState:'visible',querySelectorAll:()=>editors};
const react={...React,useRef:value=>{const i=cursor++;return slots[i]||(slots[i]={current:value})},useState:value=>{const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],v=>slots[i]=v]},useEffect:fn=>{const i=cursor++;if(!slots[i]){slots[i]=true;effects.push(fn)}}};
const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/trace/refresh-button.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:output,require:n=>n==='react'?react:n==='react/jsx-runtime'?require(n):{RefreshCw:()=>null},window:events('window'),document,Date:{now:()=>now},setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)});
let props={onRefresh:async()=>{calls++}},cleanup;
const anchor={closest:()=>hidden?{}:null,getClientRects:()=>hidden?[]:[{}]};
function render(){cursor=0;const tree=output.RefreshButton(props);tree.props.ref.current=anchor;return tree}
const settle=async()=>{await Promise.resolve();await Promise.resolve()};
async function flush(){now+=2000;const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());await settle()}
function emit(scope,name){listeners[scope].get(name)?.()}
(async()=>{
 render();cleanup=effects.shift()();assert.equal(calls,0,'Mount must not duplicate the page entry load');
 emit('window','focus');emit('document','visibilitychange');assert.equal(timers.size,1);await flush();assert.equal(calls,1,'Returning to an idle page refreshes once');
 editors=[{getClientRects:()=>[{}]}];emit('window','focus');await flush();assert.equal(calls,1,'Visible forms/dialogs preserve unsaved edits');
 editors=[];hidden=true;emit('window','focus');await flush();assert.equal(calls,1,'Hidden menu pages do not fetch');hidden=false;
 document.visibilityState='hidden';emit('document','visibilitychange');await flush();assert.equal(calls,1);document.visibilityState='visible';
 props={...props,disabled:true};render();emit('window','focus');await flush();assert.equal(calls,1,'Busy page cannot refresh');
 let complete;props={onRefresh:()=>{calls++;return new Promise(resolve=>complete=resolve)}};render();emit('window','focus');await flush();assert.equal(calls,2);assert.equal(render().props.disabled,true);
 emit('window','focus');await flush();render().props.onClick();assert.equal(calls,2,'Manual/automatic refreshes cannot overlap');complete();await settle();assert.equal(render().props.disabled,false);
 props={onRefresh:async()=>{throw Error('offline')}};render().props.onClick();await settle();assert.equal(render().props['aria-label'],'تلاش دوباره');
 props={onRefresh:async()=>{calls++}};render().props.onClick();await settle();assert.equal(calls,3);assert.equal(render().props['aria-label'],'تازه‌سازی اطلاعات','Latest callback is used and retry recovers');
 emit('window','focus');cleanup();assert.equal(timers.size,0);assert.equal(listeners.window.size,0);assert.equal(listeners.document.size,0,'Unmount removes refresh listeners');
 console.log('PASS refresh: no duplicate entry fetch, debounced focus/visibility, hidden/background/busy and editor guards, no overlapping calls, retry recovery, latest callback and cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
