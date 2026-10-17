const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
let slots=[],cursor=0,changes=[];
const react={...React,useId:()=> 'materials',useRef:()=>({current:null}),useEffect:()=>{},useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]}};
const exports_={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/trace/material-select.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:exports_,require:n=>n==='react'?react:n==='lucide-react'?{ChevronDown:()=>null,Check:()=>null}:require(n)});
const {MaterialSelect,searchMaterials}=exports_,choices=[{id:'a',code:'20100040',name:'کاور پلاستیکی'},{id:'b',code:'29292929',name:'شیر'},{id:'c',code:'FILTER-32',name:'فیلتر کمپرسور'}];
assert.equal(searchMaterials(choices,'پلاستيكي')[0].id,'a');assert.equal(searchMaterials(choices,'۲۰۱۰۰۰۴۰')[0].id,'a');assert.equal(searchMaterials(choices,'٢٩٢٩٢٩٢٩')[0].id,'b');assert.equal(searchMaterials(choices,'filter کمپرسور')[0].id,'c');assert.equal(searchMaterials(choices,'ناشناخته').length,0);
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):React.isValidElement(x)?[x,...nodes(x.props.children)]:[];
let selected='a';function tree(){cursor=0;return MaterialSelect({value:selected,choices,onChange:id=>{changes.push(id);selected=id}})}
function input(){return nodes(tree()).find(n=>n.props.role==='combobox')}function options(){return nodes(tree()).filter(n=>n.props.role==='option')}
input().props.onFocus();input().props.onChange({target:{value:'۲۹۲۹'}});assert.equal(options().length,1);assert.equal(changes.length,0,'Typing must not reset receipt defaults');
options()[0].props.onClick();assert.equal(changes[0],'b');assert.equal(input().props.value,'29292929 · شیر');
input().props.onFocus();input().props.onChange({target:{value:'فیلتر'}});input().props.onKeyDown({key:'Enter',preventDefault(){}});assert.equal(selected,'c');
input().props.onChange({target:{value:'ناموجود'}});assert.equal(options().length,0);input().props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(selected,'c');assert.equal(input().props.value,'FILTER-32 · فیلتر کمپرسور');
console.log('PASS receipt material search: name/code, Persian/Arabic normalization, click/keyboard selection, no draft reset while typing, empty results and Escape preserve selection.');
