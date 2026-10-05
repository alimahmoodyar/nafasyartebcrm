import {storage} from './storage';
import {trainingContext} from './training-context';
import {trainingRoles} from './training-contract';
import {dayAt,addDay} from './duties';
export async function seedTraining(actor:string){
 if(!trainingContext.getStore())throw Error('Training context required');
 const db=storage(),old:any=await db.prepare("SELECT data FROM flow_entities WHERE id='training-base'").first();if(old)return {ready:true,repeated:true,summary:JSON.parse(old.data)};
 const now=new Date().toISOString(),today=dayAt(),before=addDay(today,-20),future=addDay(today,30),admin=trainingRoles.find(r=>r.name==='مدیر سامانه')!,who=(name:string)=>trainingRoles.find(r=>r.name===name)!.memberId;
 const statements:D1PreparedStatement[]=[];
 const insert=(table:string,row:Record<string,any>)=>{const keys=Object.keys(row);statements.push(db.prepare(`INSERT INTO ${table} (${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).bind(...Object.values(row)));};
 const record=(id:string,kind:string,data:any)=>insert('records',{id,kind,payload:JSON.stringify(data),created:now});
 const entity=(id:string,type:string,data:any)=>insert('flow_entities',{id,type,data:JSON.stringify(data),revision:1,created:now,updated:now});
 const quality=[{key:'appearance',label:'ظاهر و سلامت — معیار آموزشی',type:'result',unit:'',min:'',max:'',required:true}];
 const summary={version:1,created:now,materials:8,products:3,batches:12,devices:9,roles:trainingRoles.length,note:'همه داده‌ها فرضی و صرفاً برای آموزش هستند.'};
 // Unique seed marker and the entire dataset commit atomically. A racing installer rolls back.
 entity('training-base','training_workspace',summary);
 insert('inventory_operations',{id:'training-seed',kind:'training_seed',payload:JSON.stringify(summary),actor,created:now,guard:1});
 for(const role of trainingRoles){insert('app_members',{id:role.memberId,email:role.session.email,name:role.session.name,unit:'آموزش',status:'active',subject:role.session.userId,permissions:JSON.stringify(role.session.permissions),revision:1,created:now,updated:now});entity('position:'+role.id,'position',{name:role.name,unit:'آموزش',active:true,members:[role.memberId],description:'سمت آزمایشی؛ حساب ورود واقعی نیست.'});}
 insert('app_identity',{id:'owner',subject:admin.session.userId});
 for(let i=1;i<=8;i++){
  const code=String(1000+i),id='material:'+code;
  entity(id,'material',{code,name:'کالای '+i+' — نمونه',unit:'عدد',specs:'مشخصات فرضی برای تست؛ معیار پذیرش محصول پزشکی نیست.',defaultLocation:'A-'+i+'-1-1',reorderPoint:10000,targetStock:100000,fields:quality,qcOwner:who('کنترل کیفیت'),warehouseOwner:who('انبار'),procurementOwner:who('تأمین'),sourcingRoutes:['domestic','foreign']});
  const quantity=100000,batch='training-batch-'+i;
  record(batch,'batch',{code:'TEST-'+code+'-001',partCode:code,part:'کالای '+i+' — نمونه',supplier:'تأمین‌کننده فرضی داخلی ۱',date:before,quantity:'100',unit:'عدد',status:'تأیید',notes:'فقط داده آزمایش',specs:'کنترل ظاهری آموزشی'});
  insert('inventory_batches',{batch_id:batch,part_code:code,unit:'عدد',created:now});
  for(const [warehouse,q] of [['raw',80000],['line',20000]] as const){insert('inventory_balances',{id:batch+'@'+warehouse,item_id:batch,warehouse,quantity:q});insert('inventory_entries',{id:batch+'@'+warehouse,operation_id:'training-seed',item_id:batch,warehouse,delta:q});}
  insert('flow_slots',{location:'A-'+i+'-1-1',batch_id:batch,quantity:80000});
  entity(batch,'receipt',{batchId:batch,materialId:id,materialRevision:1,fields:quality,specs:'کنترل ظاهری آموزشی',quantity,accepted:quantity,rejected:0,state:'stored',qcOwner:who('کنترل کیفیت'),warehouseOwner:who('انبار'),expiry:addDay(today,365),day:before,location:'A-'+i+'-1-1',qc:{values:{appearance:'pass'},failed:false,notes:'نتیجه فرضی',at:now,by:'کیفیت آزمایشی'}});
 }
 for(let i=9;i<=12;i++){
  const material=i-8,code=String(1000+material),id='training-batch-'+i;
  record(id,'batch',{code:'TEST-'+code+'-002',partCode:code,part:'کالای '+material+' — نمونه',supplier:'تأمین‌کننده فرضی خارجی ۱',date:today,quantity:'20',unit:'عدد',status:'قرنطینه',notes:'منتظر کنترل ورودی آزمایشی'});
  insert('inventory_batches',{batch_id:id,part_code:code,unit:'عدد',created:now});insert('inventory_balances',{id:id+'@quarantine',item_id:id,warehouse:'quarantine',quantity:20000});insert('inventory_entries',{id:id+'@quarantine',operation_id:'training-seed',item_id:id,warehouse:'quarantine',delta:20000});
  entity(id,'receipt',{batchId:id,materialId:'material:'+code,materialRevision:1,fields:quality,specs:'کنترل ظاهری آموزشی',quantity:20000,accepted:0,rejected:0,state:'pending_qc',qcOwner:who('کنترل کیفیت'),warehouseOwner:who('انبار'),expiry:addDay(today,365),day:today,actor:admin.session.userId});
 }
 for(let i=1;i<=3;i++){
  const id='training-product-'+i;
  record(id,'product',{code:'TP'+i,name:'محصول نمونه '+i,model:'مدل آموزشی '+i,group:'آزمایشی',status:'فعال',warrantyMonths:'24',notes:'محصول فرضی؛ مشخصات فنی و آزمون‌ها تأیید پزشکی نیستند.'});
  const lines=[1,2,3,4].map((j)=>({partCode:String(1000+j),name:'کالای '+j+' — نمونه',unit:'عدد',quantity:String(j===1?1:2)}));
  insert('bom_versions',{id:'training-bom-'+i,product_id:id,version:1,lines:JSON.stringify(lines),created:now,actor:admin.session.userId});
  insert('quality_templates',{id:'training-quality-'+i,product_id:id,version:1,title:'کنترل نهایی آموزشی محصول '+i,fields:JSON.stringify(quality),created:now,created_by:admin.session.userId});
  entity('capacity:'+id,'capacity',{productId:id,capacity:10,smallLabels:2});
  entity('training-price-'+i,'sales_price',{agentId:'',productId:id,unitPrice:String(i*10000000),active:true,reference:'تعرفه فرضی'});
  for(let j=1;j<=3;j++){
   const did='training-device-'+i+'-'+j,serial='TEST-TP'+i+'-00'+j;
   record(did,'device',{product:id,productName:'محصول نمونه '+i,productCode:'TP'+i,code:serial,model:'مدل آموزشی '+i,design:'TEST-1',firmware:'TEST-1',warrantyMonths:'24',date:before});
   if(j===1){entity(did,'build',{deviceId:did,planId:'',bomId:'training-bom-'+i,templateId:'training-quality-'+i,state:'planned',assembler:'',materials:[],workflowVersion:2});}
   else if(j===3){
    const qid='training-qc-'+i;
    insert('quality_reports',{id:qid,device_id:did,template_id:'training-quality-'+i,values:JSON.stringify({appearance:'pass'}),verdict:'pass',notes:'نتیجه فرضی آموزشی',created:now,created_by:admin.session.userId});
    entity(did,'build',{deviceId:did,planId:'',bomId:'training-bom-'+i,templateId:'training-quality-'+i,state:'finished',assembler:who('تولید'),materials:[],workflowVersion:2,receivedAt:now,latestQc:{id:qid,verdict:'pass'}});
    insert('inventory_balances',{id:did+'@finished',item_id:did,warehouse:'finished',quantity:1000});
    insert('inventory_entries',{id:did+'@finished',operation_id:'training-seed',item_id:did,warehouse:'finished',delta:1000});
    record('training-event-finished-'+i,'event',{device:did,stage:'دریافت انبار محصول نهایی',operator:'اپراتور نمونه',date:today,notes:'موجودی آغازین فرضی محصول برای تمرین فروش'});
   }
   else {record('training-event-'+i+'-'+j,'event',{device:did,stage:'تحویل',operator:'اپراتور نمونه',date:before,notes:'دستگاه فرضی تحویل‌شده برای آزمون خدمات'});record('training-dist-'+i+'-'+j,'distribution',{device:did,serial,dealerName:'نماینده فروش نمونه '+i,dealerCode:String(i),dealerDate:before,customerName:'مشتری فرضی '+i+'-'+j,customerCity:'تهران',customerProvince:'تهران',source:'آموزش'});insert('service_activations',{serial,day:before,months:24,source:'training',created:now,actor:admin.session.userId});}
  }
 }
 for(let i=1;i<=4;i++){
  const id='training-supplier-'+i,route=i<=2?'domestic':'foreign';
  entity(id,'supplier',{name:'تأمین‌کننده فرضی '+(route==='domestic'?'داخلی ':'خارجی ')+((i-1)%2+1),route,kind:'manufacturer',active:true,country:route==='domestic'?'ایران':'کشور فرضی',contact:'مسئول تماس نمونه '+i,phone:'000-TEST-'+i,email:'supplier'+i+'@example.invalid',messenger:'فقط داده فرضی',address:'نشانی فرضی',notes:'با این اطلاعات تماس نگیرید.'});
  for(let j=1;j<=8;j++)entity('training-supplier-link-'+i+'-'+j,'supplier_material',{supplierId:id,materialId:'material:'+(1000+j),partCode:String(1000+j),supplierCode:'TEST-'+j,status:'pending',specs:'کنترل ظاهری آموزشی',unit:'عدد',qualityRisk:'high',supplyRisk:'high',reviewDue:future,supplierRevision:1,notes:'برای تمرین ارزیابی؛ هنوز تأیید نشده است.'});
 }
 for(let i=1;i<=3;i++){
  const agentId='training-sales-agent-'+i;
  entity(agentId,'sales_agent',{name:'نماینده فروش نمونه '+i,phone:'000-TEST-'+i,address:'نشانی فرضی',province:'تهران',city:'تهران',contact:'مسئول نمونه '+i,active:true,creditLimit:'500000000',termDays:30,ownerId:who('کارشناس فروش'),financeId:who('مالی فروش'),managerId:who('مدیر فروش'),contractRef:'TEST-'+i});
  entity('training-goal-'+i,'sales_goal',{agentId,title:'هدف آموزشی نماینده '+i,start:before,end:future,basis:'units',amount:'20',productIds:[],state:'active',version:1,notes:'هدف فرضی برای تمرین'});
  entity('training-target-'+i,'sales_target',{agentId,title:'تخفیف آموزشی',start:before,end:future,basis:'units',productIds:[],tiers:[{threshold:'5',discountBps:200},{threshold:'10',discountBps:500}],state:'active',version:1,policy:'net-invoiced-next-order-v1',notes:'فقط آزمایش'});
  entity('training-payment-'+i,'sales_payment',{agentId,method:'cash',amount:'1000000',day:today,bank:'',normalizedBank:'',reference:'TEST-CASH-'+i,normalizedReference:'test-cash-'+i,fileId:'',checkDue:'',state:'pending',submittedBy:admin.session.userId,notes:'پرداخت فرضی؛ وجه واقعی دریافت نشده'});
 }
 entity('training-service-agent-1','as_agent',{name:'نماینده خدمات نمونه',domain:'home',province:'تهران',coverage:[{province:'تهران',cities:[]}],phone:'000-TEST',address:'نشانی فرضی',active:true});
 for(const domain of ['home','hospital']){
  entity('training-tariff-'+domain,'as_tariff',{domain,kind:'labor',name:'عیب‌یابی آموزشی',partCode:'',priceRial:'100000',costRial:'50000',validFrom:before,active:true});
  entity('training-part-tariff-'+domain,'as_tariff',{domain,kind:'part',name:'کالای ۱ — نمونه',partCode:'1001',priceRial:'200000',costRial:'100000',validFrom:before,active:true});
 }
 entity('training-supply-plan','sourcing_plan',{productId:'training-product-1',productName:'محصول نمونه ۱',count:20,needBy:future,origin:'forecast',reference:'پیش‌بینی فرضی',notes:'تمرین تأیید مدیرعامل و بررسی BOM',state:'pending',requestedBy:trainingRoles.find(r=>r.name==='برنامه‌ریز فروش')!.session.userId,finance:{status:'pending',budgetRial:'0'},lines:[],customerAllocations:[],history:[]});
 entity('training-request','request',{materialId:'material:1001',quantity:10000,planId:'',notes:'درخواست آزمایشی خط تولید',state:'pending',requestedBy:'تولید نمونه',warehouseOwner:who('انبار')});
 record('training-action','action',{title:'بررسی مغایرت ظاهری نمونه',batch:'training-batch-9',device:'training-device-1-1',owner:'کنترل کیفیت نمونه',due:future,status:'در حال اجرا',plan:'تمرین ثبت بررسی و اقدام اصلاحی؛ علت واقعی تعیین نشده است.'});
 record('training-firmware','firmware',{version:'TEST-1',model:'مدل آموزشی ۱',date:today,notes:'نسخه آموزشی بدون فایل اجرایی',status:'آزمایشی'});
 insert('access_audit',{id:crypto.randomUUID(),actor,target:'training-workspace',action:'training_initialize',after:JSON.stringify(summary),at:now});
 try{await db.batch(statements);}catch(e){const ready:any=await db.prepare("SELECT data FROM flow_entities WHERE id='training-base'").first();if(ready)return {ready:true,repeated:true,summary:JSON.parse(ready.data)};throw e;}
 return {ready:true,summary};
}
