import {syncMaterialTasks} from '@/lib/material-tasks';
import {warehouseDirectory,canReceiveWarehouse} from '@/lib/material-warehouses';
import {requireAccess,checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {foreignRoles,foreignRows,foreignPublic,foreignApply,foreignFileVisible,memberRole,foreignFail,installForeignPosition,foreignBy} from '@/lib/foreign-purchase';
import {foreignAlerts,foreignLabels,foreignHelp,foreignSelectionStates,foreignPhysicalStates,foreignMoney,foreignMoneyText} from '@/lib/foreign-purchase-contract';
import {supplierRows,supplierIdentityView,supplierCommercial} from '@/lib/suppliers';
import {leadMembers} from '@/lib/sales-leads';
import {dayAt} from '@/lib/duties';
import {syncForeignTasks} from '@/lib/foreign-purchase-tasks';
import {storage} from '@/lib/storage';
import {sourcingPage,sourcingPageSize} from '@/lib/sourcing-list-page';
const json=(v:any,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
export async function GET(request:Request){try{
 const u=await requireAccess(),roles=foreignRoles(u);
 if(!roles.read)foreignFail('دسترسی بازرگانی خارجی ندارید.',403);
 const q=new URL(request.url).searchParams,search=(q.get('search')||'').trim().toLowerCase().slice(0,160),view=q.get('view')||'';
 if(view&&!['shipments','selection','detail','options','alerts','statements','statement-files'].includes(view))foreignFail('نمای بازرگانی معتبر نیست.');
 const base={warehouses:[],roles,shipments:[],selections:[],files:[],suppliers:[],materials:[],links:[],members:[],alerts:[],candidates:[],statements:[],today:dayAt(),help:foreignHelp,selectionStates:foreignSelectionStates,physicalStates:foreignPhysicalStates};
 if(view==='shipments'||view==='selection'){
  const page=sourcingPage(q),shipment=view==='shipments';
  const title=shipment?'title':'name';
  const matches=shipment?" OR EXISTS(SELECT 1 FROM json_each(e.data,'$.initial.lines') line WHERE instr(lower(coalesce(json_extract(line.value,'$.name'),'')),?)>0 OR instr(lower(coalesce(json_extract(line.value,'$.code'),'')),?)>0)":" OR instr(lower(coalesce(json_extract(e.data,'$.code'),'')),?)>0";
  const params=shipment?[search,search]:[search];
  const field=shipment?'$.foreign.physical':'$.state';
  const results=(await storage().prepare(`SELECT e.id,json_extract(e.data,'$.${title}') AS title,
   json_extract(e.data,'$.supplierName') AS supplier,json_extract(e.data,'${field}') AS stage
   FROM flow_entities e WHERE ${shipment?"e.type='purchase_shipment' AND json_extract(e.data,'$.route')='foreign'":"e.type='foreign_selection'"}
   AND (?='' OR instr(lower(coalesce(json_extract(e.data,'$.${title}'),'')),?)>0
    OR instr(lower(coalesce(json_extract(e.data,'$.supplierName'),'')),?)>0 OR instr(lower(e.id),?)>0${matches})
   ORDER BY e.created,e.id LIMIT ? OFFSET ?`).bind(search,search,search,search,...params,sourcingPageSize+1,(page-1)*sourcingPageSize)
   .all<{id:string;title:string;supplier:string|null;stage:string|null}>()).results;
  const summaries=results.slice(0,sourcingPageSize);
  return json({...base,hasMore:results.length>sourcingPageSize,
   shipments:shipment?summaries.map(s=>({id:s.id,data:{title:s.title,supplierName:s.supplier},labels:{physical:foreignPhysicalStates[s.stage||'planned']}})):[],
   selections:shipment?[]:summaries.map(s=>({id:s.id,data:{name:s.title,supplierName:s.supplier,state:s.stage}}))});
 }
 if(view==='statements'){
  if(!roles.commercial)foreignFail('دسترسی به حساب صراف ندارید.',403);
  const page=sourcingPage(q);
  const rows=(await storage().prepare(`SELECT id,json_extract(data,'$.account') AS account,
   json_extract(data,'$.from') AS "from",json_extract(data,'$.to') AS "to",json_array_length(data,'$.rowIds') AS rowCount
   FROM flow_entities WHERE type='foreign_statement' ORDER BY created,id LIMIT ? OFFSET ?`).bind(sourcingPageSize+1,(page-1)*sourcingPageSize).all<{id:string}>()).results;
  return json({...base,statements:rows.slice(0,sourcingPageSize).map(({id,...data})=>({id,data})),hasMore:rows.length>sourcingPageSize});
 }
 if(view==='statement-files'){
  if(!roles.finance)foreignFail('مجوز مالی لازم است.',403);
  const files=await supplierRows('foreign_file',`json_extract(entity.data,'$.kind')='fx_statement'
   AND EXISTS(SELECT 1 FROM flow_entities shipment WHERE shipment.id=json_extract(entity.data,'$.caseId')
    AND shipment.type='purchase_shipment' AND json_extract(shipment.data,'$.route')='foreign')`);
  return json({files:files.map(f=>({id:f.id,data:{kind:f.data.kind,filename:f.data.filename,reference:f.data.reference}}))});
 }
 if(view==='options'&&!roles.buyer)foreignFail('مجوز بازرگانی لازم است.',403);
 const detail=view==='detail'?await foreignBy(u,q.get('id')||''):null;
 const scopedFiles=detail?Promise.all(['foreign_file','shipment_file'].map(type=>supplierRows(type,"coalesce(json_extract(entity.data,'$.caseId'),json_extract(entity.data,'$.shipmentId'))=?",detail.id))).then(groups=>groups.flat()):null;
 const scopedStatementRows=detail&&roles.finance&&detail.data.foreign?.fxPurchases?.some((p:any)=>!p.received)
  ?supplierRows('foreign_statement_row',`entity.id IN (SELECT statement.id FROM json_each(?) p
    JOIN flow_entities statement ON statement.type='foreign_statement_row'
    AND json_extract(statement.data,'$.account')=json_extract(p.value,'$.account')
    AND json_extract(statement.data,'$.currency')=json_extract(p.value,'$.currency')
    AND json_extract(statement.data,'$.day')>=json_extract(p.value,'$.day'))`,JSON.stringify(detail.data.foreign.fxPurchases.filter((p:any)=>!p.received)))
  :Promise.resolve([]);
 let rows:any[];
 if(detail)rows=[detail,...await scopedFiles!,...await scopedStatementRows];
 else if(view==='alerts'){
  const [assigned,coverage]=await Promise.all([
   supplierRows('purchase_shipment',`json_extract(entity.data,'$.route')='foreign' AND
    (json_extract(entity.data,'$.foreign.physical') IN ('ordered','preparing','cleared')
    OR EXISTS(SELECT 1 FROM json_each(entity.data,'$.foreign.fxPurchases') p
     WHERE NOT coalesce(json_extract(p.value,'$.received'),0)
     OR json_extract(p.value,'$.closed') IS NULL OR json_extract(p.value,'$.closed')=0))`),
   storage().prepare(`SELECT json_extract(data,'$.account') AS account,
    json_extract(data,'$.from') AS "from",json_extract(data,'$.to') AS "to"
    FROM flow_entities WHERE type='foreign_statement'`).all(),
  ]);
  rows=[...assigned,...coverage.results.map(data=>({type:'foreign_statement',data}))];
 }
 else rows=view==='options'?[]:await foreignRows();
 const all=rows.filter(r=>r.type==='purchase_shipment'&&r.data.route==='foreign');
 const shipments=all.filter(s=>(!q.get('id')||s.id===q.get('id'))&&(!search||JSON.stringify({title:s.data.title,supplier:s.data.supplierName,lines:s.data.initial.lines}).toLowerCase().includes(search)));
 const selections=rows.filter(r=>r.type==='foreign_selection'&&(!search||JSON.stringify(r.data).toLowerCase().includes(search)));
 const statements=rows.filter(r=>r.type==='foreign_statement'),statementRows=rows.filter(r=>r.type==='foreign_statement_row');
 const files=rows.filter(r=>['foreign_file','shipment_file'].includes(r.type)&&rows.some(s=>s.id===(r.data.caseId||r.data.shipmentId)&&s.type==='purchase_shipment'&&s.data.route==='foreign'||s.id===r.data.caseId&&s.type==='foreign_selection')&&foreignFileVisible(u,r.data)).map(r=>({...r,data:{...r.data,caseId:r.data.caseId||r.data.shipmentId,objectKey:undefined,signature:undefined}}));
 const materialId=detail?.type==='foreign_selection'?detail.data.materialId:'';
 const linkRows=materialId?await supplierRows('supplier_material',"json_extract(entity.data,'$.materialId')=?",materialId):!view?await supplierRows('supplier_material'):[];
 const supplierIds=[...new Set(linkRows.map(l=>l.data.supplierId))];
 const supplierList=(!view?await supplierRows('supplier'):supplierIds.length?await supplierRows('supplier',"entity.id IN (SELECT value FROM json_each(?))",JSON.stringify(supplierIds)):[]).filter(s=>s.data.route==='foreign');
 const materials=!view||view==='options'?await supplierRows('material'):materialId?await supplierRows('material','entity.id=?',materialId):[];
 const links=linkRows.filter(l=>supplierList.some(s=>s.id===l.data.supplierId)).map(l=>({...l,data:supplierCommercial(u,'foreign')?l.data:{...l.data,commercialDetails:undefined,notes:undefined},material:materials.find(m=>m.id===l.data.materialId)}));
 const members=(!view||detail||view==='options'?await leadMembers():[]).filter(m=>m.status==='active').map(m=>({id:m.id,name:m.name,roles:['buyer','manager','engineering','finance','inventory','logistics'].filter(r=>memberRole(m,r))}));
 const alerts=all.flatMap(s=>foreignAlerts(s,statements,dayAt()).filter(a=>roles.commercial||a.role==='inventory'&&roles.inventory||a.role==='logistics'&&roles.logistics).map(a=>({...a,caseId:s.id,title:a.title+' · '+s.data.title})));const candidates=roles.commercial?shipments.flatMap(s=>(s.data.foreign?.fxPurchases||[]).filter((p:any)=>!p.received).map((p:any)=>({caseId:s.id,fxId:p.id,rows:statementRows.filter(r=>r.data.account===p.account&&r.data.currency===p.currency&&r.data.day>=p.day&&!p.matches.some((x:any)=>x.rowId===r.id)&&foreignMoney(r.data.amount)>(r.data.allocations||[]).reduce((n:bigint,x:any)=>n+foreignMoney(x.amount),BigInt(0))).map(r=>({...r,available:foreignMoneyText(foreignMoney(r.data.amount)-(r.data.allocations||[]).reduce((n:bigint,x:any)=>n+foreignMoney(x.amount),BigInt(0))),exactReference:!!p.expectedReference&&r.data.reference===p.expectedReference}))}))):[];
 return json({...base,warehouses:(!view||detail?.type==='purchase_shipment'?await warehouseDirectory():[]).filter(w=>w.data.active&&canReceiveWarehouse(u,w)),shipments:view==='alerts'?[]:shipments.map(s=>foreignPublic(u,s)),selections,files,suppliers:supplierList.map(s=>supplierIdentityView(u,s)),materials:materials.map(m=>({id:m.id,...m.data,revision:m.revision})),links,members,alerts,candidates,statements:roles.commercial&&view!=='alerts'?statements:[]});}catch(e){return accessResponse(e)||json({error:'دریافت پرونده خارجی ممکن نشد.'},503);}}
export async function POST(request:Request){try{checkOrigin(request);const u=await requireAccess(),b=JSON.parse(new TextDecoder().decode(await boundedBody(request,220000))),saved=await foreignApply(u,b);try{await syncForeignTasks();}catch(e){console.error('Foreign task projection deferred',e);}if(b.mode==='receive'){try{await syncMaterialTasks();}catch(e){console.error('Material QC task projection deferred',e);return json({...saved,followupPending:true});}}return json(saved);}catch(e){return accessResponse(e)||json({error:e instanceof Error&&!/SQLITE|D1|constraint/i.test(e.message)?e.message:'ثبت انجام نشد؛ تازه‌سازی و با همان شناسه تلاش کنید.'},409);}}
