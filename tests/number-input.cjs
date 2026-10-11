const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');function compile(file,req){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:req});return exports;}
const helpers=compile('lib/number-input.ts',require),{formatNumberInput:format,normalizeNumberInput:normalize,quantitativeField,numberValidation}=helpers;
assert.equal(format('123456789012345678.0050'),'123,456,789,012,345,678.0050');assert.equal(format('-12500.25'),'-12,500.25');assert.equal(normalize('−100'),null);assert.equal(normalize('۱۲٬۵۰۰٫۲۵'),'12500.25');assert.equal(normalize('١٢,٥٠٠.٢٥'),'12500.25');assert.equal(normalize('1e6'),null);assert.equal(normalize('12.3.4'),null);
for(const k of ['amount','quantity','unitPrice','netKg','grossKg','volumeM3','fxRate','maxTokens','paidRial','salary'])assert.ok(quantitativeField(k),k);
for(const k of ['mobile','phone','nationalId','serial','code','number','contract','iban','accountNumber','alertDays','reference'])assert.ok(!quantitativeField(k),k);
assert.ok(numberValidation('10001',{max:10000}));assert.ok(numberValidation('-1',{min:0}));assert.ok(numberValidation('1.5',{type:'number'}));assert.equal(numberValidation('1.5',{step:'0.01',type:'number'}),'');assert.ok(numberValidation('-',{type:'number'}));
let hooks=[],cursor=0,effects=[],value='',output,element;const emitted=[];
const react={useRef(v){const i=cursor++;return hooks[i]||(hooks[i]={current:v});},useState(v){const i=cursor++;if(!(i in hooks))hooks[i]=v;return [hooks[i],x=>{hooks[i]=typeof x==='function'?x(hooks[i]):x;}];},useLayoutEffect(f){effects.push(f);}};
const {NumberInput}=compile('components/trace/number-input.tsx',n=>n==='react'?react:n==='@/lib/number-input'?helpers:require(n));
element={value:'',selectionStart:0,selectionEnd:0,setSelectionRange(s,e){this.selectionStart=s;this.selectionEnd=e;},setCustomValidity(v){this.error=v;}};
function render(extra={}){cursor=0;effects=[];output=NumberInput({fieldKey:'amount',value,onChange:e=>{emitted.push(e.target.value);value=typeof value==='number'?Number(e.target.value):e.target.value;},...extra});if(typeof output.type==='function')output=output.type(output.props);if(typeof output.props.ref==='function')output.props.ref(element);for(const effect of effects)effect();return output.props;}
function edit(text,caret,extra={},inputType='insertText'){const props=render(extra);element.value=text;element.selectionStart=element.selectionEnd=caret;props.onChange({currentTarget:element,nativeEvent:{inputType}});render(extra);element.value=output.props.value;}
edit('۱۲٬۵۰۰٫۲۵',9);assert.equal(value,'12500.25');assert.equal(output.props.value,'12,500.25');assert.ok(emitted.every(x=>!/[٬,]/.test(x)));
edit('129,500.25',3);assert.equal(value,'129500.25');assert.equal(element.selectionStart,3);
value=1;hooks=[];edit('1.',2,{type:'number',step:'any'});assert.equal(value,1);assert.equal(output.props.value,'1.','Numeric state allows typing a decimal point');edit('1.25',4,{type:'number',step:'any'});assert.equal(value,1.25);assert.equal(output.props.value,'1.25');
value='1234';hooks=[];render();edit('1234',1,{},'deleteContentBackward');assert.equal(value,'234');
value='1234';hooks=[];render();edit('1234',1,{},'deleteContentForward');assert.equal(value,'134');
edit('',0);assert.equal(value,'');assert.equal(output.props.value,'');
value='09123456789';hooks=[];render({fieldKey:'mobile',inputMode:'numeric'});assert.equal(output.type,'input');assert.equal(output.props.value,'09123456789');assert.equal(output.props.inputMode,'numeric');
console.log('PASS grouped numeric forms: exact large strings, decimals, signed values, Persian/Arabic paste, numeric-state decimal editing, caret/deletion, raw API values, bounds/steps and unchanged identifiers.');
