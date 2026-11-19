const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},structuredClone,Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}

const printApi=load('app/api/personnel/print/route.ts');
const ctx=load('lib/mcp/context.ts').mcpActor,api=load('app/api/personnel/route.ts'),files=load('app/api/personnel/files/route.ts'),domain=load('lib/personnel.ts'),catalog=load('lib/mcp/tools.ts'),tasks=load('app/api/tasks/route.ts'),duties=load('lib/duties.ts');
let tail=Promise.resolve();const batch=db.batch.bind(db);db.batch=stmts=>{const next=tail.then(()=>batch(stmts));tail=next.catch(()=>{});return next};
const base='https://test.local',now=new Date().toISOString(),today=duties.dayAt(),day=duties.addDay(today,-10),next=duties.addDay(today,2);
const req=(url,b,origin=base)=>new Request(base+url,{method:b?'POST':'GET',headers:{origin,'Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});
function actor(id,roles=[],extra={}){const u={userId:'local:'+id,email:id+'@test.local',name:id,isAdmin:false,permissions:{read:[],write:[],eventStages:[],personnelRoles:roles,...extra}};sql.prepare("INSERT INTO app_members(id,email,name,unit,status,subject,permissions,created,updated) VALUES(?,?,?,'company','active',?,?,?,?)").run(id,u.email,id,u.userId,JSON.stringify(u.permissions),now,now);return u;}
const alice=actor('alice'),bob=actor('bob'),manager=actor('manager'),hr=actor('hr',['hr']),payroll=actor('payroll',['payroll']),approver=actor('approver',['approver']),finance=actor('finance',['finance']),treasury=actor('treasury',['treasury']),ceo=actor('ceo',['executive_viewer']),external=actor('external',[],{salesAgentId:'outside',salesRoles:['agent']});
const row=id=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get(id);return r?{...r,data:JSON.parse(r.data)}:null};
async function get(u,q=''){const r=await ctx.run(u,()=>api.GET(req('/api/personnel'+q)));return {status:r.status,data:await r.json()}}
async function post(u,b){const r=await ctx.run(u,()=>api.POST(req('/api/personnel',{id:crypto.randomUUID(),confirmed:true,revision:0,notes:'Actual evidence',...b})));return {status:r.status,data:await r.json()}}
async function ok(u,b){const r=await post(u,b);assert.equal(r.status,200,JSON.stringify({b,r}));return r.data.id;}
const apply=(u,id,mode,extra={})=>post(u,{recordId:id,revision:row(id).revision,mode,...extra});
const success=async(u,id,mode,extra={})=>{const r=await apply(u,id,mode,extra);assert.equal(r.status,200,JSON.stringify({mode,r}));return r};
const seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),now,now);

