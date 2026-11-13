const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache={};
let record='record:one',heading='ورود انبار',controls=[];
class Control{
 constructor(label,value='',type='text',tag='INPUT'){this.tagName=tag;this.labels=[{textContent:label}];this.name='';this.id='react-generated-id';this.autocomplete='';this.type=type;this._value=value;this.checked=false;this.disabled=false;this.readOnly=false;this.events=[];this.attrs={type};}
 getAttribute(k){return this.attrs[k]||null}closest(){return this.noPair?{}:null}
 get value(){return this._value}set value(v){this._value=v}
 dispatchEvent(e){this.events.push(e.type);return true}click(){this.checked=!this.checked;this.events.push('click')}
}
class Input extends Control{}
class Textarea extends Control{constructor(label,value=''){super(label,value,'text','TEXTAREA')}}
class Select extends Control{constructor(label,value=''){super(label,value,'select','SELECT');this.options=[];this.multiple=false}}
for(const cls of [Input,Textarea,Select])Object.defineProperty(cls.prototype,'value',Object.getOwnPropertyDescriptor(Control.prototype,'value'));
const doc={querySelectorAll(s){if(s==='[data-pair-record]')return [{getAttribute:()=>record}];if(s.includes('h1,'))return [{textContent:heading,closest:()=>null}];if(s==='[role="dialog"]')return [];return controls;}};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>n.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(file),n+'.ts'))):require(n),document:doc,HTMLInputElement:Input,HTMLTextAreaElement:Textarea,HTMLSelectElement:Select,Event,crypto:globalThis.crypto,TextEncoder,Uint8Array,Map,Set,URL,JSON,Array,console},{filename:file});return exports;}
const dom=load('lib/shared-form-dom.ts');
(async()=>{
const name=new Input('نام تحویل‌دهنده','A'),secret=new Input('رمز عبور','s','password'),hidden=new Input('شناسه','id','hidden'),file=new Input('رسید','','file'),pairUI=new Input('پیوند اتصال');pairUI.noPair=true;
assert.equal(dom.shareableControl(name),true);for(const c of [secret,hidden,file,pairUI])assert.equal(dom.shareableControl(c),false);
assert.equal(dom.shareableControl(new Input('API token','secret')),false);assert.equal(dom.shareableControl(new Input('تأیید تحویل فیزیکی',false,'checkbox')),false);
controls=[name,secret,hidden,file,pairUI];assert.equal(dom.sharedControls().length,1);
let a=await dom.controlKeys([name],'work-one'),first=[...a.keys()][0];name.id='different-generated-react-id';let b=await dom.controlKeys([name],'work-one');assert.equal([...b.keys()][0],first);
record='record:two';b=await dom.controlKeys([name],'work-one');assert.notEqual([...b.keys()][0],first,'same labels cannot address a different record');record='record:one';b=await dom.controlKeys([name],'work-two');assert.notEqual([...b.keys()][0],first,'work routing is part of identity');
b=await dom.controlKeys([name,new Input('تعداد','1')],'work-one');assert.notEqual([...b.keys()][0],first,'dynamic row/schema changes do not reuse positional keys');
dom.applySharedValue(name,'B');assert.equal(name.value,'B');assert.deepEqual(name.events,['input','change']);dom.applySharedValue(name,'B');assert.equal(name.events.length,2,'unchanged replay does not emit another edit');name.disabled=true;dom.applySharedValue(name,'C');assert.equal(name.value,'B');
const notes=new Textarea('توضیحات','');dom.applySharedValue(notes,'شرح');assert.equal(notes.value,'شرح');
const choice=new Input('انتخاب قطعه',false,'checkbox');dom.applySharedValue(choice,true);assert.equal(choice.checked,true);assert.equal(choice.events.filter(e=>e==='click').length,1);dom.applySharedValue(choice,true);assert.equal(choice.events.length,1);
const select=new Select('مدل','one');dom.applySharedValue(select,'two');assert.equal(select.value,'two');assert.deepEqual(select.events,['change']);
console.log('PASS shared form adapter: password/file/local controls excluded, stable typed keys, record/work/schema isolation, input/select/checkbox/textarea replay, no repeated events or disabled-control edits');
})().catch(e=>{console.error(e);process.exitCode=1});
