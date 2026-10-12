const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..'),cache={},values=new Map();let slots=[],cursor=0,effects=[];
const changed=(previous,next)=>!previous||next.some((value,i)=>value!==previous[i]);
const react={...React,useContext:context=>values.has(context)?values.get(context):context._currentValue,useRef:value=>{const i=cursor++;return slots[i]||(slots[i]={current:value})},useState:value=>{const i=cursor++,bucket=slots;if(!(i in bucket))bucket[i]=typeof value==='function'?value():value;return[bucket[i],next=>bucket[i]=typeof next==='function'?next(bucket[i]):next]},useCallback:(callback,deps)=>{const i=cursor++;if(!slots[i]||changed(slots[i].deps,deps))slots[i]={callback,deps};return slots[i].callback},useMemo:fn=>fn(),useLayoutEffect:(fn,deps)=>{const i=cursor++,bucket=slots,old=bucket[i];if(!old||changed(old.deps,deps))effects.push(()=>{old?.cleanup?.();bucket[i]={deps,cleanup:fn()}})},useEffect(){}};
function load(relative){const file=path.resolve(root,relative);if(cache[file])return cache[file];const output={};cache[file]=output;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:output,require:name=>{if(name==='react')return react;if(name==='react/jsx-runtime')return require(name);if(name==='lucide-react')return new Proxy({},{get:()=>()=>null});if(name==='react-dom')return{createPortal:()=>null};if(name==='./personal-home')return{PersonalHome:()=>null};if(name.startsWith('@/'))return load(name.slice(2)+'.ts');return require(name)},window:{getComputedStyle:()=>({visibility:'visible'})},Map,Set,console},{filename:file});return output;}
const {LayoutAccountProvider,useWorkspaceBack,useWorkspaceModalBack}=load('components/trace/program-workspace.tsx'),{currentWorkspaceBack}=load('lib/workspace-back.ts');
let rootBack=0;
cursor=0;const provider=LayoutAccountProvider({accountId:'test',onBack:()=>rootBack++,children:null});
let current=provider,registry;
while(React.isValidElement(current)){values.set(current.type,current.props.value);if(current.props.value?.entries instanceof Map)registry=current.props.value;current=current.props.children;}
assert.ok(registry);
let invalidated=0;const invalidate=registry.invalidate;registry.invalidate=()=>{invalidated++;invalidate()};
const node={isConnected:true,getClientRects:()=>[{}],closest:()=>null,parentElement:null,contains:other=>other===node};
const hookSlots=[],calls=[];
function render(handler,enabled=true){slots=hookSlots;cursor=0;return useWorkspaceBack(handler,enabled)}
function flush(){effects.splice(0).forEach(effect=>effect())}
const first=render(()=>calls.push('first'));flush();assert.equal(registry.entries.size,1);assert.equal(currentWorkspaceBack([...registry.entries.values()]),undefined,'a registered step waits for its actual DOM mount');
first(node);assert.equal(invalidated,1,'a delayed portal ref attachment must notify the header registry');assert.ok(currentWorkspaceBack([...registry.entries.values()]));registry.run();assert.deepEqual(calls,['first']);
first(node);assert.equal(invalidated,1,'the same DOM ref must not trigger a rerender loop');
const second=render(()=>calls.push('latest'));flush();assert.equal(second,first,'a handler update retains its DOM ref');assert.equal(registry.entries.size,1,'updating the handler does not duplicate its registration');registry.run();assert.deepEqual(calls,['first','latest'],'registered back invokes the newest controlled-state handler');
second(null);assert.equal(invalidated,2,'delayed portal unmount must also notify the header');assert.equal(currentWorkspaceBack([...registry.entries.values()]),undefined);registry.run();assert.equal(rootBack,1);
render(()=>calls.push('disabled'),false);flush();assert.equal(registry.entries.size,0,'disabled or closed views unregister their callback');
slots=[];cursor=0;const modal=useWorkspaceModalBack(()=>calls.push('modal'));flush();assert.equal(modal.scoped,true);assert.equal(currentWorkspaceBack([...registry.entries.values()]),undefined);modal.ref(node);assert.equal(invalidated,3);const modalEntry=currentWorkspaceBack([...registry.entries.values()]);assert.equal(modalEntry.modal,true);registry.run();assert.equal(calls.at(-1),'modal');modal.ref(null);assert.equal(invalidated,4);
console.log('PASS React back registration: delayed DOM/portal attach and detach notify the header; stable ref prevents loops; latest controlled callback is used; disabled view unregisters; modal ref follows the same lifecycle.');
