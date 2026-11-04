const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('components/trace/assistant-actions.tsx','utf8');
let slots=[],cursor=0;const exportsObject={};
const jsx=(type,props)=>({type,props});
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require:n=>n==='react'?{useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useEffect:()=>{}}:n==='@/components/trace/number-input'?{NumberInput:'input'}:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='@/lib/assistant-form-presentation'?{formPresentation:(_t,_a,schema,title)=>({schema,title}),fieldTitle:(_t,k)=>k,displayedValue:(_t,_p,v)=>v}:{}});
function elements(node){if(!node)return [];if(Array.isArray(node))return node.flatMap(elements);if(typeof node!=='object')return [];return [node,...elements(node.props?.children)]}
let result=false,calls=[],activeId=null,dismissals=[],tree;
const action={id:'test',title:'create',tool:'create_password_user',state:'pending',args:{},section:'users'};
function render(){cursor=0;tree=exportsObject.ActionCards({actions:[action],activeActionId:activeId,onDismiss:id=>dismissals.push(id),busy:false,onDecide:async(...args)=>{calls.push(args);return result},onOpen:()=>{}});return elements(tree)}
(async()=>{
let nodes=render();nodes.find(n=>n.type==='input').props.onChange({target:{value:'Exact Pass-123!'}});
nodes=render();await nodes.find(n=>n.type==='button'&&n.props.children==='تأیید و اجرا').props.onClick();
assert.deepEqual(calls[0],['test','confirm','Exact Pass-123!']);
assert.equal(render().find(n=>n.type==='input').props.value,'Exact Pass-123!','failed request must retain password');
result=true;await render().find(n=>n.type==='button'&&n.props.children==='تأیید و اجرا').props.onClick();
assert.equal(render().find(n=>n.type==='input').props.value,'','success clears secret');
await render().find(n=>n.type==='button'&&n.props.children==='لغو').props.onClick();
assert.equal(render().filter(n=>n.type==='article').length,0,'successful cancellation dismisses card');
for(const state of ['succeeded','cancelled','expired']){
 slots=[];action.state=state;
 assert.equal(render().filter(n=>n.type==='article').length,0,'terminal card hidden on fresh mount: '+state);
 slots=[];assert.equal(render().filter(n=>n.type==='article').length,0,'terminal card stays hidden after reload: '+state);
}
for(const state of ['pending','running','review']){
 slots=[];action.state=state;
 render();assert.equal(elements(tree.props.children[0]).filter(n=>n.type==='article').length,state==='pending'?1:0,'Only pending approval is pinned on fresh mount: '+state);if(state!=='pending'){const history=elements(tree).find(n=>n.type==='details'&&n.props.className==='assistant-action-history');assert.ok(history);assert.equal(history.props.open,undefined,'Old uncertain results load collapsed');}
}
slots=[];activeId=action.id;action.state='review';action.result={error:'کد ملی مسئول نمایندگی باید ۱۰ رقم باشد'};render();assert.equal(elements(tree.props.children[0]).filter(n=>n.type==='article').length,1,'Newly reviewed result is initially visible');const beforeDismiss=calls.length;render().find(n=>n.props?.['aria-label']==='بستن کارت نتیجه').props.onClick();render();assert.equal(elements(tree.props.children[0]).filter(n=>n.type==='article').length,0);assert.equal(calls.length,beforeDismiss,'Closing review never cancels, confirms or retries the operation');assert.equal(action.state,'review');assert.deepEqual(dismissals,[action.id]);assert.ok(elements(tree).some(n=>n.type==='details'&&n.props.className==='assistant-action-history'),'Dismissed result remains in inspectable history');
slots=[];activeId=null;render();assert.equal(elements(tree.props.children[0]).filter(n=>n.type==='article').length,0,'Server returning the same review after refresh cannot repin it');assert.ok(elements(tree).some(n=>n.props?.children==='کد ملی مسئول نمایندگی باید ۱۰ رقم باشد'),'Actual error is preserved');
action.state='succeeded';assert.equal(render().filter(n=>n.type==='article').length,0,'completion closes card without remount');
const chat=fs.readFileSync('components/trace/assistant-chat.tsx','utf8');assert.match(chat,/onDecide=\{decide\}/,'parent must forward password and promise directly');
console.log('PASS: password forwarding, failed-submit preservation, success clearing, cancel and result dismissal');
})().catch(e=>{console.error(e);process.exitCode=1});
