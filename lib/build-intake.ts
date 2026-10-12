import {storage} from './storage';
import {AccessError} from './authorization';
import {liveSalesUser,salesVisible,salesLock,publicSalesFile} from './sales';
import {buildIntakeRoles} from './build-intake-access';
import {customerOrderForms,snapshotCustomerOrderForm} from './build-order-forms';
import {productProductionMode} from './model';
import {leadMembers,leadMemberGuard} from './sales-leads';
import {memberId,notice} from './duties';
import {storedAccessPermissions} from './permissions';
import {trainingContext} from './training-context';
import type {Session} from './permissions';

export const buildIntakeStates:Record<string,string>={draft:'پیش‌نویس',technical_review:'در انتظار بررسی فنی',commercial_review:'در انتظار تأیید ساخت',returned:'برگشت برای اصلاح',approved:'تأییدشده و متصل به پروژه'};
export const buildIntakeModes=['save','submit','technical_accept','return','approve','revise'] as const;
const fail=(message:string,status=400):never=>{throw new AccessError(message,status)};
const text=(value:unknown,max=4000,required=false)=>{if(typeof value!=='string'||value.length>max)fail('متن معتبر وارد کنید.');const result=(value as string).trim();if(required&&!result)fail('اطلاعات الزامی را تکمیل کنید.');return result;};
const uuid=(value:unknown)=>{const result=text(value,80,true);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result))fail('شناسه عملیات معتبر لازم است.');return result;};
const date=(value:unknown,required:boolean)=>{const result=text(value??'',10,required);if(result&&(!/^\d{4}-\d{2}-\d{2}$/.test(result)||!Number.isFinite(Date.parse(result))||new Date(result).toISOString().slice(0,10)!==result))fail('تاریخ تحویل معتبر لازم است.');return result;};
const normalize=(value:string)=>value.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim();
export async function buildIntakeSource(){
 const db=storage(),[entities,products,members]=await Promise.all([db.prepare("SELECT * FROM flow_entities WHERE type IN ('sales_order','sales_agent','business_contract','qms_record','sales_file','build_intake','build_project') ORDER BY created,id").all(),db.prepare("SELECT id,payload FROM records WHERE kind='product'").all(),leadMembers()]);
 return {rows:entities.results.map((r:any)=>({...r,data:JSON.parse(r.data)})),products:products.results.map((r:any)=>({id:r.id,payload:r.payload,...JSON.parse(r.payload)})),members};
}
async function live(user:Session){if(trainingContext.getStore())fail('سفارش ساخت مشتری در محیط نمونه ثبت نمی‌شود.',403);const u=await liveSalesUser(user);if(!buildIntakeRoles(u).read)fail('دسترسی سفارش ساخت ندارید.',403);return u;}
async function visible(u:Session,r:any,source:any){
 const roles=buildIntakeRoles(u),agent=source.rows.find((a:any)=>a.type==='sales_agent'&&a.id===r.data.agentId);
 if(roles.manager||roles.engineering)return true;
 if(roles.production&&!roles.sales)return r.data.state==='approved';
 return !!(roles.sales&&agent&&await salesVisible(u,agent));
}
export async function readableBuildIntakes(user:Session){
 const u=await live(user),source=await buildIntakeSource();
 const candidates=source.rows.filter((r:any)=>r.type==='build_intake'),checks=await Promise.all(candidates.map((r:any)=>visible(u,r,source)));
 return {u,source,intakes:candidates.filter((_:any,i:number)=>checks[i])};
}
export async function buildIntakeRead(user:Session){
 const {u,source:s,intakes}=await readableBuildIntakes(user),roles=buildIntakeRoles(u);
 const agents=s.rows.filter((r:any)=>r.type==='sales_agent');
 const allowed=await Promise.all(agents.map((a:any)=>roles.sales?salesVisible(u,a):Promise.resolve(intakes.some((r:any)=>r.data.agentId===a.id))));
 const agentIds=new Set(agents.filter((_:any,i:number)=>allowed[i]).map((a:any)=>a.id));
 const orders=s.rows.filter((r:any)=>r.type==='sales_order'&&agentIds.has(r.data.agentId)&&r.data.state!=='rejected');
 const contracts=s.rows.filter((r:any)=>r.type==='business_contract'&&(r.data.agentId?agentIds.has(r.data.agentId):agents.some((a:any)=>agentIds.has(a.id)&&normalize(r.data.party||'')===normalize(a.data.name||''))));
 const fileIds=new Set(intakes.flatMap((r:any)=>r.data.fileIds||[]));
 const files=s.rows.filter((r:any)=>r.type==='sales_file'&&(roles.sales&&agentIds.has(r.data.agentId)||fileIds.has(r.id))).map(publicSalesFile);
 const projectIds=new Set(intakes.map((r:any)=>r.data.projectId));
 return {roles,me:u.userId,orders:orders.map((r:any)=>({id:r.id,code:r.data.code,agentId:r.data.agentId,customer:agents.find((a:any)=>a.id===r.data.agentId)?.data.name||r.data.recipient?.name||'',state:r.data.state,items:r.data.lines.map((l:any,lineIndex:number)=>({lineIndex,productId:l.productId,productName:l.name,quantity:l.quantity,productionMode:productProductionMode(s.products.find((p:any)=>p.id===l.productId)||{})}))})),
  products:s.products.map((p:any)=>({id:p.id,name:p.name||p.model||p.code,productionMode:productProductionMode(p)})),contracts:contracts.map((r:any)=>({id:r.id,number:r.data.number,title:r.data.title,party:r.data.party,agentId:r.data.agentId||''})),templates:customerOrderForms(s.rows),intakes,files,
  projects:s.rows.filter((r:any)=>r.type==='build_project'&&projectIds.has(r.id)).map((r:any)=>({id:r.id,title:r.data.title,state:r.data.state,specificationPending:!!r.data.specificationPending,units:r.data.units.map((x:any)=>({title:x.title,approved:!!x.approved,quality:!!x.quality}))}))};
}
export async function buildIntakeApply(user:Session,b:any){
 const u=await live(user),roles=buildIntakeRoles(u),db=storage(),operationId=uuid(b.id);
 if(b.confirmed!==true||!buildIntakeModes.includes(b.mode)||!Number.isSafeInteger(b.revision)||b.revision<0)fail('تأیید عملیات و نسخه معتبر لازم است.');
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT payload,actor FROM inventory_operations WHERE id=?').bind(operationId).first();
 if(prior){if(prior.payload!==signature||prior.actor!==u.userId)fail('این شناسه متعلق به عملیات دیگری است.',409);const saved:any=await db.prepare("SELECT id,revision,data FROM flow_entities WHERE type='build_intake' AND (id=? OR json_extract(data,'$.history[#-1].operationId')=?)").bind(b.intakeId||operationId,operationId).first();return {saved:true,repeated:true,id:saved?.id||b.intakeId||operationId,revision:saved?.revision||0,projectId:saved?JSON.parse(saved.data).projectId||'':''};}
 const s=await buildIntakeSource(),old=b.intakeId?s.rows.find((r:any)=>r.type==='build_intake'&&r.id===b.intakeId):null;
 if(b.intakeId&&(!old||!await visible(u,old,s)))fail('فرم سفارش در دسترسی شما نیست.',404);
 if(b.revision!==(old?.revision||0))fail('نسخه فرم تغییر کرده است؛ تازه‌سازی کنید.',409);
 const id=old?.id||operationId,now=new Date().toISOString(),notes=text(b.notes??'',4000),mid=await memberId(u),stamp={operationId,mode:b.mode,actor:u.userId,actorName:u.name,memberId:mid,at:now,notes};
 const guards:D1PreparedStatement[]=[],writes:D1PreparedStatement[]=[];
 const guard=(q:string,...args:any[])=>guards.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+q+' THEN guard ELSE 0 END WHERE id=?').bind(...args,operationId));
 const rowGuard=(r:any)=>guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',r.id,r.revision);
 guard('COALESCE((SELECT revision FROM flow_entities WHERE id=?),0)=?',id,old?.revision||0);guards.push(leadMemberGuard(db,operationId,s.members));
 let d:any=old?structuredClone(old.data):null;
 if(b.mode==='save'){
  if(!roles.sales)fail('ثبت مشخصات مشتری به دسترسی فروش نیاز دارد.',403);
  if(old&&!['draft','returned'].includes(d.state))fail('این فرم برای ویرایش باز نیست.');
  const order=s.rows.find((r:any)=>r.type==='sales_order'&&r.id===text(b.orderId,200,true)),agent=s.rows.find((r:any)=>r.type==='sales_agent'&&r.id===order?.data.agentId);
  if(!order||!agent||!await salesVisible(u,agent)||order.data.state==='rejected')fail('سفارش متعلق به مشتری در دسترسی شما انتخاب کنید.',404);
  rowGuard(order);rowGuard(agent);
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>100)fail('حداقل یک محصول سفارش ساخت را انتخاب کنید.');
  const seen=new Set<string>(),sums=new Map<number,number>();
  const items=b.items.map((i:any)=>{
   if(!Number.isSafeInteger(i.lineIndex)||i.lineIndex<0)fail('ردیف سفارش معتبر انتخاب کنید.');const line=order.data.lines[i.lineIndex];
   if(!line||line.productId!==i.productId)fail('محصول باید متعلق به همین ردیف سفارش فروش باشد.');
   const product=s.products.find((p:any)=>p.id===i.productId);
   if(!product||productProductionMode(product)!=='project')fail('برای این محصول مسیر ساخت سفارشی بیمارستانی تعریف نشده است.');
   guard("EXISTS(SELECT 1 FROM records WHERE id=? AND kind='product' AND payload=?)",product.id,product.payload);
   if(!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>100)fail('تعداد تجهیز بین ۱ تا ۱۰۰ باشد.');
   sums.set(i.lineIndex,(sums.get(i.lineIndex)||0)+i.quantity);if((sums.get(i.lineIndex)||0)>line.quantity)fail('جمع تعداد فرم‌ها بیشتر از تعداد سفارش فروش است.');
   const itemId=uuid(i.id);if(seen.has(itemId))fail('شناسه ردیف تکراری است.');seen.add(itemId);
   const snapshot=snapshotCustomerOrderForm(s.rows,text(i.templateId,200,true),product.id,i.values||{},false);
   const template=s.rows.find((r:any)=>r.id===snapshot.template.id);rowGuard(template);
   return {id:itemId,lineIndex:i.lineIndex,productId:product.id,productName:line.name,quantity:i.quantity,templateId:snapshot.template.id,template:snapshot.template,values:snapshot.answers};
  });
  if(items.reduce((n:number,i:any)=>n+i.quantity,0)>100)fail('هر پروژه حداکثر ۱۰۰ تجهیز دارد؛ مراحل تحویل را جدا تعریف کنید.');
  const contractId=text(b.contractId??'',200),contract=contractId?s.rows.find((r:any)=>r.type==='business_contract'&&r.id===contractId):null;
  if(contractId&&(!contract||contract.data.agentId&&contract.data.agentId!==agent.id||!contract.data.agentId&&normalize(contract.data.party||'')!==normalize(agent.data.name||'')))fail('قرارداد باید متعلق به همین خریدار باشد.');
  if(contract)rowGuard(contract);
  if(d?.projectId){
   if(order.id!==d.orderId||contractId!==d.contractId||JSON.stringify(items.map((i:any)=>[i.id,i.lineIndex,i.productId,i.quantity]))!==JSON.stringify(d.items.map((i:any)=>[i.id,i.lineIndex,i.productId,i.quantity])))fail('در بازنگری پروژه، هویت سفارش و تعداد تجهیزات ثابت است؛ برای اقلام جدید سفارش و مرحله ساخت جدا ثبت کنید.');
  }
  if(b.fileIds!==undefined&&!Array.isArray(b.fileIds))fail('فهرست پیوست معتبر انتخاب کنید.');const fileIds=Array.isArray(b.fileIds)?b.fileIds:[];if(fileIds.length>30||new Set(fileIds).size!==fileIds.length)fail('پیوست‌های یکتا انتخاب کنید.');
  for(const fileId of fileIds){const f=s.rows.find((r:any)=>r.type==='sales_file'&&r.id===fileId&&r.data.agentId===agent.id);if(!f)fail('پیوست باید از مدارک همین مشتری باشد.');rowGuard(f);}
  d={...(d||{}),title:text(b.title,200,true),orderId:order.id,orderCode:order.data.code,agentId:agent.id,customer:agent.data.name,contractId,contractNumber:contract?.data.number||'',due:date(b.due,false),items,fileIds,notes,state:'draft',ownerId:d?.ownerId||mid,createdBy:d?.createdBy||u.userId,projectId:d?.projectId||'',versions:d?.versions||[],history:d?.history||[]};
 }else{
  if(!d)fail('ابتدا فرم سفارش را ذخیره کنید.');
  const order=s.rows.find((r:any)=>r.type==='sales_order'&&r.id===d.orderId),agent=s.rows.find((r:any)=>r.type==='sales_agent'&&r.id===d.agentId),contract=s.rows.find((r:any)=>r.type==='business_contract'&&r.id===d.contractId);
  if(!order||!agent||!agent.data.active)fail('سفارش یا خریدار فعال در دسترس نیست.');rowGuard(order);rowGuard(agent);
  const project=d.projectId?s.rows.find((r:any)=>r.type==='build_project'&&r.id===d.projectId):null;
  if(d.projectId&&!project)fail('پروژه متصل در دسترس نیست.',409);
  if(b.mode==='submit'||b.mode==='approve'||b.mode==='technical_accept'){
   if(!['sales_approved','approved'].includes(order.data.state))fail('ابتدا پیش‌فاکتور فروش تأیید شود.');
   if(!contract||contract.data.agentId&&contract.data.agentId!==agent.id||!contract.data.agentId&&normalize(contract.data.party||'')!==normalize(agent.data.name||''))fail('قرارداد همین خریدار را انتخاب کنید.');rowGuard(contract);date(d.due,true);
   for(const i of d.items){const product=s.products.find((p:any)=>p.id===i.productId),line=order.data.lines[i.lineIndex];if(!product||productProductionMode(product)!=='project'||line?.productId!==i.productId)fail('محصول یا ردیف سفارش تغییر کرده است.',409);guard("EXISTS(SELECT 1 FROM records WHERE id=? AND payload=?)",product.id,product.payload);const checked=snapshotCustomerOrderForm(s.rows,i.templateId,i.productId,i.values,true);if(JSON.stringify(checked.template)!==JSON.stringify(i.template))fail('نسخه فرم محصول تغییر کرده است؛ پیش‌نویس را بازبینی کنید.',409);rowGuard(s.rows.find((r:any)=>r.id===i.templateId));}
   for(const index of new Set(d.items.map((i:any)=>i.lineIndex))){const count=d.items.filter((i:any)=>i.lineIndex===index).reduce((n:number,i:any)=>n+i.quantity,0),other=s.rows.filter((r:any)=>r.type==='build_intake'&&r.id!==id&&r.data.orderId===d.orderId&&(r.data.projectId||['technical_review','commercial_review','approved'].includes(r.data.state))).flatMap((r:any)=>r.data.items).filter((i:any)=>i.lineIndex===index).reduce((n:number,i:any)=>n+i.quantity,0);if(count+other>order.data.lines[index as number].quantity)fail('این تعداد قبلاً در فرم یا پروژه دیگری از همین سفارش تخصیص یافته است.',409);}
   for(const fId of d.fileIds||[]){const f=s.rows.find((r:any)=>r.type==='sales_file'&&r.id===fId&&r.data.agentId===agent.id);if(!f)fail('پیوست سفارش در دسترس نیست.',409);rowGuard(f);}
  }
  if(b.mode==='submit'){
   if(!roles.sales||!await salesVisible(u,agent))fail('دسترسی ارسال این سفارش ندارید.',403);if(!['draft','returned'].includes(d.state))fail('فقط پیش‌نویس برای بررسی ارسال می‌شود.');d.state='technical_review';d.technicalReview=null;
   if(!contract!.data.agentId){writes.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify({...contract!.data,agentId:agent.id}),now,contract!.id),db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,contract!.id,'contract_customer_link',JSON.stringify(contract!.data),JSON.stringify({...contract!.data,agentId:agent.id}),now));}
  }else if(b.mode==='technical_accept'){
   if(!roles.engineering)fail('بررسی مشخصات به نقش فنی نیاز دارد.',403);if(d.state!=='technical_review')fail('فرم در مرحله بررسی فنی نیست.');if(!notes)fail('نتیجه بررسی فنی و زمان قابل‌تعهد را بنویسید.');d.technicalReview=stamp;d.state='commercial_review';
  }else if(b.mode==='return'){
   if(!(d.state==='technical_review'&&roles.engineering||d.state==='commercial_review'&&roles.manager))fail('دسترسی برگشت این مرحله ندارید.',403);if(!notes)fail('موارد نیازمند اصلاح را بنویسید.');d.state='returned';
  }else if(b.mode==='revise'){
   if(!roles.sales||!await salesVisible(u,agent)||d.state!=='approved')fail('بازنگری مشخصات به دسترسی فروش و فرم تأییدشده نیاز دارد.',403);if(project?.data.state==='closed')fail('ابتدا مالی پروژه بسته را بازگشایی کند.');if(!notes)fail('علت بازنگری مشخصات را بنویسید.');d.state='draft';d.technicalReview=null;
   if(project){rowGuard(project);writes.push(db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify({...project.data,specificationPending:true}),now,project.id));}
  }else if(b.mode==='approve'){
   if(!roles.manager)fail('تأیید شروع ساخت به نقش مدیریت نیاز دارد.',403);if(d.state!=='commercial_review'||!d.technicalReview)fail('ابتدا بررسی فنی تکمیل شود.');if(project?.data.state==='closed')fail('پروژه بسته است.');
   d.state='approved';d.projectId=d.projectId||'build:'+id;d.versions.push({number:d.versions.length+1,title:d.title,due:d.due,items:structuredClone(d.items),fileIds:[...(d.fileIds||[])],technicalReview:d.technicalReview,...stamp});d.specVersion=d.versions.length;
   const priorData=project?.data,evidenceChanged=!!priorData&&JSON.stringify(priorData.customerRequirements?.fileIds||[])!==JSON.stringify(d.fileIds||[]),p:any=priorData?structuredClone(priorData):{state:'open',ownerId:d.technicalReview.memberId||mid,units:[],budgets:[],remaining:null,requests:[],movements:[],times:[],expenses:[],commitments:[],issues:[],closes:[],history:[]};
   Object.assign(p,{title:d.title,customer:d.customer,contract:d.contractNumber,contractId:d.contractId,salesOrderId:d.orderId,agentId:d.agentId,buildIntakeId:id,due:d.due,specificationPending:false,customerRequirements:{version:d.versions.length,items:structuredClone(d.items),fileIds:[...(d.fileIds||[])]}});
   if(project){rowGuard(project);for(const x of p.units){const i=d.items.find((i:any)=>i.id===x.specItemId);if(i){if(evidenceChanged||JSON.stringify(x.customerSpecification?.values)!==JSON.stringify(i.values)||JSON.stringify(x.customerSpecification?.template)!==JSON.stringify(i.template)){x.approved=null;x.quality=null;}x.customerSpecification={template:i.template,values:i.values,version:d.versions.length};}}}
   else for(const i of d.items)for(let n=0;n<i.quantity;n++)p.units.push({id:crypto.randomUUID(),title:i.productName+' · '+(n+1),productId:i.productId,specItemId:i.id,customerSpecification:{template:i.template,values:i.values,version:d.versions.length},bomId:'',bomVersion:null,lines:[],versions:[{number:1,lines:[],...stamp}],approved:null,quality:null});
   p.history.push({...stamp,mode:'customer_specification_approved',intakeId:id,version:d.versions.length});
   writes.push(project?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(JSON.stringify(p),now,project.id):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'build_project',?,1,?,?)").bind(d.projectId,JSON.stringify(p),now,now));
  }
 }
 d.technicalNote=d.technicalReview?.notes||'';
 d.history.push(stamp);
 // A shared sales lock and complete source revisions prevent competing quantity claims.
 for(const r of s.rows.filter((r:any)=>r.type==='build_intake'))rowGuard(r);
 const memberUser=(m:any)=>({isAdmin:false,userId:m.subject||'local:'+m.id,permissions:storedAccessPermissions(m.permissions)} as Session);
 const buyer=s.rows.find((r:any)=>r.type==='sales_agent'&&r.id===d.agentId);
 const returnCandidates=[buyer?.data.ownerId,d.ownerId].filter((v:any,i:number,a:any[])=>v&&a.indexOf(v)===i);
 let returnedTo='';if(d.state==='returned')for(const candidate of returnCandidates){const m=s.members.find((m:any)=>m.id===candidate&&m.status==='active');if(m&&buildIntakeRoles(memberUser(m)).sales&&await visible(memberUser(m),{data:d},s)){returnedTo=m.id;break;}}
 const recipients=s.members.filter((m:any)=>m.status==='active'&&(d.state==='technical_review'?buildIntakeRoles(memberUser(m)).engineering:d.state==='commercial_review'?buildIntakeRoles(memberUser(m)).manager:d.state==='returned'?m.id===returnedTo:d.state==='approved'?buildIntakeRoles(memberUser(m)).engineering:false));
 const instructions=d.state==='technical_review'?'نیاز مشتری، امکان ساخت و موعد را بررسی کنید؛ نقص را برگردانید یا نتیجه فنی را ثبت کنید.':d.state==='commercial_review'?'سفارش فروش، قرارداد و نتیجه فنی را بررسی و شروع پروژه را تأیید یا برگشت دهید.':d.state==='returned'?'موارد برگشت را اصلاح کنید و فرم را دوباره برای بررسی بفرستید.':'مشخصات مصوب مشتری را به BOM پروژه تبدیل کنید؛ شروع مصرف مواد نیازمند تأیید BOM است.';
 d.unassignedWork=recipients.length?'':instructions;
 writes.push(db.prepare("UPDATE duty_runs SET state='completed',revision=revision+1,updated=? WHERE template_id=? AND state NOT IN ('completed','cancelled')").bind(now,'build-intake:'+id));
 for(const m of recipients)writes.push(db.prepare("INSERT INTO duty_runs(id,template_id,period,assignee,due,state,data,revision,created,updated) VALUES(?,?,?,?,?,'open',?,1,?,?) ON CONFLICT(id) DO UPDATE SET state='open',data=excluded.data,revision=duty_runs.revision+1,updated=excluded.updated").bind('build-intake:'+id+':'+d.state+':'+m.id,'build-intake:'+id,d.state,m.id,new Date(Date.parse(now)+48*3600000).toISOString(),JSON.stringify({title:d.title+' · '+buildIntakeStates[d.state],sourceSection:d.state==='approved'?'build-projects':'build-intake',sourceId:d.state==='approved'?d.projectId:id,sourcePlanId:d.state==='approved'?d.projectId:'',buildIntakeWorkflow:true,instructions,evidence:'text',history:[]}),now,now));
 for(const m of recipients)writes.push(notice('build-intake:'+id+':'+d.state+':'+m.id,m.id,operationId,d.title+' · '+instructions,now));
 const data=JSON.stringify(d);
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(operationId,'build_intake_'+b.mode,signature,u.userId,now),...guards,...await salesLock(db,operationId),old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=?').bind(data,now,id):db.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'build_intake',?,1,?,?)").bind(id,data,now,now),...writes,db.prepare('INSERT INTO access_audit(id,actor,target,action,before,after,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,id,'build_intake_'+b.mode,old?JSON.stringify(old.data):null,data,now)]);
 return {saved:true,id,revision:(old?.revision||0)+1,projectId:d.projectId};
}
