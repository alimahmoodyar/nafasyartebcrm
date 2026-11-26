const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const assert=require('node:assert/strict');
const React=require('react');

let slots=[],cursor=0,effects=[],authCalls=0,loginCalls=0,registrationCalls=0;
let mounted=false,optionsFail=true,loginNeedsTap=false;
const requests=[];
const react={
 ...React,
 useState(initial){
  const index=cursor++;
  if(!(index in slots))slots[index]=initial;
  return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];
 },
 useEffect(effect){if(!mounted)effects.push(effect);},
};
const webauthn={
 browserSupportsWebAuthn:()=>true,
 platformAuthenticatorIsAvailable:async()=>true,
 startAuthentication(){
  authCalls++;
  if(loginNeedsTap){
   loginNeedsTap=false;
   throw new Error('WebAuthn denied',{cause:new DOMException('User gesture required','NotAllowedError')});
  }
  return {id:'signed-in'};
 },
 startRegistration(){registrationCalls++;return {id:'new-device'};},
};
const out={};
const source=ts.transpileModule(fs.readFileSync('components/trace/passkeys.tsx','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
vm.runInNewContext(source,{
 exports:out,Error,DOMException,
 require(name){
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return require(name);
  if(name==='@simplewebauthn/browser')return webauthn;
  return {notifyAccountChange(){}};
 },
 window:{isSecureContext:true,location:{hostname:'test.local'}},
 async fetch(url,options){
  assert.equal(url,'/api/auth/passkeys');
  const body=options.body?JSON.parse(options.body):null;
  requests.push(body?.mode||'list');
  if(!body)return Response.json({keys:[]});
  if(body.mode==='login_options'&&optionsFail)
   return Response.json({error:'زیرساخت ورود آماده نیست.',reference:'test-incident'},{status:503});
  if(body.mode.endsWith('_options'))return Response.json({options:{challenge:'synthetic-challenge'}});
  if(body.mode==='register_verify')assert.equal(body.response.id,'new-device');
  return Response.json({saved:true});
 },
});

const nodes=value=>Array.isArray(value)?value.flatMap(nodes):React.isValidElement(value)?[value,...nodes(value.props.children)]:[];
const text=value=>Array.isArray(value)?value.map(text).join(''):React.isValidElement(value)?text(value.props.children):value==null?'':String(value);
const button=(tree,pattern)=>{
 const found=nodes(tree).find(element=>element.type==='button'&&pattern.test(text(element)));
 assert.ok(found,pattern.toString());
 return found;
};
function render(component,props={}){cursor=0;return component(props);}
function mount(component,props={}){
 slots=[];mounted=false;effects=[];
 render(component,props);mounted=true;effects.splice(0).forEach(effect=>effect());
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

(async()=>{
 const loginProps={onLogin:()=>loginCalls++};
 const login=()=>render(out.PasskeyLogin,loginProps);
 mount(out.PasskeyLogin,loginProps);
 await button(login(),/فیس‌آیدی/).props.onClick();
 assert.deepEqual(requests,['login_options']);
 assert.equal(authCalls,0);
 assert.equal(loginCalls,0);
 assert.match(text(login()),/test-incident/);
 assert.ok(nodes(login()).some(element=>element.props.role==='alert'));
 assert.equal(button(login(),/فیس‌آیدی/).props.disabled,false);

 optionsFail=false;loginNeedsTap=true;requests.length=0;
 await button(login(),/فیس‌آیدی/).props.onClick();
 assert.equal(loginCalls,0);
 await button(login(),/تأیید ورود روی همین گوشی/).props.onClick();
 assert.deepEqual(requests,['login_options','login_verify']);
 assert.equal(loginCalls,1);

 requests.length=0;
 mount(out.PasskeySettings);
 const settings=()=>render(out.PasskeySettings);
 assert.equal(button(settings(),/فیس‌آیدی/).props['aria-expanded'],false);
 assert.equal(requests.length,0);
 button(settings(),/فیس‌آیدی/).props.onClick();
 const setupComponent=nodes(settings()).find(element=>typeof element.type==='function').type;
 const setup=()=>render(setupComponent);
 mount(setupComponent);
 await flush();
 nodes(setup()).find(element=>element.type==='input').props.onChange({target:{value:'fake-password'}});
 await button(setup(),/آماده‌سازی/).props.onClick();
 assert.equal(registrationCalls,0);
 assert.deepEqual(requests,['list','register_options']);
 const activation=button(setup(),/تأیید روی همین گوشی/).props.onClick();
 assert.equal(registrationCalls,1,'The explicit tap opens the device prompt immediately.');
 await activation;
 assert.deepEqual(requests,['list','register_options','register_verify','list']);
 assert.match(text(setup()),/ورود با گوشی فعال شد/);
 console.log('Passkey UI passed: closed settings, server error, direct confirmation tap, login retry and verified setup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
