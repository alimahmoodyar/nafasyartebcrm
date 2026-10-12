const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let slots=[],cursor=0,changes=[],reply;
const state=init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},ref=init=>{const i=cursor++;return slots[i]??={current:init}};
const jsx=(type,props)=>({type,props}),out={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/trace/assistant-chat.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,crypto:require('node:crypto').webcrypto,fetch:async url=>({ok:true,status:200,json:async()=>url==='/api/session'?{userId:'staff'}:reply}),require:n=>n==='react'?{useState:state,useRef:ref,useEffect:()=>{}}:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='./use-assistant-position'?{useAssistantPosition:()=>({consumeDrag:()=>false})}:new Proxy({},{get:(_,k)=>k})});
const flatten=x=>Array.isArray(x)?x.flatMap(flatten):x&&typeof x==='object'?[x,...flatten(x.props?.children)]:[];
const workspace={tool:'sales_apply',args:{mode:'agent',agentId:''},section:'sales',title:'Old creation form',schema:{}};
const render=()=>{cursor=0;return flatten(out.AssistantChat({admin:false,accountId:'staff',accountName:'Staff',workspace,onWorkspace:form=>changes.push(form),onSettings(){},onAccountChanged(){throw Error('Wrong account')},onNavigate(){},onMutation(){}}))};
(async()=>{
 render();slots[0]=true;slots[3]='model';slots[4]='خریدار باید تخصیص داده شود کجا برم؟';reply={accountId:'staff',answer:'مدیر فروش: فروش ← تخصیص خریدار به کارشناس',workspace:null,actions:[],navigation:'sales'};
 render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.deepEqual(changes,[null],'Explicit assignment help clears stale representative creation form');
 changes=[];slots[4]='ادامه توضیح بده';reply={accountId:'staff',answer:'Explanation without replacing the draft',actions:[]};render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.deepEqual(changes,[],'Ordinary replies keep an existing partial form');
 console.log('PASS assistant assignment help UI: explicit clearing of stale creation form, same-account response and preservation of ordinary partial drafts.');
})().catch(e=>{console.error(e);process.exitCode=1});
