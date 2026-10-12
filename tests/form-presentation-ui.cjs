const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache={};
function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{exports,require:n=>{if(!n.startsWith('@/')&&!n.startsWith('.'))return require(n);const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(fs.existsSync(p+'.ts')?p+'.ts':p+'.tsx')},console,Date,Intl,structuredClone,Set,Map,JSON},{filename:file});return exports;}
const {AssistantWorkspace}=load('components/trace/assistant-workspace.tsx'),{ActionCards}=load('components/trace/assistant-actions.tsx'),{formPresentation}=load('lib/assistant-form-presentation.ts');
function render(tool,args,schema){return renderToStaticMarkup(React.createElement(AssistantWorkspace,{form:{tool,args,schema,title:'فرم عملیات',section:'test'},accountId:'test',onChange(){},onSaved(){},onClose(){}}));}
// Template schedules share their visible controls and derived dates with the manual form.
const templateInput={type:'object',properties:{mode:{type:'string'},data:{type:'object',additionalProperties:true}}};
const fixedTemplateArgs={mode:'template',data:{effectiveFrom:'2026-10-11',durationDays:5,effectiveTo:'2027-01-01',minMonths:3,maxCashBps:7000,notes:'Old draft explanation'}};
const fixedPresentation=formPresentation('sales_network_apply',fixedTemplateArgs,templateInput,'فروش');
assert.equal(fixedPresentation.schema.properties.data.properties.minMonths.uiHidden,true);assert.ok(!fixedPresentation.schema.properties.data.required.includes('minMonths'));
assert.equal(fixedPresentation.schema.properties.data.properties.maxCashBps.uiHidden,true);assert.ok(!fixedPresentation.schema.properties.data.required.includes('maxCashBps'));
const fixedFields=fixedPresentation.schema.properties.data;
assert.ok(fixedFields.required.includes('productPrices'));assert.equal(fixedFields.properties.productPrices.minItems,1);assert.equal(fixedFields.properties.productPrices.items.properties.unitPrice.format,'money');
const pricedArgs={mode:'template',data:{effectiveFrom:'2026-10-11',discountBps:1500,productPrices:[{productId:'catalog-product',unitPrice:'12500000'}]}},pricedBefore=JSON.stringify(pricedArgs),pricedHtml=render('sales_network_apply',pricedArgs,templateInput);
for(const label of ['کالاها و قیمت پایه الگو','کالای الگو، ردیف 1','قیمت پایه هر واحد پیش از تخفیف','قیمت هر واحد پس از تخفیف الگو','۱۰٬۶۲۵٬۰۰۰'])assert.ok(pricedHtml.includes(label),label);
assert.ok(pricedHtml.includes('value="12,500,000"'));assert.ok(!pricedHtml.match(/<select[^>]*aria-label="کالای الگو، ردیف 1"[^>]*>/)[0].includes('readOnly'));assert.equal(JSON.stringify(pricedArgs),pricedBefore);
assert.equal(fixedFields.properties.effectiveFrom.format,'date');assert.ok(fixedFields.required.includes('effectiveFrom'));assert.ok(!fixedFields.required.includes('durationDays'));for(const key of ['durationDays','effectiveTo','notes'])assert.ok(fixedFields.properties[key].uiHidden);
const fixedTemplateHtml=render('sales_network_apply',fixedTemplateArgs,templateInput);assert.ok(fixedTemplateHtml.includes('<option value="fixed" selected="">الگوی ثابت</option>'));assert.ok(!fixedTemplateHtml.includes('Old draft explanation'));assert.ok(!fixedTemplateHtml.includes('مدت پروموشن (روز)'));
const promoTemplateArgs={mode:'template',data:{templateType:'promotion',effectiveFrom:'2028-02-28',durationDays:3,effectiveTo:'2029-01-01',notes:'Old draft explanation'}},originalPromo=JSON.stringify(promoTemplateArgs);
const promoFields=formPresentation('sales_network_apply',promoTemplateArgs,templateInput,'فروش').schema.properties.data;assert.ok(promoFields.required.includes('durationDays'));assert.equal(promoFields.properties.durationDays.minimum,1);assert.ok(!promoFields.properties.durationDays.uiHidden);
const promoHtml=render('sales_network_apply',promoTemplateArgs,templateInput);assert.ok(promoHtml.includes('مدت پروموشن (روز)'));assert.ok(promoHtml.includes('تاریخ پایان خودکار: '+load('lib/persian-date.ts').formatDate('2028-03-01')));assert.ok(!promoHtml.includes('2029-01-01'));assert.equal(JSON.stringify(promoTemplateArgs),originalPromo);
const contactFields=formPresentation('sales_network_apply',{mode:'contact',data:{}},templateInput,'فروش').schema.properties.data;assert.ok(contactFields.required.includes('notes'));assert.ok(!contactFields.properties.notes.uiHidden);
const raw={type:'object',properties:{mode:{type:'string'},revision:{type:'number'},company:{type:'string'},contactName:{type:'string'},title:{type:'string'},phone:{type:'string'},segment:{type:'string',enum:['home','hospital']}}};
const empty=render('sales_lead_apply',{mode:'save'},raw);for(const name of ['ایجاد سرنخ فروش','نام سرنخ فروش','نام شرکت / بیمارستان / مرکز','نام فرد رابط','شماره تماس','بیمارستانی'])assert.ok(empty.includes(name),name);assert.ok(!empty.includes('اطلاعات تکمیلی'));assert.ok(!empty.includes('نسخه رکورد'));
const service=render('after_sales_apply',{mode:'diagnose',data:{lines:[{partCode:'P-1',coverage:'warranty',quantity:'2'}]}},{type:'object',properties:{data:{type:'object'}}});for(const name of ['قطعات موردنیاز','پوشش','گارانتی دستگاه','دلیل شمول یا عدم شمول گارانتی'])assert.ok(service.includes(name),name);
// Installed batch history is resolved by the server; diagnosis must not ask the
// service user to supply a batch number or explain missing trace history.
assert.ok(!service.includes('علت نامشخص بودن بچ'));
assert.ok(!service.includes('بچ قطعه قبلی'));
const diagnose=formPresentation('after_sales_apply',{mode:'diagnose'},{type:'object',properties:{data:{type:'object'}}},'خدمات');
assert.equal(diagnose.schema.properties.data.properties.lines.items.properties.oldBatchId,undefined);
assert.equal(diagnose.schema.properties.data.properties.lines.items.properties.unknownReason,undefined);
const groupedService=render('after_sales_apply',{mode:'diagnose',data:{lines:[{customerUnitRial:'12500000',quantity:'1250'}],laborLines:[{customerRial:'450000'}]}},{type:'object',properties:{data:{type:'object'}}});assert.ok(groupedService.includes('value="12,500,000"'));assert.ok(groupedService.includes('value="450,000"'));assert.ok(groupedService.includes('value="1,250"'),'Quantities use the shared grouping format');assert.ok(groupedService.includes('inputMode="numeric"'));
// National identity numbers are user-entered text, not internal record IDs.
const representativeSchema={type:'object',properties:{mode:{type:'string'},agentId:{type:'string',title:'شناسه پرونده نماینده'},nationalId:{type:'string',title:'کد ملی مسئول نمایندگی'},name:{type:'string'}}};
for(const nationalId of ['', '0012345678']){
 const html=render('sales_apply',{mode:'agent',nationalId},representativeSchema);
 const input=html.match(/<input[^>]*aria-label="کد ملی مسئول نمایندگی"[^>]*>/)?.[0];assert.ok(input);assert.ok(!input.includes('readOnly'));assert.ok(!input.includes('پس از انتخاب پرونده'));assert.ok(input.includes('inputMode="numeric"'));assert.ok(input.includes('value="'+nationalId+'"'));
}
const linkedRepresentative=render('sales_apply',{mode:'agent',agentId:'agent-1',nationalId:'0012345678'},representativeSchema);assert.ok(linkedRepresentative.match(/<input[^>]*aria-label="شناسه پرونده نماینده"[^>]*>/)?.[0].includes('readOnly'),'Internal target identifiers stay locked');
const args={mode:'request',kind:'advance',amount:'1200000',notes:'bank',memberId:'employee-17',revision:2,id:'op-123'};const before=JSON.stringify(args);
const action={id:'pending',tool:'personnel_apply',title:'درخواست پرسنلی',args,state:'pending',section:'personnel'};
const confirm=renderToStaticMarkup(React.createElement(ActionCards,{actions:[action],busy:false,onDecide:async()=>true}));
for(const value of ['مساعده','مبلغ درخواست (ریال)','1200000','bank','employee-17','تأیید و اجرا'])assert.ok(confirm.includes(value),value);assert.ok(!confirm.includes('op-123'));assert.ok(!confirm.includes('نسخه رکورد'));assert.equal(JSON.stringify(args),before);
const target=renderToStaticMarkup(React.createElement(ActionCards,{actions:[{...action,tool:'delete_record',args:{id:'record-target',kind:'product'}}],busy:false,onDecide:async()=>true}));assert.ok(target.includes('record-target'));
const metadata=formPresentation('apply_qms_record',{mode:'save',data:{kind:'change'}},{type:'object',properties:{}},'کیفیت');assert.equal(metadata.schema.properties.data.properties.values.properties.effective.format,undefined,'Engineering effective-point is text, not a date');
const advance=formPresentation('personnel_apply',{mode:'request',kind:'advance'},{type:'object',properties:{kind:{},amount:{},installments:{},repaymentStart:{},start:{},end:{},leaveType:{},monthlyBase:{}}},'پرسنلی');
assert.ok(advance.schema.properties.monthlyBase.uiHidden);assert.ok(advance.schema.required.includes('repaymentStart'));
const leave=formPresentation('personnel_apply',{mode:'request',kind:'leave'},advance.schema,advance.title);assert.equal(leave.schema.properties.start.uiHidden,false);assert.equal(leave.schema.properties.amount.uiHidden,true);
const setup=formPresentation('personnel_apply',{mode:'profile_setup'},{type:'object',properties:{memberId:{},managerId:{},start:{},monthlyBase:{},notes:{}}},'پرسنلی');assert.ok(setup.title.includes('ایجاد پرونده پایه پرسنلی'));assert.equal(setup.schema.properties.memberId.uiHidden,false);for(const key of ['managerId','start','monthlyBase'])assert.equal(setup.schema.properties[key].uiHidden,true);
const setupHtml=render('setup_personnel_profile',{}, {type:'object',properties:{memberId:{type:'string'},notes:{type:'string'}}});assert.ok(setupHtml.includes('ایجاد پرونده پایه پرسنلی'));assert.ok(setupHtml.includes('علت اتصال پرونده پرسنلی'));assert.ok(!setupHtml.includes('فیلد تعریف‌نشده'));
const {ActivationCodePanel}=load('components/trace/activation-code-panel.tsx');
const activation=renderToStaticMarkup(React.createElement(ActivationCodePanel,{accountId:'test',demo:false}));
for(const label of ['تولید کد پنج‌رقمی','کد ۱۰رقمی دستگاه','علت تولید کد / شماره پیگیری مشتری','تأیید و تولید کد پنج‌رقمی'])assert.ok(activation.includes(label),label);
assert.ok(activation.includes('inputMode="numeric"'));assert.ok(activation.includes('maxLength="10"'));assert.ok(!activation.includes('coefficients'));
const trainingActivation=renderToStaticMarkup(React.createElement(ActivationCodePanel,{accountId:'test',demo:true}));assert.ok(!trainingActivation.includes('<form'));assert.ok(trainingActivation.includes('اطلاعات شرکت'));
const {RemindersPanel}=load('components/trace/reminders-panel.tsx');
const reminderHtml=renderToStaticMarkup(React.createElement(RemindersPanel,{accountId:'test'}));
for(const label of ['یادآورهای من','نوع یادآوری','با وقوع رویداد','تاریخ یادآوری','ساعت به وقت ایران','توضیحات و کاری'])assert.ok(reminderHtml.includes(label),label);
assert.ok(!renderToStaticMarkup(React.createElement(RemindersPanel,{accountId:'test',demo:true})).includes('<form'));
// Static coverage of native controls, including external labels and hidden uploads.
let files=0,controls=0;for(const file of fs.readdirSync(path.join(root,'components/trace')).filter(f=>f.endsWith('.tsx'))){const text=fs.readFileSync(path.join(root,'components/trace',file),'utf8'),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);files++;function visit(n){if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&['input','select','textarea'].includes(n.tagName.getText(sf))){controls++;const attrs=n.attributes.getText(sf);let p=n.parent,label=false;while(p){if(ts.isJsxElement(p)&&p.openingElement.tagName.getText(sf)==='label'){label=true;break}p=p.parent}const id=attrs.match(/\bid="([^"]+)"/);assert.ok(label||/aria-label|aria-labelledby|\bhidden\b/.test(attrs)||(id&&text.includes('htmlFor="'+id[1]+'"')),file+': unlabelled '+n.getText(sf));}ts.forEachChild(n,visit)}visit(sf)}
console.log('PASS form UI: empty/filled labels, nested service rows, confirmation captions, untouched business text and identifiers;',controls,'native controls across',files,'components audited.');

const dateMarkup=renderToStaticMarkup(React.createElement(load('components/trace/solar-date.tsx').SolarDate,{label:'تاریخ دریافت درخواست',value:'2026-10-11',onChange(){}}));assert.ok(dateMarkup.includes('grid-template-columns:minmax(3.25rem,0.8fr) minmax(0,1.4fr) minmax(4.5rem,1.1fr)'));for(const part of ['روز','ماه','سال'])assert.ok(dateMarkup.includes('تاریخ دریافت درخواست — '+part));assert.ok(!dateMarkup.includes('flex-wrap:wrap'),'Date parts keep a single row');
