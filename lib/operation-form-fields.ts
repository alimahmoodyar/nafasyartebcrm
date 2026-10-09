// Presentation metadata for open-object MCP contracts. Domain handlers remain the source of validation.
// A space-separated list names fields, never default values or fabricated evidence.
export const operationDataFields:Record<string,Record<string,string>>={
 routine_production_apply:{policy:'effective restMinutes setupMinutes efficiencyPercent lowerPercent upperPercent notes',route:'materialId steps notes',lot:'routeId title count notes',assign:'lotId revision memberId day start end stage count rework notes',adjust:'jobId revision leaveMinutes downtimeMinutes setupMinutes restMinutes overtimeApproved notes',output:'jobId revision good scrap reworkCount overtime overtimeReference allocations varianceReason notes',close:'jobId revision actualMinutes overtimeMinutes overtimeReference notes',reason:'jobId revision notes',review:'jobId revision notes',quality:'lotId revision good scrap reworkCount reference notes',cost:'lotId revision rates overhead basis reference notes'},
 sales_network_apply:{template:'kind title cashBps months previousId notes',partner:'agentId revision kind ownerId contactDays reorderDays notes',contact:'agentId channel day nextAction nextDue notes',case:'agentId kind title nextAction nextDue notes',case_update:'agentId recordId revision state nextAction nextDue notes',contract:'agentId reference start end bps notes',contract_review:'agentId recordId revision approved notes',commission_settlement:'agentId amount notes',commission_review:'agentId recordId revision approved notes',commission_pay:'agentId recordId revision reference day notes',commission_cancel:'agentId recordId revision notes',check_link:'agentId recordId revision invoiceId notes'},
 purchase_shipment_apply:{specifications:'linkId revision materialRevision generalSpecs supplierSpecs day notes',create:'supplierId title reference currency day lines notes',register:'shipmentId revision day reference documentId notes',permit:'shipmentId revision day reference documentId notes',amend:'shipmentId revision day reference documentId notes',actual:'shipmentId revision day documentId lines notes',historical:'shipmentId revision day documentId lines notes'},
 foreign_purchase_apply:{selection_create:'materialId ownerId managerId due notes',selection_candidate:'caseId revision linkId day sampleDue notes',sample_received:'caseId revision day reference documentId notes',sample_review:'caseId revision day approved documentId notes',selection_reopen:'caseId revision due notes',configure:'caseId revision ownerId managerId logisticsId inventoryId receiptDays reminderDays notes',fx_queue:'caseId revision day reference notes',fx_allocate:'caseId revision day reference amount documentId notes',fx_buy:'caseId revision day reference amount account expectedReference documentId notes',obligation_due:'caseId revision fxId due notes',fx_receipt:'caseId revision fxId rowId amount notes',fx_receipt_undo:'caseId revision fxId rowId notes',obligation_close:'caseId revision fxId day documentId notes',order:'caseId revision day deliveryDay reference documentId notes',prepayment:'caseId revision day amount reference documentId notes',delivery:'caseId revision deliveryDay notes',ready:'caseId revision day notes',ship:'caseId revision day reference documentId notes',clearing:'caseId revision day reference documentId notes',clear:'caseId revision day reference documentId notes',receive:'caseId revision day lines finish discrepancyResolution notes',cost_add:'caseId revision title day amountRial reference documentId notes',cost_review:'caseId revision costId approved basis manual notes',register:'caseId revision day reference documentId notes',permit:'caseId revision day reference documentId notes',actual:'caseId revision day documentId lines notes',amend:'caseId revision day reference documentId notes'},
 apply_qms_record:{save:'recordId revision kind title productId private ownerId reviewerId due values fields templateId links notes',submit:'recordId revision notes',approve:'recordId revision notes',return:'recordId revision notes',close:'recordId revision notes',revise:'recordId revision notes',acknowledge:'recordId revision notes',hold:'recordId revision notes',install_positions:'notes'},
 manage_qms_file:{start:'parentId filename size',complete:'fileId',cancel:'fileId'},
 inbox_apply:{create:'recipientType recipientId kind title body priority due link',reply:'threadId revision body',claim:'threadId revision',start:'threadId revision',blocked:'threadId revision body',submit:'threadId revision body',approve:'threadId revision body',reopen:'threadId revision body',close:'threadId revision body',cancel:'threadId revision body',convert:'threadId revision due',reschedule:'threadId revision due',read:'threadId',snooze:'threadId until'}
};
const object=(keys:string):any=>({type:'object',properties:Object.fromEntries(keys.split(' ').filter(Boolean).map(k=>[k,{}]))});
export function operationDataSchema(tool:string,mode:string):any|undefined{
 const keys=operationDataFields[tool]?.[mode];if(!keys)return;
 const schema=object(keys),p=schema.properties;
 const choose=(key:string,options:Record<string,string>)=>{if(p[key])Object.assign(p[key],{type:'string',enum:Object.keys(options),enumLabels:options});};
 if(tool==='sales_network_apply'){
  choose('kind',['template','partner'].includes(mode)?{representative:'نماینده خریدار',reseller:'عامل خریدار',...(mode==='partner'?{referrer:'عامل معرف / پورسانتی'}:{})}:{training:'آموزش',marketing:'بازاریابی',support:'پشتیبانی',complaint:'شکایت',development:'درخواست توسعه'});
  choose('channel',{call:'تماس تلفنی',visit:'مراجعه حضوری',meeting:'جلسه',message:'پیام'});
  choose('state',{open:'باز',closed:'بسته‌شده'});
 }
 if(tool==='foreign_purchase_apply')choose('basis',{value:'ارزش کالا',weight:'وزن',manual:'تخصیص دستی'});
 if(tool==='inbox_apply'){
  choose('recipientType',{person:'شخص',position:'سمت سازمانی'});choose('kind',{message:'پیام',request:'درخواست کاری'});choose('priority',{normal:'عادی',urgent:'فوری'});
  if(p.link)p.link=object('section id');
 }
 const booleans=['approved','rework','overtime','overtimeApproved','finish','private'];
 for(const k of booleans)if(p[k])p[k].type='boolean';
 if(tool==='routine_production_apply'){
  for(const k of ['restMinutes','setupMinutes','efficiencyPercent','lowerPercent','upperPercent','count','stage','leaveMinutes','downtimeMinutes','good','scrap','reworkCount','actualMinutes','overtimeMinutes'])if(p[k])p[k].type='number';
  if(p.steps)p.steps={type:'array',items:object('title seconds allowancesIncluded bom')};
  if(p.steps){p.steps.items.properties.seconds.type='number';p.steps.items.properties.allowancesIncluded.type='boolean';p.steps.items.properties.bom={type:'array',items:object('materialId quantity')};}
  if(p.rates)p.rates={type:'array',items:object('jobId hourly overtimeHourly')};
  if(p.allocations)p.allocations={type:'array',items:object('batchId quantity')};
 }
 if(['purchase_shipment_apply','foreign_purchase_apply'].includes(tool)&&p.lines)p.lines={type:'array',items:object(mode==='receive'?'linkId quantity discrepancy manufacturerLot':'linkId quantity unitPrice packaging netKg grossKg volumeM3')};
 if(p.manual)p.manual={type:'array',items:object('linkId amountRial')};
 for(const k of ['cashBps','months','bps','contactDays','reorderDays','receiptDays','size'])if(p[k])p[k].type='number';
 if(p.reminderDays)p.reminderDays={type:'array',items:{type:'number'}};
 if(tool==='apply_qms_record'){
  if(p.values)p.values={type:'object',properties:{}};
  if(p.fields)p.fields={type:'array',items:object('key label type required options')};
  if(p.fields){p.fields.items.properties.required.type='boolean';p.fields.items.properties.type={type:'string',enum:['text','number','date','choice','boolean'],enumLabels:{text:'متن',number:'عدد',date:'تاریخ',choice:'انتخاب از فهرست',boolean:'بله / خیر'}};p.fields.items.properties.options={type:'array',items:{type:'string'}};}
  if(p.links)p.links={type:'array',items:{type:'string'}};
 }
 return schema;
}
// Only prune field supersets where the mode contract is explicit. Never remove argument values.
export function visiblePersonnelFields(args:any):string[]{
 const common=['mode','recordId','notes'],modes:Record<string,string>={employee:'memberId code unit title location employment managerId start end leaveMinutes bankAccount personal active',shift:'title startTime endTime breakMinutes weekdays holidays',assignment:'memberId start end shiftId',delegate:'managerId memberId start end',policy:'title insuranceBps insuranceCap taxBps taxExemption',ruling:'memberId title effective text monthlyBase monthlyAllowance overtimeHourly policyId',document:'memberId title effective text',punch:'memberId day at direction reference',period:'title start end deadline memberIds',calculate:'adjustments',pay:'amount day reference',approve:'',reject:'',withdraw:'',submit:'',publish:'',acknowledge:'',close_work:'',reopen_work:'',approve_payroll:'',approve_payment:'',close_period:'',cancel_calculation:''};
 if(args.mode==='request'){
  const kinds:Record<string,string>={leave:'start end leaveType hourly',mission:'start end hourly',correction:'start end inAt outAt',overtime:'start end inAt outAt',shift:'start end shiftId substituteId',objection:'targetId',profile:'bankAccount personal',loan:'amount installments repaymentStart',advance:'amount installments repaymentStart',cancel:'targetId',certificate:''};
  return [...common,'memberId','kind',...(kinds[args.kind]||'').split(' '),...(['leave','mission'].includes(args.kind)&&args.hourly?['startTime','endTime']:[])];
 }
 return args.mode in modes?[...common,...modes[args.mode].split(' ')]:[];
}