const payrollApi=load('app/api/personnel/payroll/route.ts'),exportApi=load('app/api/personnel/payroll/export/route.ts'),evidenceApi=load('app/api/personnel/payroll/files/route.ts');
const engine=load('lib/personnel-payroll-engine.ts'),facts=load('lib/personnel-payroll-facts.ts'),missions=load('lib/personnel-payroll-missions.ts'),edits=load('lib/personnel-payroll-edit.ts'),payments=load('lib/personnel-payroll-payments.ts'),ops=load('lib/personnel-payroll-operations.ts'),date=load('lib/persian-date.ts');
const from='2026-10-24',to='2026-10-27',iban='IR220000000000000000000001';
async function read(u,query){const r=await ctx.run(u,()=>payrollApi.GET(req('/api/personnel/payroll?'+new URLSearchParams(query))));return {status:r.status,data:await r.json()}}
function employee(mid){return {memberId:mid,name:mid,start:from,state:'active',bankAccount:iban,childrenCount:0,children:[],profileApprovedAt:now,maritalStatus:'single',familyBase:{effective:from,maritalStatus:'single',childrenCount:0},history:[]}}
const policyInput={mode:'payroll_policy',title:'SYNTHETIC TEST NOT LAW',start:from,end:to,source:'isolated test policy',taxSource:'isolated test tax',taxConfirmed:true,minimumDaily:'1',fullDayMinutes:480,hourlyPaidOffMinutes:480,insuranceRequiredDays:720,insuranceDailyCap:'1000',insuranceBps:1000,employerBps:2000,unemploymentBps:300,taxExemption:'100',taxInsuranceDeductionBps:0,baseInsured:true,baseTaxable:true,jobInsured:true,jobTaxable:true,welfareInsured:false,welfareTaxable:false,allowanceDivisor:'30',restPay:'paid',components:[],taxBands:[{upper:'100',bps:1000},{upper:'',bps:2000}]};
const lines=d=>d.components.map(c=>({key:c.key,title:c.title,amount:c.amount,insured:c.insured,taxable:c.taxable}));
(async()=>{
 assert.equal(engine.progressivePayrollTax(400n,engine.normalizedPayrollPolicy(policyInput)),50n);
 assert.equal(engine.progressivePayrollTax(100n,engine.normalizedPayrollPolicy(policyInput)),0n);
 assert.throws(()=>engine.normalizedPayrollPolicy({...policyInput,components:[{kind:'mission'}]}),/مأموریت/);
 assert.throws(()=>engine.normalizedPayrollPolicy({...policyInput,taxBands:[{upper:'100',bps:2000},{upper:'',bps:1000}]}),/مالیات/);
 for(const mid of ['alice','bob']){
  seed('employee-'+mid,'hr_employee',employee(mid));
  seed('contract-'+mid,'hr_contract',{memberId:mid,title:'قرارداد پرسنلی',start:from,end:to,salaryEffective:from,baseSalary:'3000',salaryBasis:'monthly',employment:'تمام‌وقت',state:'active',finalizedAt:now,benefits:[]});
 }
 seed('shift','hr_shift',{title:'Test eight-hour week',startTime:'08:00',endTime:'16:00',breakMinutes:0,weekdays:[0,1,2,3,4,5,6],holidays:[],state:'published'});
 for(const mid of ['alice','bob']){
  seed('assignment-'+mid,'hr_assignment',{memberId:mid,shiftId:'shift',start:from,end:to,state:'published'});
  for(let d=from;d<=to;d=duties.addDay(d,1))if(mid==='alice'||![duties.addDay(from,1),duties.addDay(from,2)].includes(d)){
   seed(mid+d+'in','hr_punch',{memberId:mid,day:d,at:d+'T08:00:00+03:30',direction:'in'});
   seed(mid+d+'out','hr_punch',{memberId:mid,day:d,at:d+'T16:00:00+03:30',direction:'out'});
  }
 }
 seed('trip-bob','staff_mission',{memberIds:['bob'],goal:'Approved operational trip',kind:'service',source:{id:'case'},state:'completed',startedAt:'2026-10-25T04:30:00.000Z',finishedAt:'2026-10-26T12:30:00.000Z',returnReviews:[{decision:'approve',at:now,note:'time checked'}],finish:{actualReturnPoint:'office'}});
 const policyId=await ok(payroll,policyInput);await success(payroll,policyId,'submit');await success(approver,policyId,'publish');
 const period=await ok(hr,{mode:'period',title:'Synthetic period',start:from,end:to,deadline:to,memberIds:['alice','bob']});
 const before=await apply(payroll,period,'payroll_prepare');assert.equal(before.status,200);assert.equal(before.data.preview.filter(x=>x.status==='exception').length,2);
 await success(hr,period,'payroll_work_accept');assert.equal(row(period).data.work.bob.credited,1920);assert.equal(row(period).data.work.bob.overtime,0);
 await success(payroll,period,'payroll_calculate');
 const all=sql.prepare("SELECT * FROM flow_entities WHERE type='hr_payroll'").all().map(r=>({...r,data:JSON.parse(r.data)}));const a=all.find(r=>r.data.memberId==='alice'),b=all.find(r=>r.data.memberId==='bob');
 assert.equal(a.data.gross,'400');assert.equal(a.data.insurance,'40');assert.equal(a.data.tax,'50');assert.equal(a.data.net,'310');
 assert.equal(b.data.missionAmountStatus,'pending_policy');assert.equal(b.data.missions[0].returnPoint,'office');assert.equal(b.data.missions[0].amount,null);
 assert.equal((await apply(approver,b.id,'approve_payroll')).status,409);
 assert.equal((await apply(payroll,a.id,'approve_payroll')).status,403);
 assert.equal((await read(treasury,{view:'slip',id:a.id})).status,404);
 assert.equal((await read(alice,{view:'slip',id:a.id})).status,403);
 assert.equal((await read(finance,{view:'slip',id:a.id})).status,404);
 sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='contract-alice'").run();assert.equal((await apply(approver,a.id,'payroll_finalize')).status,409);await success(payroll,a.id,'payroll_recalculate',{notes:'New verified contract revision'});assert.equal(row(a.id).data.recalculations.length,1);assert.equal(row(a.id).data.state,'review');assert.equal(row(a.id).data.published,false);
 const editLines=lines(b.data).map(c=>c.key==='mission'?{...c,amount:'100',insured:true,taxable:true}:c);
 assert.equal((await apply(payroll,b.id,'payroll_edit',{lines:editLines,notes:''})).status,400);
 assert.equal((await apply(payroll,b.id,'payroll_edit',{lines:editLines,notes:'Documented allowance'})).status,400);
 const pre=await apply(payroll,b.id,'payroll_edit',{lines:editLines,notes:'Documented allowance',missionReviewed:true,preview:true});assert.equal(pre.status,200);assert.equal(pre.data.preview.net,'380');assert.equal(row(b.id).revision,1);assert.equal(row(b.id).data.missionAmountStatus,'pending_policy');
 await success(payroll,b.id,'payroll_edit',{lines:editLines,notes:'Actual explicit mission amount for this slip only',missionReviewed:true});
 const raceVersion=row(b.id).revision,raceLines=lines(row(b.id).data),race=await Promise.all([post(payroll,{mode:'payroll_edit',recordId:b.id,revision:raceVersion,notes:'Correction A',lines:raceLines}),post(payroll,{mode:'payroll_edit',recordId:b.id,revision:raceVersion,notes:'Correction B',lines:raceLines})]);assert.equal(race.filter(x=>x.status===200).length,1);assert.equal(race.filter(x=>x.status===409).length,1);
 assert.equal(row(b.id).data.net,'380');assert.equal(row(b.id).data.missionAmountStatus,'manual_documented');assert.equal(row(b.id).data.slipEdits[0].before.net,'310');assert.equal(row('trip-bob').revision,1);
 assert.equal((await apply(approver,b.id,'payroll_edit',{lines:lines(row(b.id).data).slice(1),notes:'drop row'})).status,400);
 await success(approver,a.id,'payroll_finalize',{warningsReviewed:true});await success(approver,b.id,'payroll_finalize',{warningsReviewed:true});
 assert.equal((await read(finance,{view:'slip',id:b.id})).status,200);
 assert.equal((await read(finance,{view:'missions',id:a.id,missionId:'trip-bob'})).status,404);
 assert.equal((await read(finance,{view:'missions',id:b.id,missionId:'trip-bob'})).status,200);
 const byteBuffer=new TextEncoder().encode('approved private trip evidence').buffer;objects.set('linked-object',byteBuffer);const hash=require('node:crypto').createHash('sha256').update(new Uint8Array(byteBuffer)).digest('hex');seed('linked-evidence','staff_mission_file',{missionId:'trip-bob',filename:'trip.txt',objectKey:'linked-object',byteSize:byteBuffer.byteLength,sha256:hash});seed('orphan-evidence','staff_mission_file',{missionId:'trip-bob',filename:'abandoned.txt',objectKey:'linked-object',byteSize:byteBuffer.byteLength,sha256:hash});seed('trip-report','staff_mission_report',{missionId:'trip-bob',registeredAt:now,fileIds:['linked-evidence'],notes:'Actual report'});
 const fileList=await read(finance,{view:'missions',id:b.id,missionId:'trip-bob',section:'files'});assert.equal(fileList.data.items.length,1);assert.equal(fileList.data.items[0].objectKey,undefined);
 assert.equal((await ctx.run(finance,()=>evidenceApi.GET(req('/api/personnel/payroll/files?slipId='+b.id+'&id=linked-evidence')))).status,200);assert.equal((await ctx.run(finance,()=>evidenceApi.GET(req('/api/personnel/payroll/files?slipId='+b.id+'&id=orphan-evidence')))).status,404);assert.equal((await ctx.run(treasury,()=>evidenceApi.GET(req('/api/personnel/payroll/files?slipId='+b.id+'&id=linked-evidence')))).status,404);assert.equal((await read(finance,{view:'slip',id:b.id})).data.period.data.work,undefined);

 const financeBody={id:crypto.randomUUID(),mode:'approve_payment',recordId:a.id,revision:row(a.id).revision,notes:'Final financial review'};assert.equal((await post(finance,financeBody)).status,200);const again=await post(finance,financeBody);assert.equal(again.status,200);assert.equal(again.data.repeated,true);await success(finance,b.id,'approve_payment');
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM economic_events WHERE kind='payroll_accrual'").get().n,2);
 assert.equal((await apply(payroll,b.id,'payroll_edit',{lines:lines(row(b.id).data),notes:'after finance'})).status,409);
 assert.equal((await apply(treasury,b.id,'pay',{amount:'380',reference:'invented-bank',day:to})).status,404);
 const paymentView=await read(treasury,{view:'payments',periodId:period});assert.equal(paymentView.status,200);assert.equal(paymentView.data.total,'690');assert.equal(paymentView.data.items.length,2);assert.equal(paymentView.data.items[0].components,undefined);
 assert.equal((await read(hr,{view:'payments',periodId:period})).status,403);assert.equal((await get(treasury)).data.records.some(r=>r.id===b.id),false);
 const print=await ctx.run(treasury,()=>exportApi.GET(req('/api/personnel/payroll/export?'+new URLSearchParams({periodId:period,format:'print'}))));assert.equal(print.status,200);const printed=await print.text();assert.match(printed,/IR220/);assert.doesNotMatch(printed,/حقوق پایه|سابقه بیمه/);
 const excel=await ctx.run(treasury,()=>exportApi.GET(req('/api/personnel/payroll/export?'+new URLSearchParams({periodId:period,format:'xlsx'}))));assert.equal(excel.status,200);const wb=require('xlsx').read(await excel.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];assert.equal(ws.B2.t,'s');assert.equal(ws.C2.v,iban);
 assert.equal((await ctx.run(treasury,()=>printApi.GET(req('/api/personnel/print?id='+b.id)))).status,404);
 const slipPrint=await ctx.run(bob,()=>printApi.GET(req('/api/personnel/print?id='+b.id)));assert.equal(slipPrint.status,200);assert.match(await slipPrint.text(),/Approved operational trip/);
 // Idempotent finance replay cannot create a second accrual or monetary change.
 assert.equal((await apply(finance,b.id,'approve_payment')).status,400);assert.equal(sql.prepare("SELECT COUNT(*) n FROM economic_events WHERE kind='payroll_accrual'").get().n,2);
 // Every source revision and new overlapping trip must invalidate a pending slip.
 const d=structuredClone(row(a.id).data);d.memberId='alice';assert.equal(ops.payrollSourcesCurrent(d,[...domainRows(),...await missions.readPayrollMissionRows(['alice'],duties.addDay(from,-6),duties.addDay(to,6))]),true);
 seed('late-trip','staff_mission',{memberIds:['alice'],startedAt:'2026-10-25T08:00:00.000Z',finishedAt:'2026-10-25T09:00:00.000Z',returnReviews:[{decision:'approve'}],state:'completed'});
 assert.equal(ops.payrollSourcesCurrent(d,[...domainRows(),...await missions.readPayrollMissionRows(['alice'],duties.addDay(from,-6),duties.addDay(to,6))]),false);
 // Loan amounts, source classification and minute edits are server-derived.
 const editable={...a,data:{...a.data,periodId:period,state:'review',payments:[]}};
 const minute=edits.editPayrollSlip({id:'edit',notes:'measured adjustment',lines:lines(a.data).map(c=>({...c,minutes:90,hourlyRate:'100'}))},editable,domainRows(),{id:'payroll',userId:payroll.userId,has:r=>r==='payroll'},now);assert.equal(minute.data.gross,'150');assert.equal(minute.data.net,'130');
 assert.throws(()=>edits.editPayrollSlip({notes:'negative',lines:[{...lines(a.data)[0],amount:'-1'}]},editable,domainRows(),{id:'payroll',has:r=>r==='payroll'},now));
 // Birthday exactly 18 and six Persian months, not 180 Gregorian days.
 const birth=date.solarToIso(1387,8,1),adult=date.solarToIso(1405,8,1),eve=duties.addDay(adult,-1),child={id:'child',name:'Child',birthDate:birth,effective:birth},parent={...employee('alice'),childrenCount:1,children:[child]};
 assert.equal(facts.childEligibility([],parent,eve).eligible.length,1);assert.equal(facts.childEligibility([],parent,adult).pending.length,1);
 const issued=date.solarToIso(1405,1,31),renewal=facts.studyRenewal(issued);assert.equal(renewal,date.solarToIso(1405,7,30));
 const proof={id:'study',type:'hr_request',data:{kind:'family',memberId:'alice',childId:'child',familyEvent:'study',state:'approved',effective:adult,eventDate:adult,renewal:facts.studyRenewal(adult)}};
 assert.equal(facts.childEligibility([proof],parent,adult).eligible.length,1);assert.equal(facts.childEligibility([proof],parent,proof.data.renewal).pending.length,1);assert.equal(facts.childEligibility([{...proof,data:{...proof.data,memberId:'bob'}}],parent,adult).pending.length,1);
 assert.throws(()=>facts.payrollEmployeeFacts({recordId:'employee-alice',insuranceDays:800,insuranceAsOf:from,insuranceConfirmed:true},parent,[],to),/گزارش/);
 const pendingFile={id:'insurance-file',type:'hr_file',data:{caseId:'employee-alice',category:'insurance_record',reviewState:'pending'}};assert.throws(()=>facts.payrollEmployeeFacts({recordId:'employee-alice',insuranceDays:800,insuranceAsOf:from,insuranceSourceId:pendingFile.id,insuranceConfirmed:true},parent,[pendingFile],to));

 // Contract-based amounts, proportional credit, precision, premiums and loan sources.
 const simplePolicy={...engine.normalizedPayrollPolicy({...policyInput,start:'2026-10-23',end:'2026-11-21',insuranceBps:0,taxBands:[{upper:'',bps:0}],taxExemption:'0'}),state:'published'},emp={...employee('pure'),start:'2025-01-01'},contract={id:'pure-c',revision:1,type:'hr_contract',data:{memberId:'pure',start:'2026-10-23',end:'2026-11-21',salaryEffective:'2026-10-23',state:'active',finalizedAt:now,baseSalary:'3000',salaryBasis:'monthly',employment:'تمام‌وقت',benefits:[]}},rule={id:'pure-r',revision:1,type:'hr_policy',data:simplePolicy};
 const dayWork=(day,credited=480)=>({day,expected:480,credited,worked:credited,overtime:0,nightMinutes:0,incomplete:false});
 const calc=(days,c=contract,r=rule,more=[])=>engine.computeContractPayroll([c,r,...more],emp,{id:'pure-period',start:days[0].day,end:days.at(-1).day},{days});
 assert.equal(calc([dayWork(from,240)]).gross,'50');assert.throws(()=>calc([dayWork(from)],contract,rule,[{id:'same-month',type:'hr_payroll',data:{memberId:'pure',periodId:'other-period',state:'review',periodBasis:{start:from,end:to}}}]),/معافیت/);
 assert.equal(calc([dayWork(from)],{...contract,data:{...contract.data,salaryBasis:'daily',baseSalary:'1001'}}).gross,'1001');
 assert.equal(calc([dayWork(from)],{...contract,data:{...contract.data,salaryBasis:'hourly',baseSalary:'600'}}).gross,'4800');
 const longDays=Array.from({length:30},(_,i)=>({...dayWork(duties.addDay('2026-10-23',i)),worked:0}));assert.equal(calc(longDays).gross,'3000');
 assert.throws(()=>calc([{...dayWork(from),overtime:60}]),/اضافه/);
 const premiumRule={...rule,data:{...simplePolicy,components:[{kind:'overtime',title:'OT',amount:'0',bps:14000,insured:false,taxable:false},{kind:'night',title:'Night',amount:'0',bps:3500,insured:false,taxable:false},{kind:'friday',title:'Friday',amount:'0',bps:4000,insured:false,taxable:false}]}},jobContract={...contract,data:{...contract.data,benefits:[{kind:'job',title:'job pay',amount:'300',effective:from}]}};
 const premiums=calc([{...dayWork(from),overtime:60,nightMinutes:120}],jobContract,premiumRule);assert.equal(premiums.components.find(c=>c.title==='OT').amount,'19');assert.equal(premiums.components.find(c=>c.title==='Night').amount,'10');assert.equal(premiums.gross,'139');
 const halfContract={...contract,data:{...contract.data,employment:'پاره‌وقت',baseSalary:'1500'}},halfWork={...dayWork(from,240),expected:240,overtime:60};const halfPay=calc([halfWork],halfContract,premiumRule);assert.equal(halfPay.components.find(c=>c.title==='OT').amount,'18');assert.equal(halfPay.base,'50');
 const friday=calc([dayWork('2026-10-30')],jobContract,premiumRule);assert.equal(friday.components.find(c=>c.title==='Friday').amount,'44');
 const capRule={...rule,data:{...simplePolicy,insuranceBps:1000,insuranceDailyCap:'50'}};assert.equal(calc([dayWork(from)],contract,capRule).insurance,'5');
 const loan={id:'paid-loan',revision:2,type:'hr_request',data:{memberId:'pure',kind:'loan',state:'paid',amount:'301',recovered:'50',installments:3,repaymentStart:from}};
 const loancalc=calc([dayWork(from)],{...contract,data:{...contract.data,baseSalary:'6000'}},rule,[loan]);assert.equal(loancalc.loanDeductions[0].amount,'101');assert.equal(loancalc.net,'99');
 assert.equal(calc([dayWork(from)],contract,rule,[{...loan,data:{...loan.data,state:'payable'}}]).loanDeductions.length,0);
 assert.throws(()=>calc([dayWork(from)],contract,rule,[loan,{id:'older',type:'hr_payroll',data:{state:'review',loanDeductions:[{id:loan.id}]}}]),/رزرو/);
 const unpaidWork=[{day:from,expected:0,credited:0,worked:0,overtime:0,nightMinutes:0}];assert.equal(calc(unpaidWork,contract,rule,[{id:'unpaid',type:'hr_request',data:{memberId:'pure',kind:'leave',leaveType:'unpaid',state:'approved',start:from,end:from}}]).gross,'0');
 const span=[{id:'trip',type:'staff_mission',revision:1,data:{memberIds:['pure'],state:'completed',startedAt:from+'T04:30:00.000Z',finishedAt:from+'T12:30:00.000Z',returnReviews:[{decision:'approve'}]}}];const shift={start:Date.parse(from+'T08:00:00+03:30'),end:Date.parse(from+'T16:00:00+03:30'),minutes:480};assert.equal(missions.missionIntervalCredit(span,'pure',from,shift,[[shift.start,shift.end]]).minutes,0);assert.equal(missions.missionIntervalCredit(span,'pure',from,shift,[]).minutes,480);
 const accounting=load('lib/accounting-contract.ts'),eventPayload=JSON.parse(sql.prepare("SELECT payload FROM economic_events WHERE kind='payroll_accrual' LIMIT 1").get().payload);const posting=accounting.eventLines('payroll_accrual',eventPayload,accounting.defaultPostingAccounts);assert.equal(posting.reduce((n,l)=>n+BigInt(l.debit),0n),posting.reduce((n,l)=>n+BigInt(l.credit),0n));assert.ok(!accounting.postingAccountKeys('purchase_advance').includes('salaryPayable'),'new payroll mappings do not block existing purchase rules');
 // Bank matching is pure and cannot declare execution from a client checkbox.
 const payable=[{id:'one',type:'hr_payroll',revision:1,data:{name:'A',net:'100',state:'payable',published:true,bankAccount:iban,payments:[]}}];
 const transaction={transactionId:'txn-1',accountId:'bank-1',beneficiaryIban:iban,amount:'40',day:to,status:'success'};
 const match=payments.previewPayrollBankMatch(payable,[transaction],[]);assert.equal(match.committed,false);assert.equal(match.matches[0].amount,'40');assert.equal(payable[0].data.payments.length,0);
 assert.equal(payments.previewPayrollBankMatch(payable,[transaction,transaction],[]).exceptions.length,1);
 assert.equal(payments.previewPayrollBankMatch(payable,[{...transaction,status:'failed'}],[]).matches.length,0);
 assert.equal(payments.previewPayrollBankMatch(payable,[{...transaction,status:'reversed'}],[]).matches.length,0);
 assert.equal(payments.previewPayrollBankMatch(payable,[{...transaction,amount:'101'}],[]).matches.length,0);
 // MCP uses same routes, not a separate permission bypass.
 const mcpRead=await catalog.executeTool('get_payroll_workspace',{view:'payments',periodId:period},base,{user:treasury,scope:'read',tokenId:null});assert.match(JSON.stringify(mcpRead),/690/);
 await assert.rejects(()=>catalog.executeTool('get_payroll_workspace',{view:'slip',id:b.id},base,{user:treasury,scope:'read',tokenId:null}),e=>e.status===404);
 console.log('payroll-approved: PASS — contract source, mission unknown/manual, final review, finance, treasury privacy/export, children/study, insurance evidence, edits, sources and bank match');
})().catch(e=>{console.error(e);process.exitCode=1});
function domainRows(){return sql.prepare("SELECT * FROM flow_entities WHERE type GLOB 'hr_*'").all().map(r=>({...r,data:JSON.parse(r.data)}));}
