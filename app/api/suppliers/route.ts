import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {storage} from '@/lib/storage';
import {boundedBody} from '@/lib/firmware-storage';
import {taskRequired as req,taskText as txt,dayAt,validDay} from '@/lib/duties';
import {scaled} from '@/lib/production';
import {supplierRead,supplierManage,supplierQuality,supplierCommercial,supplierRoute,supplierRows,supplierEntity,supplierMetrics,qualification,supplierEvidenceBlock} from '@/lib/suppliers';
import {supplierFields,supplierStates,supplierRisks,supplierHelp} from '@/lib/supplier-contract';
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(s:string,status=400):never=>{throw new AccessError(s,status)};
export async function GET(request:Request){try{
 const u=await requireAccess();if(!supplierRead(u))fail('دسترسی تأمین‌کنندگان ندارید.',403);
 const materialId=new URL(request.url).searchParams.get('material')||'',suppliers=(await supplierRows('supplier')).filter(s=>supplierRoute(u,s.data.route)),materials=await supplierRows('material'),reviews=await supplierRows('supplier_review'),documents=await supplierRows('supplier_document'),links=(await supplierRows('supplier_material')).filter(l=>(!materialId||l.data.materialId===materialId)&&suppliers.some(s=>s.id===l.data.supplierId));
 const items=await Promise.all(links.map(async l=>{const s=suppliers.find(s=>s.id===l.data.supplierId)!,m=materials.find(m=>m.id===l.data.materialId),commercial=supplierCommercial(u,s.data.route),rs=reviews.filter(r=>r.data.linkId===l.id);return {...l,documents:documents.filter(d=>d.data.supplierId===s.id&&(!d.data.linkId||d.data.linkId===l.id)&&d.data.state==='approved'&&(!d.data.expiresOn||d.data.expiresOn>=dayAt())&&(d.data.visibility!=='commercial'||commercial)).map(d=>({id:d.id,title:d.data.title,version:d.data.version})),metrics:await supplierMetrics(l),block:m?(qualification(l,s,m)||await supplierEvidenceBlock(l)):'کالا موجود نیست',reviews:rs.map(r=>commercial?r:{...r,data:{...r.data,scores:undefined,score:undefined}}),commercial};}));
 const orders=(await supplierRows('purchase_order')).filter(o=>links.some(l=>l.id===o.data.supplierLinkId)).map(o=>supplierCommercial(u,o.data.route)?o:{id:o.id,created:o.created,data:{supplierLinkId:o.data.supplierLinkId,state:o.data.state,quantity:o.data.quantity,unit:o.data.unit,eta:o.data.promisedEta||o.data.eta}});
 return json({suppliers,links:items,orders,materials:materials.map(m=>({id:m.id,...m.data,revision:m.revision})),canManage:supplierManage(u),canQuality:supplierQuality(u),help:supplierHelp});
 }catch(e){return accessResponse(e)||json({error:'دریافت تأمین‌کنندگان انجام نشد.'},503)}}
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();if(!supplierRead(u))fail('دسترسی ندارید.',403);const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,40000))),db=storage(),id=req(b.id,80),mode=req(b.mode,30),now=new Date().toISOString();
 if(!/^[0-9a-f-]{36}$/i.test(id)||b.confirmed!==true)fail('شناسه و تأیید صریح عملیات لازم است.');
 if(mode==='review'?!supplierQuality(u):!supplierManage(u))fail('مجوز این اقدام را ندارید.',403);
 const signature=JSON.stringify(b),prior:any=await db.prepare('SELECT actor,payload FROM inventory_operations WHERE id=?').bind(id).first();if(prior){if(prior.actor!==u.userId||prior.payload!==signature)fail('شناسه عملیات قبلاً استفاده شده است.',409);return json({saved:true,repeated:true});}
 const statements:D1PreparedStatement[]=[],checks:D1PreparedStatement[]=[];
 const guard=(q:string,...p:any[])=>checks.push(db.prepare('UPDATE inventory_operations SET guard=CASE WHEN '+q+' THEN guard ELSE 0 END WHERE id=?').bind(...p,id));
 const get=async(eid:string,type:string)=>{const e=await supplierEntity(eid,type);guard('EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND revision=?)',e.id,e.revision);return e;};
 const put=(eid:string,type:string,data:any,old?:any)=>statements.push(old?db.prepare('UPDATE flow_entities SET data=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,eid,old.revision):db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(eid,type,JSON.stringify(data),now,now));
 let target=id;
 if(mode==='supplier'){
  const old=b.supplierId?await get(req(b.supplierId),'supplier'):null;if(old&&b.revision!==old.revision)fail('پرونده تغییر کرده است.',409);
  const route=req(b.route);if(!['domestic','foreign'].includes(route)||!supplierRoute(u,route)||old&&!supplierRoute(u,old.data.route))fail('مجوز مسیر تأمین را ندارید.',403);if(old&&old.data.route!==route)fail('مسیر پرونده ثابت است؛ برای مسیر دیگر پرونده جدا بسازید.');
  if(!['manufacturer','trader'].includes(b.kind)||typeof b.active!=='boolean')fail('نوع و وضعیت تأمین‌کننده معتبر نیست.');
  const d:any={route,kind:b.kind,active:b.active};for(const k of Object.keys(supplierFields))d[k]=txt(b[k]||'',k==='notes'?3000:500);for(const k of ['name','country','contact','phone'])if(!d[k])fail('نام، کشور، مسئول تماس و تلفن لازم است.');if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))fail('ایمیل معتبر نیست.');target=old?.id||id;put(target,'supplier',d,old);
 }else if(mode==='link'){
  const s=await get(req(b.supplierId),'supplier'),m=await get(req(b.materialId),'material');if(!supplierRoute(u,s.data.route))fail('مجوز مسیر ندارید.',403);
  guard("NOT EXISTS(SELECT 1 FROM flow_entities WHERE type='supplier_material' AND json_extract(data,'$.supplierId')=? AND json_extract(data,'$.materialId')=?)",s.id,m.id);
  put(id,'supplier_material',{supplierId:s.id,materialId:m.id,partCode:m.data.code,supplierCode:txt(b.supplierCode||'',100),status:'pending',specs:m.data.specs||'',unit:m.data.unit,qualityRisk:'high',supplyRisk:'high',reviewDue:'',supplierRevision:s.revision,notes:txt(b.notes||'',3000)});
 }else if(mode==='review'){
  const l=await get(req(b.linkId),'supplier_material'),s=await get(l.data.supplierId,'supplier'),m=await get(l.data.materialId,'material');target=l.id;if(b.revision!==l.revision)fail('نسخه ارزیابی تغییر کرده است.',409);
  if(!Object.hasOwn(supplierStates,b.status)||!Object.hasOwn(supplierRisks,b.qualityRisk)||!Object.hasOwn(supplierRisks,b.supplyRisk))fail('وضعیت و ریسک معتبر لازم است.');
  const reviewDue=req(b.reviewDue,10);if(!validDay(reviewDue)||reviewDue<dayAt())fail('موعد بازبینی معتبر لازم است.');const rationale=req(b.rationale,3000),evidence=req(b.evidence,3000),restrictions=txt(b.restrictions||'',2000);
  const maxQuantity=b.status==='conditional'?scaled(b.maxQuantity):0;if(b.status==='conditional'&&(!restrictions||maxQuantity<=0))fail('خرید مشروط به سقف مقدار و شرح کنترل اضافی نیاز دارد.');
  const metrics=await supplierMetrics(l),scores:any={};for(const k of ['quality','delivery','cost','response','documents']){const v=b.scores?.[k];if(v!==undefined&&v!==null&&v!==''){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)fail('امتیاز باید بین صفر و صد باشد.');scores[k]=v;}else scores[k]=null;}
  const score=Object.values(scores).every(v=>v!==null)?Math.round(scores.quality*.4+scores.delivery*.2+scores.cost*.2+scores.response*.1+scores.documents*.1):null;
  const documentIds=b.documentIds||[];if(!Array.isArray(documentIds)||documentIds.length>20||new Set(documentIds).size!==documentIds.length)fail('فهرست مدارک معتبر نیست.');const documents=[];for(const did of documentIds){const doc=await get(req(did),'supplier_document');if(doc.data.supplierId!==s.id||doc.data.linkId&&doc.data.linkId!==l.id||doc.data.visibility==='commercial'&&!supplierCommercial(u,s.data.route)||doc.data.state!=='approved'||doc.data.expiresOn&&doc.data.expiresOn<dayAt())fail('مدرک معتبر و تأییدشده همین تأمین‌کننده لازم است.');documents.push({id:doc.id,revision:doc.revision,sha256:doc.data.sha256,filename:doc.data.filename});}
  const data={...l.data,status:b.status,qualityRisk:b.qualityRisk,supplyRisk:b.supplyRisk,reviewDue,restrictions,maxQuantity,specs:m.data.specs||'',unit:m.data.unit,supplierRevision:s.revision,lastReviewId:id};
  put(id,'supplier_review',{linkId:l.id,supplierId:s.id,materialId:m.id,status:b.status,qualityRisk:b.qualityRisk,supplyRisk:b.supplyRisk,rationale,evidence,reviewDue,restrictions,maxQuantity,scores,score,formula:'40/20/20/10/10-v1',metrics,documents,specs:data.specs,supplierSnapshot:s.data,by:u.userId,at:now});put(l.id,'supplier_material',data,l);
 }else fail('عملیات ناشناخته است.');
 await db.batch([db.prepare('INSERT INTO inventory_operations(id,kind,payload,actor,created,guard) VALUES(?,?,?,?,?,1)').bind(id,'supplier_'+mode,signature,u.userId,now),...checks,...statements,db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),u.userId,target,'supplier_'+mode,signature,now)]);
 return json({saved:true,id:target});
 }catch(e){return accessResponse(e)||json({error:/constraint|SQLITE|D1/i.test(String(e))?'اطلاعات هم‌زمان تغییر کرده یا ارتباط تکراری است؛ تازه‌سازی کنید.':e instanceof Error?e.message:'ثبت انجام نشد.'},409)}}
