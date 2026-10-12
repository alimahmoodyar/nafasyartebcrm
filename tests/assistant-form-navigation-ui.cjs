const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache={};
// These render-only form tests isolate the navigation ref; the live Dialog fixture tests registry behavior.
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{exports,require:n=>{if(n==='./program-workspace')return {useWorkspaceBack:()=>()=>{}};if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},console,Date,Intl,structuredClone,Set,Map,JSON},{filename:file});return exports;}

const {AssistantWorkspace}=load('components/trace/assistant-workspace.tsx'),workspace=load('lib/assistant-workspace.ts');
const choices=[{key:'lead',tool:'sales_lead_apply',title:'ایجاد سرنخ فروش',section:'sales',args:{mode:'save'}},{key:'reminder',tool:'personal_reminder_apply',title:'یادآور شخصی',section:'reminders',args:{mode:'save'}}];
const html=renderToStaticMarkup(React.createElement(AssistantWorkspace,{form:workspace.operationPicker(choices,'overview'),accountId:'admin',onChange(){},onSaved(){},onClose(){}}));
for(const text of ['انتخاب فرم عملیات','جست‌وجوی فرم','ایجاد سرنخ فروش','یادآور شخصی'])assert.ok(html.includes(text),text);
assert.ok(!html.includes('تأیید و اجرا'),'Opening a selector never offers an execution action');
assert.ok(!html.includes('sales_lead_apply'),'Technical tool names are not exposed as labels');
console.log('PASS universal form chooser rendering: searchable named choices, no execution action and no technical labels.');
const saleForm={tool:'sales_apply',section:'sales',title:'قدیمی',schema:{type:'object',properties:{}},args:{mode:'order',agentId:'buyer',items:[{productId:'soshia',quantity:5}]},preview:{agentId:'buyer',buyer:{name:'باران سلامت',kind:'representative'},deliveryMode:'sale',lines:[{productId:'soshia',name:'سوشیا',quantity:5,unitPrice:'100000000',discountBps:1000,unitNet:'90000000'}],amount:'450000000',discount:'50000000',salesTerms:{cashBps:5000,standardCashBps:5000,months:1,standardMonths:1},installments:[{id:'cash',kind:'cash',amount:'225000000',due:'2026-10-11'},{id:'balance',kind:'balance',amount:'225000000',due:'2026-11-10'}]}};
const saleHtml=renderToStaticMarkup(React.createElement(AssistantWorkspace,{form:saleForm,accountId:'admin',onChange(){},onSaved(){},onClose(){}}));
for(const text of ['ثبت سفارش فروش','باران سلامت','سوشیا','قیمت مصوب هر دستگاه','مبلغ نهایی','شرایط پرداخت مصوب'])assert.ok(saleHtml.includes(text),text);
for(const text of ['فاکتور مرتبط با چک','وجه نقد خرید جدید','هر ۱۰۰ واحد','quoteHash','openingId','تخصیص اعتبار','عامل معرف'])assert.ok(!saleHtml.includes(text),'Irrelevant field must not be rendered: '+text);
assert.ok(saleHtml.includes('max-width:760px'),'Order workspace stays compact on desktop');
assert.ok(saleHtml.includes('۴۵۰٬۰۰۰٬۰۰۰'),'Readable grouped rial total');
console.log('PASS compact sales rendering: five Soshia devices, named buyer, approved price/discount/payment summary, bounded desktop width, no unrelated fields.');
