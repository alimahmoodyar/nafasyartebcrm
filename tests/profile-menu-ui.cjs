const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const React=require('react');
const ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server');

let state=[],index=0;
const accountId='local:bootstrap-local-admin';
const profile={accountId,revision:1,hasPhoto:true,authType:'password',username:'admin'};
const react={
 ...React,
 useEffect(){},
 useRef(value){return {current:value};},
 useState(value){
  const slot=index++;
  if(!(slot in state))state[slot]=value;
  return [state[slot],next=>{state[slot]=typeof next==='function'?next(state[slot]):next;}];
 },
};
const form=(name)=>()=>React.createElement('form',{name});
const deps={
 react,
 'react/jsx-runtime':require('react/jsx-runtime'),
 'lucide-react':{Camera:()=>null,X:()=>null},
 '@/components/ui/dialog':{},
 '@/lib/profile-photo':{},
 './account-credentials':{AccountCredentials:form('credentials')},
 './password-recovery':{RecoverySettings:form('recovery')},
 './passkeys':{PasskeySettings:()=>React.createElement('button',null,'ورود با فیس‌آیدی یا اثر انگشت')},
 './profile-photo-editor':{},
};
const source=ts.transpileModule(fs.readFileSync('components/trace/user-profile.tsx','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},
}).outputText;
const exportsObject={};
vm.runInNewContext(source,{
 exports:exportsObject,fetch:async()=>Response.json(profile),AbortController,
 require(name){assert.ok(deps[name],'Unexpected profile dependency '+name);return deps[name];},
});
const {UserProfile}=exportsObject;
const props={accountId,name:'مدیر سامانه',onAssets(){},onPersonnel(){}};
function render(){index=0;return UserProfile(props);}
function nodes(item){
 if(Array.isArray(item))return item.flatMap(nodes);
 return React.isValidElement(item)?[item,...nodes(item.props.children)]:[];
}
function button(tree,name){return nodes(tree).find(item=>item.type==='button'&&item.props['aria-label']===name);}

(async()=>{
 button(render(),'پروفایل من').props.onClick();
 await new Promise(resolve=>setImmediate(resolve));
 index=0;
 const markup=renderToStaticMarkup(React.createElement(UserProfile,props));
 const photoMenu=markup.match(/<details>(.*?)<\/details>/)?.[1];
 assert.match(photoMenu,/مدیریت عکس/);
 for(const text of ['جایگزینی عکس','ویرایش عکس','حذف عکس'])assert.match(photoMenu,new RegExp(text));
 assert.match(markup,/تغییر رمز و نام کاربری/);
 assert.match(markup,/بازیابی رمز عبور/);
 assert.match(markup,/ورود با فیس‌آیدی یا اثر انگشت/);
 assert.doesNotMatch(markup,/<form|اتصال حساب من به بله/);

 const credentials=nodes(render()).find(item=>item.type.name==='ProfileCredentials');
 const draw=()=>{index=20;return credentials.type(credentials.props);};
 assert.equal(nodes(draw()).find(item=>item.type==='button').props['aria-expanded'],false);
 nodes(draw()).find(item=>item.type==='button').props.onClick();
 assert.match(renderToStaticMarkup(draw()),/<form name="credentials"/);
 console.log('Profile menu passed: administrator gets one photo menu, collapsed settings and a password form only on demand.');
})().catch(error=>{console.error(error);process.exitCode=1;});
