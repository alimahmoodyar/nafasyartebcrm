const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function compile(file,require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require});return exports;}
const helpers=compile('lib/money-input.ts',require);
const {normalizeMoneyInput:normalize,formatMoneyInput:format,moneyCaret,moneyDigitsBefore}=helpers;
for(const [pasted,raw] of [['۱۲٬۵۰۰٬۰۰۰','12500000'],['١٢,٥٠٠,٠٠٠','12500000'],[' 12,500,000 ','12500000'],['0','0'],['',''],['123456789012345678','123456789012345678']])assert.equal(normalize(pasted),raw);
assert.equal(format('12500000'),'12,500,000');assert.equal(format('123456789012345678'),'123,456,789,012,345,678');
for(const invalid of ['1e6','-500','12.50','قیمت 100','1/2','1234567890123456789'])assert.equal(normalize(invalid),null);
assert.equal(moneyCaret('1,234,567',4),5);assert.equal(moneyDigitsBefore('1,234,567',5),4);
// Exercise input events and caret restoration without relying on number conversion.
let hooks=[],cursor=0,effects=[],value='',element,output;const emitted=[];
const react={useRef(initial){const i=cursor++;return hooks[i]||(hooks[i]={current:initial});},useLayoutEffect(f){effects.push(f);}};
const {MoneyInput}=compile('components/trace/money-input.tsx',n=>n==='react'?react:n==='@/lib/money-input'?helpers:require(n));
function render(){cursor=0;effects=[];output=MoneyInput({value,onChange:raw=>{emitted.push(raw);value=raw;},'aria-label':'مبلغ'});output.props.ref.current=element;for(const f of effects)f();return output.props;}
element={value:'',selectionStart:0,selectionEnd:0,setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}};
function edit(text,caret,inputType='insertText'){element.value=text;element.selectionStart=element.selectionEnd=caret;render().onChange({currentTarget:element,nativeEvent:{inputType}});render();element.value=output.props.value;}
edit('۱۲٬۵۰۰٬۰۰۰',10,'insertFromPaste');assert.equal(value,'12500000');assert.equal(output.props.value,'12,500,000');assert.ok(emitted.every(v=>!/[٬,]/.test(v)));
edit('12,9500,000',4);assert.equal(value,'129500000');assert.equal(output.props.value,'129,500,000');assert.equal(element.selectionStart,3,'Caret stays after the inserted digit');
const previous=value;edit('1e6',3);assert.equal(value,previous,'Invalid notation must not silently become a different price');
value='1234';render();element.value='1,234';element.selectionStart=element.selectionEnd=2;
output.props.onKeyDown({key:'Backspace',currentTarget:element,defaultPrevented:false});assert.equal(element.selectionStart,0);assert.equal(element.selectionEnd,2);
edit('234',0,'deleteContentBackward');assert.equal(value,'234');
value='1234';render();edit('1234',1,'deleteContentBackward');assert.equal(value,'234','Mobile separator deletion removes the preceding digit');
value='1234';render();edit('1234',1,'deleteContentForward');assert.equal(value,'134','Mobile separator deletion removes the next digit');
edit('',0,'deleteContentBackward');assert.equal(value,'');assert.equal(output.props.value,'');
console.log('PASS money inputs: exact integer strings, Persian/Arabic paste, grouping, middle edits and caret, desktop/mobile separator deletion, clearing, limits and invalid-notation rejection; no separators sent to APIs.');
