const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{exports,require:n=>{if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},console,Date,Intl,structuredClone,Set,Map,JSON},{filename:file});return exports;}

const {formPresentation}=load('lib/assistant-form-presentation.ts'),{AssistantWorkspace}=load('components/trace/assistant-workspace.tsx'),{visiblePartRepairFields}=load('lib/part-repair-contract.ts');
const mode={type:'string',enum:['create','review','consent','issue'],title:'مرحله',enumLabels:{create:'دریافت قطعه',review:'تصمیم مسئول خدمات',consent:'پاسخ نماینده',issue:'تحویل از انبار'}};
const schema={type:'object',properties:{id:{type:'string'},domain:{type:'string'},mode,revision:{type:'integer'},data:{type:'object'},confirmed:{type:'boolean'}}};
function render(args){return renderToStaticMarkup(React.createElement(AssistantWorkspace,{form:{tool:'part_repair_apply',title:'قطعات تعمیری نمایندگان',schema,section:'after-sales',args},accountId:'test',onChange(){},onSaved(){},onClose(){}}));}
const intake=render({mode:'create',domain:'home',revision:0,data:{partName:'برد',agentId:'A',serial:'ABC',requestedAction:'program'}});
for(const label of ['نام قطعه','سریال قطعه','اقدام مورد نیاز'])assert.ok(intake.includes(label),label);
for(const label of ['اقدامات انجام شده','نتیجهٔ تست','هزینهٔ قطعهٔ نو','شمارهٔ بارنامه','تکنسین','فیلد تعریف‌نشده'])assert.ok(!intake.includes(label),'intake should not include later steps: '+label);
const returned=render({mode:'review',domain:'home',revision:3,data:{repairId:'repair-id',decision:'return',notes:'عودت',coverage:'paid',replacementPartCode:'P',originalDisposition:'hold'}});
for(const label of ['هزینهٔ قطعهٔ نو','قطعهٔ جایگزین','تکلیف قطعهٔ قبلی','repair-id'])assert.ok(!returned.includes(label),'return hides unnecessary replacement fields: '+label);
const replace=render({mode:'review',domain:'home',revision:3,data:{repairId:'repair-id',decision:'replace',coverage:'warranty'}});
for(const label of ['هزینهٔ قطعهٔ نو','قطعهٔ جایگزین','تکلیف قطعهٔ قبلی'])assert.ok(replace.includes(label),label);
const issue=render({mode:'issue',domain:'home',revision:5,data:{repairId:'repair-id'}});assert.ok(issue.includes('قطعهٔ نو از موجودی آزاد دفتر'));assert.ok(!issue.includes('بچ قطعه'),'actual batch comes from inventory, not free text');
assert.ok(!visiblePartRepairFields('create',{noSerial:true}).some(f=>f.key==='serial'));assert.ok(visiblePartRepairFields('create',{noSerial:true,serial:'ABC'}).some(f=>f.key==='serial'),'conflicting supplied serial remains editable');
console.log('PASS staged representative repair forms: short intake, conditional return/replacement, hidden existing target, automatic lot trace, consistent assistant/UI fields');
