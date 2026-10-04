const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('components/trace/assistant-actions.tsx','utf8');
let slots=[],cursor=0;const exportsObject={};
const jsx=(type,props)=>({type,props});
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require:n=>n==='react'?{useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useEffect:()=>{}}:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:{}});
function elements(node){if(!node)return [];if(Array.isArray(node))return node.flatMap(elements);if(typeof node!=='object')return [];return [node,...elements(node.props?.children)]}
let result=false,calls=[];
const action={id:'test',title:'create',tool:'create_password_user',state:'pending',args:{},section:'users'};
function render(){cursor=0;return elements(exportsObject.ActionCards({actions:[action],busy:false,onDecide:async(...args)=>{calls.push(args);return result},onOpen:()=>{}}))}
(async()=>{
let nodes=render();nodes.find(n=>n.type==='input').props.onChange({target:{value:'Exact Pass-123!'}});
nodes=render();await nodes.find(n=>n.type==='button'&&n.props.children==='تأیید و اجرا').props.onClick();
assert.deepEqual(calls[0],['test','confirm','Exact Pass-123!']);
assert.equal(render().find(n=>n.type==='input').props.value,'Exact Pass-123!','failed request must retain password');
result=true;await render().find(n=>n.type==='button'&&n.props.children==='تأیید و اجرا').props.onClick();
assert.equal(render().find(n=>n.type==='input').props.value,'','success clears secret');
await render().find(n=>n.type==='button'&&n.props.children==='لغو').props.onClick();
assert.equal(render().filter(n=>n.type==='article').length,0,'successful cancellation dismisses card');
slots=[];action.state='cancelled';render().find(n=>n.props['aria-label']==='بستن کارت نتیجه').props.onClick();
assert.equal(render().filter(n=>n.type==='article').length,0);
const chat=fs.readFileSync('components/trace/assistant-chat.tsx','utf8');assert.match(chat,/onDecide=\{decide\}/,'parent must forward password and promise directly');
console.log('PASS: password forwarding, failed-submit preservation, success clearing, cancel and result dismissal');
})().catch(e=>{console.error(e);process.exitCode=1});
