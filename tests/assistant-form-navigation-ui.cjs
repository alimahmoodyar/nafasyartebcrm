const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{exports,require:n=>{if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},console,Date,Intl,structuredClone,Set,Map,JSON},{filename:file});return exports;}

const {AssistantWorkspace}=load('components/trace/assistant-workspace.tsx'),workspace=load('lib/assistant-workspace.ts');
const choices=[{key:'lead',tool:'sales_lead_apply',title:'ایجاد سرنخ فروش',section:'sales',args:{mode:'save'}},{key:'reminder',tool:'personal_reminder_apply',title:'یادآور شخصی',section:'reminders',args:{mode:'save'}}];
const html=renderToStaticMarkup(React.createElement(AssistantWorkspace,{form:workspace.operationPicker(choices,'overview'),accountId:'admin',onChange(){},onSaved(){},onClose(){}}));
for(const text of ['انتخاب فرم عملیات','جست‌وجوی فرم','ایجاد سرنخ فروش','یادآور شخصی'])assert.ok(html.includes(text),text);
assert.ok(!html.includes('تأیید و اجرا'),'Opening a selector never offers an execution action');
assert.ok(!html.includes('sales_lead_apply'),'Technical tool names are not exposed as labels');
console.log('PASS universal form chooser rendering: searchable named choices, no execution action and no technical labels.');
