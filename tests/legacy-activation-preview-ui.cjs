const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');

let slots=[],cursor=0,hasEvents=true,interrupt=true,reads=0;
const batches=[];
const headers=['activeId','activeDate','activeStatus','activeChannel','DeviceFullSerial','DeviceSetSerial','SetId','SetSerial','AgencyId','AgencyCode','AgencyName'];
const fixture=[headers,...Array.from({length:330},(_,i)=>[i+1,'2026-11-01T00:00:00.000Z',0,1,String(i+1),'','','',1,'',''])];
const hooks={
 ...React,useMemo:fn=>fn(),
 useRef(value){const i=cursor++;return slots[i]??={current:value};},
 useState(value){
  const i=cursor++;
  if(!(i in slots))slots[i]=value;
  return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];
 },
};
async function fetchPreview(url,options){
 if(!options.body)return Response.json({sales:[],links:[],hasEvents});
 const {mode,rows}=JSON.parse(options.body);
 assert.equal(mode,'preview');
 batches.push(rows[0].activeId);
 if(batches.length===2&&interrupt)return new Response('<!DOCTYPE html><html>',{status:503,headers:{'x-request-id':'abc-123'}});
 return Response.json({known:[]});
}
function load(relative){
 const file=path.resolve(__dirname,'..',relative);
 const {outputText}=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const exports={};
 const resolve=name=>{
  if(name==='react')return hooks;
  if(name==='read-excel-file/browser')return {readSheet:async()=>{reads++;return fixture;}};
  if(name==='@/lib/persian-date')return {formatDateTime:String};
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
  if(name.startsWith('./'))return load(path.resolve(path.dirname(file),name+'.ts'));
  return require(name);
 };
 vm.runInNewContext(outputText,{exports,require:resolve,fetch:fetchPreview,Date,Error,TypeError});
 return exports;
}
const {LegacyActivationPanel}=load('components/trace/legacy-activation-panel.tsx');
function nodes(){
 cursor=0;
 const tree=LegacyActivationPanel({accountId:'admin'});
 function walk(node){
  if(Array.isArray(node))return node.flatMap(walk);
  return node?.props?[node,...walk(node.props.children)]:[];
 }
 return walk(tree);
}
async function pick(){
 nodes().find(n=>n.type==='input'&&n.props.type==='file').props.onChange({currentTarget:{files:[{name:'sample.xlsx'}]}});
 await new Promise(resolve=>setImmediate(resolve));
}
(async()=>{
 await pick();
 const alert=nodes().find(n=>n.props.role==='alert');
 assert.match(alert.props.children,/503/);
 assert.match(alert.props.children,/abc-123/);
 assert.doesNotMatch(alert.props.children,/DOCTYPE/);
 assert.equal(nodes().some(n=>n.type==='h4'&&n.props.children==='پیش‌نمایش ورود سوابق'),false);
 const resume=nodes().find(n=>n.type==='button'&&String(n.props.children).includes('ادامهٔ بررسی'));
 interrupt=false;resume.props.onClick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(batches,['1','161','161','321']);
 assert.equal(reads,1);
 assert.ok(nodes().some(n=>n.type==='h4'&&n.props.children==='پیش‌نمایش ورود سوابق'));
 slots=[];batches.length=0;hasEvents=false;
 await pick();
 assert.equal(batches.length,0);
 assert.ok(nodes().some(n=>n.type==='h4'&&n.props.children==='پیش‌نمایش ورود سوابق'));
 console.log('PASS preview recovery from an HTML response, resume at failed batch, empty history fast path.');
})().catch(error=>{console.error(error);process.exitCode=1;});
