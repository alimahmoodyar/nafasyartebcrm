const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const root=path.resolve(__dirname,'..'),cache={};
function compile(file,requireFn,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:requireFn,File,Error,crypto:globalThis.crypto,console,...extra},{filename:file});return exports;}
function domain(name){if(name==='./production')return {validateBom:v=>v};const file='lib/'+name.replace(/^\.\//,'')+'.ts';return cache[file]||(cache[file]=compile(file,domain));}
const parser=domain('./bom-import');
// DOM fixture mirrors the namespace-aware browser DOM interface, including sparse indices.
let xmlSheets=[],xmlError=false,xlsxSheets=[];
function element(tag,attrs={},children=[],value=''){return {tag,textContent:value,getAttributeNS:(ns,key)=>attrs[key]??null,getElementsByTagNameNS(ns,key){return children.flatMap(c=>[...(c.tag===key?[c]:[]),...c.getElementsByTagNameNS(ns,key)])}};}
const cell=(value,attrs={})=>element('Cell',attrs,[element('Data',{},[],String(value))]);
const worksheet=(name,rows)=>element('Worksheet',{Name:name},rows.map((cells,i)=>element('Row',{},cells.map(v=>cell(v)))));
const reader=compile('lib/bom-import-file.ts',n=>n==='./bom-import'?parser:{default:async()=>xlsxSheets},{DOMParser:class{parseFromString(){return {querySelector:()=>xmlError?{}:null,getElementsByTagNameNS:()=>xmlSheets}}}});
const simple=[['کد','نام','واحد','مقدار مصرف'],...Array.from({length:81},(_,i)=>['\u200f'+String(10100000+i),'قطعه '+i,['سانتي متر','عدد','جفت','ست','كيلوگرم'][i%5],i===0?'4,200':i===4?'0/107':'1'])];
let slots=[],cursor=0,effects=[],fetches=[],readBook;
const react={...React,useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(value){const i=cursor++;return slots[i]||(slots[i]={current:value})},useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps?.some((v,j)=>v!==slots[i][j]))effects.push(fn);slots[i]=deps}};
const ui=compile('components/trace/bom-import.tsx',n=>n==='react'?react:n==='react/jsx-runtime'?require(n):n.includes('bom-import-file')?{...reader,readBomSheets:async()=>readBook}:n.includes('bom-import')?parser:n.includes('number-input')?{NumberInput:'input'}:{IconDisclosure:'section'},{fetch:async(url,options)=>{fetches.push(JSON.parse(options.body));return {ok:true,json:async()=>({newCodes:[],changed:[],removed:[],warnings:[],errors:[],catalogSnapshot:'snapshot'})}}});
const props={productId:'product',previousVersion:0,disabled:false,onSaved:()=>{throw Error('No save expected')}};
function render(){cursor=0;const tree=ui.BomImport(props);effects.splice(0).forEach(fn=>fn());return tree;}
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];}
const find=(tree,predicate)=>{const found=nodes(tree).find(predicate);assert.ok(found,'Expected control');return found};
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
const button=(tree,label)=>find(tree,n=>n.type==='button'&&text(n).includes(label));
(async()=>{
 xmlSheets=[worksheet('12',[['subassembly only']]),worksheet('1',simple)];
 const file=new File(['<?xml version="1.0"?><Workbook/>'],'formula.xls');
 const sheets=await reader.readBomSheets(file);assert.equal(sheets.length,2);assert.equal(reader.defaultBomSheet(sheets),1);
 const grid=await reader.readBomGrid(file),draft=parser.parseMappedBomGrid(grid,0,parser.guessImportMapping(grid[0]));
 assert.equal((await reader.readBomFile(file)).lines.length,81);
 assert.equal(draft.lines.length,81);assert.equal(draft.lines[0].partCode,'10100000');assert.equal(draft.lines[0].quantity,'4200');assert.equal(draft.lines[0].unit,'سانتی‌متر');assert.equal(draft.lines[4].quantity,'0.107');assert.equal(draft.lines[4].unit,'کیلوگرم','No guessed conversion to grams');
 assert.equal(reader.defaultBomSheet([{name:'۱۲'},{name:' ۱ '}]),1);assert.equal(reader.defaultBomSheet([{name:'Sheet1'},{name:'Sheet2'}]),0);
 xmlSheets=[element('Worksheet',{Name:'sparse'},[element('Row',{Index:'3'},[cell('header',{Index:'2',MergeAcross:'2'}),cell('last')]),element('Row',{},[cell('next')])])];
 const sparse=(await reader.readBomSheets(file))[0].grid;assert.equal(sparse.length,4);assert.deepEqual(Array.from(sparse[2]),['','header','','','last']);assert.equal(sparse[3][0],'next');
 for(const attrs of [{Index:'0'},{Index:'201'},{MergeAcross:'200'},{MergeAcross:'-1'}]){xmlSheets=[element('Worksheet',{Name:'bad'},[element('Row',{},[cell('x',attrs)])])];await assert.rejects(()=>reader.readBomSheets(file));}
 xmlSheets=[element('Worksheet',{Name:'bad'},[element('Row',{Index:'5001'},[])])];await assert.rejects(()=>reader.readBomSheets(file));
 xmlSheets=[];await assert.rejects(()=>reader.readBomSheets(file));xmlError=true;await assert.rejects(()=>reader.readBomSheets(file),/XML/);xmlError=false;
 await assert.rejects(()=>reader.readBomSheets(new File(['<!DOCTYPE Workbook>'],'bad.xls')),/XML/);
 await assert.rejects(()=>reader.readBomSheets(new File(['binary'],'old.xls')),/XLSX/);
 xlsxSheets=[{sheet:'2',data:[['other']]},{sheet:'1',data:simple}];assert.equal((await reader.readBomGrid(new File(['PK'],'book.xlsx'))).length,82);
 const unknown=parser.parseMappedBomGrid([simple[0],['10100999','Unknown','مجهول','1']],0,parser.guessImportMapping(simple[0]));assert.equal(unknown.lines[0].unit,'');assert.match(unknown.lines[0].note,/مجهول/);
 if(process.env.BOM_XML_DOM){const hydrate=n=>element(n.tag,n.attrs,(n.children||[]).map(hydrate),n.value);xmlSheets=JSON.parse(fs.readFileSync(process.env.BOM_XML_DOM,'utf8').replace(/^\uFEFF/,'')).map(hydrate);const actualBook=await reader.readBomSheets(file),actual=await reader.readBomFile(file);assert.equal(actualBook.length,12);assert.equal(actualBook[reader.defaultBomSheet(actualBook)].name,'1');assert.equal(actual.lines.length,81);assert.equal(actual.lines.find(l=>l.partCode==='10100822').quantity,'0.107');console.log('PASS native XML DOM of uploaded workbook: 12 sheets read; only main sheet selected.');}
 // Real uploaded workbook, if supplied locally: read-only cross-check of the main 81 rows.
 if(process.env.BOM_WORKBOOK){const xlsx=require('xlsx'),book=xlsx.read(fs.readFileSync(process.env.BOM_WORKBOOK),{type:'buffer'}),rows=xlsx.utils.sheet_to_json(book.Sheets['1'],{header:1,defval:'',raw:false});const actual=parser.parseMappedBomGrid(rows,0,parser.guessImportMapping(rows[0]));assert.equal(actual.lines.length,81);assert.equal(new Set(actual.lines.map(l=>l.partCode)).size,81);assert.equal(actual.lines.find(l=>l.partCode==='10100822').quantity,'0.107');assert.equal(actual.lines.find(l=>l.partCode==='10100822').unit,'کیلوگرم');assert.equal(actual.lines.find(l=>l.partCode==='10100021').quantity,'4200');assert.ok(actual.lines.every(l=>l.unit));console.log('PASS real uploaded main sheet: 81 unique rows; units and quantities preserved.');}
 readBook=[{name:'12',grid:[simple[0],['10199999','Other','عدد','2']]},{name:'1',grid:simple}];
 let tree=render();await find(tree,n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[file]}});await new Promise(resolve=>setImmediate(resolve));tree=render();
 const sheetSelect=tree=>find(tree,n=>n.type==='select'&&React.Children.toArray(n.props.children).some(c=>text(c)==='12'));
 assert.equal(find(tree,n=>n.type==='details'&&n.props.className==='bom-import-mapping').props.open,false,'Detected workbook hides optional column setup and sample list');assert.ok(nodes(tree).some(n=>n.type==='table'&&n.props.className==='stocktable bom-import-table'),'Full editable list remains available');
 assert.equal(sheetSelect(tree).props.value,1);assert.equal(nodes(tree).filter(n=>n.type==='input'&&n.props.fieldKey==='partCode').length,81);assert.equal(fetches.length,0,'File choice must not call any server endpoint');
 const editable=find(tree,n=>n.props['aria-label']==='نام قلم 1');editable.props.onChange({target:{value:'Edited name'}});tree=render();assert.equal(find(tree,n=>n.props['aria-label']==='نام قلم 1').props.value,'Edited name');assert.equal(fetches.length,0);
 await button(tree,'بررسی و پیش‌نمایش').props.onClick();await new Promise(resolve=>setImmediate(resolve));tree=render();assert.equal(fetches.length,1);assert.equal(fetches[0].mode,'preview');assert.equal(fetches[0].lines[0].name,'Edited name');assert.match(fetches[0].source,/برگه 1/);assert.equal(button(tree,'ثبت نهایی').props.disabled,false,'Explicit final registration is available after reviewed preview');
 find(tree,n=>n.props['aria-label']==='کد قلم 1').props.onChange({target:{value:'10188888'}});tree=render();assert.equal(button(tree,'ثبت نهایی').props.disabled,true,'Editing disables final registration until a new preview');
 sheetSelect(tree).props.onChange({target:{value:'0'}});tree=render();assert.equal(nodes(tree).filter(n=>n.type==='input'&&n.props.fieldKey==='partCode').length,1);assert.equal(find(tree,n=>n.props['aria-label']==='کد قلم 1').props.value,'10199999');assert.equal(fetches.length,1,'Sheet switching is local and must not commit');
 assert.ok(fetches.every(r=>r.mode==='preview'));
 let saved=0;props.onSaved=()=>{saved++};await button(tree,'بررسی و پیش‌نمایش').props.onClick();await new Promise(resolve=>setImmediate(resolve));tree=render();assert.equal(button(tree,'ثبت نهایی').props.disabled,false);await button(tree,'ثبت نهایی').props.onClick();await new Promise(resolve=>setImmediate(resolve));tree=render();const commit=fetches.find(r=>r.mode==='commit');assert.ok(commit);assert.equal(commit.confirmed,true);assert.equal(commit.catalogSnapshot,'snapshot');assert.ok(commit.id);assert.equal(saved,1);assert.ok(!nodes(tree).some(n=>n.type==='button'&&text(n).includes('ثبت نهایی')),'Successful registration clears the import draft');
 const list=compile('components/trace/bom-list.tsx',n=>n==='react'||n==='react/jsx-runtime'?require(n):{formatDateTime:s=>s});const html=require('react-dom/server').renderToStaticMarkup(React.createElement(list.BomList,{lines:simple.slice(1).map((r,i)=>({partCode:String(10100000+i),name:r[1],unit:'گرم',quantity:i?'1':'0.000001'})),title:'Complete BOM'}));assert.equal((html.match(/<tr/g)||[]).length,82);assert.ok(html.includes('0.000001'));assert.ok(html.includes('10100080'));

 console.log('PASS workbook reader/UI: sheet isolation/default, sparse XML, bounds, XLSX, editable rows, no automatic writes, preview invalidation.');
})().catch(e=>{console.error(e);process.exitCode=1});
