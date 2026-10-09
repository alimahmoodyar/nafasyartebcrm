const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=(type,props)=>({type,props});
let slots=[],cursor=0,effects=[],handlers={},state;
const nav={onLine:true,userAgent:'Android',platform:'Linux',maxTouchPoints:1};
const win={isSecureContext:true,location:{origin:'https://company.test'},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),addEventListener:(n,f)=>handlers[n]=f,removeEventListener(){}};
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/trace/mobile-app.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,window:win,navigator:nav,require:n=>n==='react'?{createContext:()=>({Provider:'provider'}),useContext:()=>state,useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:init=>{const i=cursor++;return slots[i]??(slots[i]={current:init})},useEffect:(f,deps)=>{const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(f)}}}:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:{}});
function provider(){cursor=0;state=out.MobileAppProvider({children:null}).props.value;return state}
function nodes(n){if(!n)return[];if(Array.isArray(n))return n.flatMap(nodes);if(typeof n!=='object')return[];return[n,...nodes(n.props?.children)]}
(async()=>{
provider();effects.splice(0).forEach(f=>f());assert.equal(await provider().install(),false);assert.match(provider().message,/مرورگر/);
let prompts=0;handlers.beforeinstallprompt({preventDefault(){},prompt:async()=>{prompts++},userChoice:Promise.resolve({outcome:'dismissed'})});assert.equal(provider().ready,true);assert.equal(await provider().install(),false);assert.equal(prompts,1);assert.equal(provider().ready,false);assert.equal(provider().installing,false);await provider().install();assert.equal(prompts,1,'install event may only be consumed once');
handlers.beforeinstallprompt({preventDefault(){},prompt:async()=>{throw Error('denied')},userChoice:Promise.resolve({outcome:'accepted'})});assert.equal(await provider().install(),false);assert.equal(provider().installing,false);assert.match(provider().message,/باز نشد/);
nav.onLine=false;assert.equal(await provider().install(),false);assert.match(provider().message,/اینترنت/);nav.onLine=true;
win.isSecureContext=false;assert.equal(await provider().install(),false);assert.match(provider().message,/HTTPS/);win.isSecureContext=true;
handlers.appinstalled();assert.equal(provider().installed,true);
slots=[];cursor=0;state={ready:false,installed:false,online:true,secure:true,workerError:false,installing:false,message:'',install:async()=>false};
let tree=nodes(out.MobileInstall());const button=tree.find(n=>n.type==='button'&&n.props.className==='btn primary');assert.equal(button.props.disabled,false,'fallback must remain clickable without browser event');await button.props.onClick();cursor=0;tree=nodes(out.MobileInstall());assert.ok(tree.some(n=>n.props.id==='mobile-install-guide'),'fallback opens actual instructions');
slots=[];cursor=0;tree=nodes(out.MobileInstall({iphoneTest:true}));assert.ok(tree.some(n=>n.props.id==='mobile-install-guide'),'iPhone test route opens instructions immediately');assert.ok(tree.some(n=>n.props['aria-label']==='وضعیت تست آیفون'));slots=[];cursor=0;tree=nodes(out.MobileInstall());assert.ok(tree.some(n=>n.type==='a'&&n.props.href==='/install/iphone'),'normal install page links to dedicated iPhone test');
console.log('PASS: no-event fallback, cancellation, prompt error, offline/HTTP feedback, installed state and clickable installation guide');
})().catch(e=>{console.error(e);process.exitCode=1});
