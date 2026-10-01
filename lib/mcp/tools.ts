import * as assistantActions from '@/app/api/assistant/actions/route';
import * as flow from '@/app/api/flow/route';
import * as assistant from "@/app/api/assistant/route";
import * as production from "@/app/api/production/route";
import * as records from '@/app/api/records/route';
import * as serials from '@/app/api/serials/route';
import * as printing from '@/app/api/serials/print/route';
import * as batches from '@/app/api/batch-suggestion/route';
import * as batchFiles from '@/app/api/batch-files/route';
import * as distribution from '@/app/api/distribution/route';
import * as firmware from '@/app/api/firmware/route';
import * as firmwareFiles from '@/app/api/firmware/files/route';
import * as templates from '@/app/api/quality/templates/route';
import * as reports from '@/app/api/quality/reports/route';
import * as qualityFiles from '@/app/api/quality/files/route';
import * as finance from '@/app/api/finance/route';
import * as financeFiles from '@/app/api/finance/files/route';
import * as analytics from '@/app/api/device-analytics/route';
import * as users from '@/app/api/users/route';
import * as llm from '@/app/api/llm-config/route';
import {fields,editable,adminBatchEditable,type Kind} from '@/lib/model';
import {financeReports} from '@/lib/finance-control';
import {can,AccessError} from '@/lib/authorization';
import {mcpActor} from './context';
import type {McpPrincipal} from './auth';
import {storage} from '@/lib/storage';

type Schema=Record<string,any>;
const text=(description='',maxLength=4000):Schema=>({type:'string',description,maxLength});
const enumeration=(values:string[]):Schema=>({type:'string',enum:values});
const obj=(properties:Record<string,Schema>,required=Object.keys(properties)):Schema=>({type:'object',properties,required,additionalProperties:false});
const list=(items:Schema,maxItems=500):Schema=>({type:'array',items,maxItems});
const integer=(minimum:number,maximum:number):Schema=>({type:'integer',minimum,maximum});
const id=text('Record ID (not a serial number).',200);
const data:Schema={type:'object',additionalProperties:text(),maxProperties:80,description:'Field-name/string-value map. Call get_record_schema for required fields, options, references and editable fields. Dates: Gregorian YYYY-MM-DD; numeric values as strings.'};
const confirmed={type:'boolean',const:true,description:'True only after the user has approved these exact changes.'};
const payload=(extra:Record<string,Schema>)=>obj({...extra,confirmed});
const kinds=['product','batch','device','event','service','action','distribution','firmware'];
const period={cadence:enumeration(['daily','weekly']),period:text('Gregorian YYYY-MM-DD. Weekly periods start on Saturday.',10)};
const perms=obj({flowRoles:list(enumeration(['inventory','qc','production','procurement']),4),read:list(enumeration(kinds),8),write:list(enumeration(kinds),8),eventStages:list(enumeration(['مصرف قطعه','مونتاژ','آزمون نهایی','بسته‌بندی','تحویل']),5),finance:enumeration(['none','read','write'])},['read','write','eventStages']);
const member={email:text('',254),name:text('',100),unit:text('',100),status:enumeration(['active','disabled']),permissions:perms};
const config={id,revision:integer(0,1e9),name:text('',100),model:text('',160),baseUrl:text('HTTPS provider base URL. No request is sent when saving.',1000),systemPrompt:text('',16000),temperature:{type:'number',minimum:0,maximum:2},maxTokens:integer(1,131072),apiToken:text('Optional replacement secret; never returned. Blank preserves saved secret.',4096),clearToken:{type:'boolean'}};
type Tool={name:string;description:string;inputSchema:Schema;write:boolean;admin?:boolean;kind?:Kind;finance?:boolean;run:(a:any,origin:string,p:McpPrincipal)=>Promise<unknown>};
export const tools:Tool[]=[];
const add=(t:Tool)=>tools.push(t);
function argsValid(s:Schema,v:any):boolean{
 if(s.const!==undefined&&v!==s.const)return false;if(s.enum&&!s.enum.includes(v))return false;
 if(s.type==='object'){if(!v||typeof v!=='object'||Array.isArray(v))return false;if(s.maxProperties&&Object.keys(v).length>s.maxProperties)return false;if((s.required||[]).some((k:string)=>!(k in v)))return false;return Object.entries(v).every(([k,x])=>s.properties?.[k]?argsValid(s.properties[k],x):s.additionalProperties===false?false:typeof s.additionalProperties==='object'?argsValid(s.additionalProperties,x):true);}
 if(s.type==='array')return Array.isArray(v)&&v.length<=(s.maxItems??Infinity)&&v.every(x=>argsValid(s.items,x));
 if(s.type==='string')return typeof v==='string'&&v.length<=(s.maxLength??Infinity);
 if(s.type==='boolean')return typeof v==='boolean';
 if(s.type==='integer'||s.type==='number')return typeof v==='number'&&Number.isFinite(v)&&(s.type!=='integer'||Number.isInteger(v))&&v>=(s.minimum??-Infinity)&&v<=(s.maximum??Infinity);
 return false;
}
function req(origin:string,path:string,method='GET',body?:unknown,query:Record<string,unknown>={}){const u=new URL(path,origin);for(const [k,v]of Object.entries(query))if(v!==undefined&&v!==null)u.searchParams.set(k,String(v));return new Request(u,{method,headers:method==='GET'?{}:{origin,'Content-Type':'application/json'},...(method==='GET'?{}:{body:body===undefined?undefined:JSON.stringify(body)})});}
async function result(r:Response){if(!r.ok){let message='Operation failed.';try{message=(await r.json() as any).error||message;}catch{}throw new AccessError(message,r.status);}return r.headers.get('content-type')?.includes('application/json')?r.json():{html:await r.text()};}
function api(name:string,description:string,inputSchema:Schema,path:string,method:string,handler:(request:Request)=>Promise<Response>,options:Partial<Tool>={},queryKeys:string[]=[],body?:(a:any)=>unknown){
 add({name,description,inputSchema,write:method!=='GET',...options,run:async(a,o)=>{
  const requestBody=body?body(a):Object.fromEntries(Object.entries(a).filter(([k])=>k!=='confirmed'&&!queryKeys.includes(k)));
  const query=Object.fromEntries(queryKeys.map(k=>[k,a[k]]));
  return result(await handler(req(o,path,method,requestBody,query)));
 }});
}
add({name:'get_session',description:'Current authenticated account and effective permissions. All MCP data is real company data, never demo data.',inputSchema:obj({}),write:false,run:async(_a,_o,p)=>p.user});
add({name:'get_record_schema',description:'Field definitions, required fields, allowed options, relationships and editable fields for a record type.',inputSchema:obj({kind:enumeration(kinds)}),write:false,run:async a=>({fields:fields[a.kind as Kind],editable:editable[a.kind as Kind]||[],adminEditable:a.kind==="batch"?adminBatchEditable:editable[a.kind as Kind]||[],notes:'Device model snapshots are derived from product. Only use existing IDs. Distribution and firmware have dedicated tools.'})});
add({name:'list_records',description:'Search visible company records. Returns pagination, total and exact previous payload for optimistic updates. No demo records.',inputSchema:obj({kind:enumeration(kinds),query:text('',200),offset:integer(0,1000000),limit:integer(1,200)},[]),write:false,run:async a=>{const r=await result(await records.GET()) as any;const rows=r.records.filter((r:any)=>(!a.kind||r.kind===a.kind)&&(!a.query||JSON.stringify(r.data).toLowerCase().includes(a.query.toLowerCase())));const offset=a.offset||0,limit=a.limit||50;return {total:rows.length,offset,nextOffset:offset+limit<rows.length?offset+limit:null,records:rows.slice(offset,offset+limit).map((r:any)=>({...r,previous:JSON.stringify(r.data)}))};}});
add({name:'get_device_passport',description:'Find one exact device serial and its visible production, component batch, service, action and distribution records. Quality reports/files use their own tools.',kind:'device',inputSchema:obj({serial:text('',160)}),write:false,run:async a=>{const r=await result(await records.GET()) as any;const normal=(s:string)=>s.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim().toUpperCase();const d=r.records.find((v:any)=>v.kind==='device'&&normal(v.data.code)===normal(a.serial));if(!d)throw new AccessError('Device not found in accessible records.',404);const related=r.records.filter((v:any)=>v.data.device===d.id),batchIds=new Set(related.flatMap((v:any)=>[v.data.batch,v.data.replacement]).filter(Boolean));return {device:d,related,batches:r.records.filter((v:any)=>v.kind==='batch'&&batchIds.has(v.id)),product:r.records.find((v:any)=>v.id===d.data.product)||null};}});
api('create_record','Create a product, batch, device, production event (including batch consumption), service report or corrective action. Ask for approval first; do not retry blindly after a timeout.',payload({kind:enumeration(kinds.slice(0,6)),data}),'/api/records','POST',records.POST);
api('update_record','Update allowed fields of a product, batch, service report or corrective action. Supply full data and exact previous from list_records; identity fields cannot change.',payload({id,data,previous:text('Exact JSON data string returned by list_records.',100000)}),'/api/records','PATCH',records.PATCH);
api('delete_record','Admin-only deletion of an unused product or batch without attachments, QC templates or reserved serials. Exact previous and explicit user confirmation required; referenced records cannot be deleted.',payload({id,previous:text('Exact previous record data JSON.',100000)}),'/api/records','DELETE',records.DELETE,{admin:true},[],a=>a);
api('suggest_batch_number','Suggest a meaningful batch number; suggestion does not reserve it.',obj({partCode:text('',12),date:text('Gregorian YYYY-MM-DD',10)}),'/api/batch-suggestion','GET',batches.GET,{kind:'batch'},['partCode','date']);
api('list_serial_runs','List production serial runs, or details of one run.',obj({id},[]),'/api/serials','GET',serials.GET,{kind:'device'},['id']);
api('generate_serials','Reserve serials for a product. Reuse the same UUID requestId for safe retry.',payload({requestId:id,productId:id,count:integer(1,100)}),'/api/serials','POST',serials.POST,{kind:'device'});
api('print_serials','Return printable HTML for a serial run (A4 or thermal); does not operate a physical printer.',obj({id,layout:enumeration(['a4','thermal']),label:enumeration(['large','small'])},['id','layout']),'/api/serials/print','GET',printing.GET,{kind:'device'},['id','layout','label']);
api('device_analytics','Daily production and warranty activation counts; activation only when permitted. Dates are Gregorian; client may aggregate into Jalali months.',obj({}),'/api/device-analytics','GET',analytics.GET,{kind:'device'});
api('distribution_history','Distribution edit history and first warranty-code issue date for a device.',obj({device:id}),'/api/distribution','GET',distribution.GET,{kind:'distribution'},['device']);
api('save_distribution','Assign representative/end customer to a serial. previous is exact prior data JSON (empty for new); reason required for changes.',payload({data,previous:text('',100000),reason:text('',500)}),'/api/distribution','POST',distribution.POST,{kind:'distribution'},[],a=>({mode:'manual',data:a.data,previous:a.previous,reason:a.reason}));
const importRows=list(obj({row:integer(1,1000000),data}),500);
api('preview_distribution_import','Validate parsed Excel rows before import. Requires the same distribution-write permission as the UI.',obj({rows:importRows}),'/api/distribution','POST',distribution.POST,{kind:'distribution',write:false},[],a=>({mode:'preview',rows:a.rows}));
api('import_distribution','Import up to 25 previously previewed rows. Review per-row errors; partial success is possible.',payload({rows:list(obj({row:integer(1,1000000),data}),25),filename:text('',180)}),'/api/distribution','POST',distribution.POST,{kind:'distribution'},[],a=>({mode:'import',rows:a.rows,filename:a.filename}));
api('list_firmware','List firmware versions and HEX attachment metadata.',obj({}),'/api/firmware','GET',firmware.GET,{kind:'firmware'});
api('create_firmware','Create firmware version metadata. Upload Intel HEX using upload_firmware_file.',payload({name:text('',160),version:text('',160),deviceModel:text('',160),board:text('',160),notes:text()}),'/api/firmware','POST',firmware.POST,{kind:'firmware'});
api('list_quality_templates','Get quality form versions for a product or a device. Supply exactly one of product/device.',obj({product:id,device:id},[]),'/api/quality/templates','GET',templates.GET,{},['product','device']);
const qfield=obj({key:text('',40),label:text('',120),type:enumeration(['number','text','result']),unit:text('',40),min:text('',40),max:text('',40),required:{type:'boolean'}});
api('create_quality_template','Create a new version of a product quality form, preserving previous versions.',payload({productId:id,title:text('',160),fields:list(qfield,40),previousVersion:integer(0,1e9)}),'/api/quality/templates','POST',templates.POST,{kind:'product'});
api('list_quality_reports','Read device quality reports and their form versions.',obj({device:id}),'/api/quality/reports','GET',reports.GET,{},['device']);
api('record_quality_report','Record measured values, verdict and notes; also creates the final-test event. Requires QC-stage permission. Reuse requestId for retries.',payload({requestId:id,deviceId:id,templateId:id,values:data,verdict:enumeration(['pass','fail']),notes:text(),cause:enumeration(['part','assembly','design','test','unknown'])}),'/api/quality/reports','POST',reports.POST);
add({name:'finance_report_catalog',description:'Daily/weekly financial report requirements and purpose.',inputSchema:obj({}),write:false,finance:true,run:async()=>financeReports});
api('get_finance_period','List report files and review results/questions/answers/closures for a day or week.',obj(period),'/api/finance','GET',finance.GET,{finance:true},['cadence','period']);
api('add_finance_note','Append review result, question, answer or closure. Questions need responsible; answers/closures need parent_id. Reuse id for retries.',obj({...period,id,report_id:text('',80),kind:enumeration(['result','question','answer','closure']),body:text('',5000),responsible:text('',150),parent_id:id,confirmed},['cadence','period','id','report_id','kind','body','confirmed']),'/api/finance','POST',finance.POST,{finance:true},['cadence','period']);
api('list_users','List app accounts and permissions. Admin only.',obj({}),'/api/users','GET',users.GET,{admin:true});
api('create_user','Create an account with explicit permissions. Admin only; confirm the email and grants.',payload(member),'/api/users','POST',users.POST,{admin:true});
api('update_user','Change account status or permissions using current revision. Cannot change email. Admin only.',payload({...member,id,revision:integer(1,1e9)}),'/api/users','PATCH',users.PATCH,{admin:true});
api('list_llm_configs','List saved LLM profiles. Secrets are never returned. These settings do not change the MCP client model.',obj({}),'/api/llm-config','GET',llm.GET,{admin:true});
api('save_llm_config','Create/update LLM settings. revision=0 for new UUID. API token encrypted and write-only; changing destination requires token replacement/removal.',obj({...config,confirmed},Object.keys(config).filter(k=>!['apiToken','clearToken'].includes(k)).concat('confirmed')),'/api/llm-config','PUT',llm.PUT,{admin:true});
api('delete_llm_config','Delete a saved LLM profile using its current revision.',payload({id,revision:integer(1,1e9)}),'/api/llm-config','DELETE',llm.DELETE,{admin:true},['id','revision']);

// File transport: base64 upload, metadata lists, and bounded chunk downloads.
const groups:{name:string;path:string;route:{GET:(r:Request)=>Promise<Response>;POST:(r:Request)=>Promise<Response>};keys:Record<string,Schema>;kind?:Kind;finance?:boolean}[]=[{name:'batch',path:'/api/batch-files',route:batchFiles,keys:{batch:id},kind:'batch' as Kind},{name:'quality',path:'/api/quality/files',route:qualityFiles,keys:{report:id}},{name:'finance',path:'/api/finance/files',route:financeFiles,keys:{...period,report:text('',80)},finance:true},{name:'firmware',path:'/api/firmware/files',route:firmwareFiles,keys:{version:id},kind:'firmware' as Kind}];
for(const g of groups){
 const queryKeys=Object.keys(g.keys);
 if(g.name!=='firmware')api('list_'+g.name+'_files','List authorized attachment metadata.',obj(g.keys),g.path,'GET',g.route.GET,{kind:g.kind,finance:g.finance},queryKeys);
 add({name:'upload_'+g.name+'_file',description:'Upload one file as base64; original file validators and limits apply (HEX 10 MiB, other files 20 MiB). No remote URL fetching. Reuse requestId for retries where supported.',inputSchema:payload({...g.keys,...(g.name==='firmware'?{}:{requestId:id}),filename:text('',180),base64:text('Standard base64 file bytes, without data URL prefix.',28*1024*1024)}),write:true,kind:g.kind,finance:g.finance,run:async(a,o)=>{if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.base64))throw new AccessError('Invalid base64.',400);const decoded=atob(a.base64);if(decoded.length>20*1024*1024)throw new AccessError('File too large.',413);const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0)),form=new FormData();form.append('file',new Blob([bytes],{type:'application/octet-stream'}),a.filename);const u=new URL(g.path,o);for(const k of [...queryKeys,'requestId'])if(a[k])u.searchParams.set(k,a[k]);return result(await g.route.POST(new Request(u,{method:'POST',headers:{origin:o},body:form})));}});
 add({name:'download_'+g.name+'_file',description:'Read an attachment in base64 chunks (at most 64 KiB). Use nextOffset until null. Original permissions and integrity checks apply.',inputSchema:obj({...g.keys,...(g.name==='firmware'?{}:{id}),offset:integer(0,20*1024*1024),length:integer(1,65536)},[...queryKeys,...(g.name==='firmware'?[]:['id'])]),write:false,kind:g.kind,finance:g.finance,run:async(a,o)=>{const r=await g.route.GET(req(o,g.path,'GET',undefined,Object.fromEntries([...queryKeys,'id'].map(k=>[k,a[k]]))));if(!r.ok)return result(r);const bytes=new Uint8Array(await r.arrayBuffer()),offset=a.offset||0,end=Math.min(bytes.length,offset+(a.length||65536));if(offset>bytes.length)throw new AccessError('Offset exceeds file length.',400);return {base64:btoa(String.fromCharCode(...bytes.slice(offset,end))),offset,nextOffset:end<bytes.length?end:null,totalBytes:bytes.length,contentDisposition:r.headers.get('content-disposition')};}});
}
export function validateToolArguments(name:string,args:unknown){const t=tools.find(t=>t.name===name);return !!t&&argsValid(t.inputSchema,args);}
export function discoverTools(){return tools.map(t=>({name:t.name,description:t.description,inputSchema:t.inputSchema,annotations:{readOnlyHint:!t.write,destructiveHint:t.write,idempotentHint:!t.write,openWorldHint:false}}));}
export async function executeTool(name:string,args:unknown,origin:string,p:McpPrincipal){
 const t=tools.find(t=>t.name===name);if(!t)throw new AccessError('Unknown tool.',404);if(!argsValid(t.inputSchema,args))throw new AccessError('Arguments do not match the tool schema.',400);
 if(t.write&&p.scope==='read')throw new AccessError('This reference token is read-only.',403);
 if(t.admin&&!p.user.isAdmin)throw new AccessError('Administrator access required.',403);
 if(t.kind&&!can(p.user,t.kind,t.write?'write':'read'))throw new AccessError('Module permission denied.',403);
 if(t.finance&&!p.user.isAdmin&&!(t.write?p.user.permissions.finance==='write':['read','write'].includes(p.user.permissions.finance||'')))throw new AccessError('Finance permission denied.',403);
 let outcome='failed';try{const data=await mcpActor.run(p.user,()=>t.run(args,origin,p));outcome='succeeded';return data;}finally{
 // Domain mutations already write their atomic audit rows. Never log arguments or secrets here.
 try{await storage().prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),p.user.userId,name,'mcp_call',JSON.stringify({outcome,tokenId:p.tokenId}),new Date().toISOString()).run();}catch{console.error('MCP audit write failed');}
 }
}

api('get_production_inventory','Read permitted BOM versions, production sheets and warehouse balances. Quantities in balances/materials are thousandths of units.',obj({}),'/api/production','GET',production.GET);
api('save_product_bom','Save a versioned bill of materials for ONE device. Quantities are decimal strings (up to 3 decimal places).',payload({id,productId:id,previousVersion:integer(0,100000),lines:list(obj({partCode:text('',12),name:text('',200),unit:enumeration(['عدد','کیلوگرم','متر','لیتر']),quantity:text('',20)}),40)}),'/api/production','POST',production.POST,{},[],a=>({...a,mode:'bom'}));
api('initialize_batch_stock','Admin: establish physically verified remaining stock ONCE per batch. Does not assume original receipt quantity is remaining stock.',payload({id,batchId:id,quantity:text('',20),to:enumeration(['raw','line','quarantine','nonconforming'])}),'/api/production','POST',production.POST,{admin:true},[],a=>({...a,mode:'opening'}));
api('move_batch_stock','Move batch stock between material warehouses. Negative stock forbidden. Reuse request UUID when retrying.',payload({id,batchId:id,quantity:text('',20),from:enumeration(['raw','line','quarantine','nonconforming']),to:enumeration(['raw','line','quarantine','nonconforming'])}),'/api/production','POST',production.POST,{},[],a=>({...a,mode:'move'}));
api('create_production_sheet','Create one device production sheet with frozen BOM and selected batches, without deducting stock. One batch per BOM line.',payload({id,deviceId:id,bomId:id,day:text('',10),operator:text('',200),notes:text(),allocations:list(obj({partCode:text('',12),batchId:id,warehouse:enumeration(['raw','line'])}),40)}),'/api/production','POST',production.POST,{},[],a=>({...a,mode:'order'}));
api('transfer_finished_device','Atomically deduct BOM materials and receive one device into finished warehouse. Each sheet transfers once; insufficient stock rolls back all changes.',payload({id,orderId:id}),'/api/production','POST',production.POST,{},[],a=>({...a,mode:'finish'}));

api('create_password_user','Admin: create a local username/password account without ChatGPT email. Password is never returned or logged. Confirm exact permissions.',payload({username:text('',40),password:text('10–128 characters; never reuse secrets in other tools.',128),name:text('',100),unit:text('',100),status:enumeration(['active','disabled']),permissions:perms}),'/api/users','POST',users.POST,{admin:true});
api('update_password_user','Admin: update a local account or reset its password. Blank password preserves it; reset invalidates old sessions. Exact revision required.',payload({id,revision:integer(1,1e9),password:text('',128),name:text('',100),unit:text('',100),status:enumeration(['active','disabled']),permissions:perms}),'/api/users','PATCH',users.PATCH,{admin:true});

api('get_assistant_chat','List available model names and the current user’s saved chat history. Provider secrets are never returned.',obj({}),'/api/assistant','GET',assistant.GET);
api('ask_assistant','Send a message to the configured external model (may incur provider cost). The assistant reads authorized records, asks for missing fields and stages proposed changes; no changes execute until decide_assistant_action confirms the exact saved proposal. Reuse requestId on retry.',obj({requestId:id,profileId:id,message:text('',4000)}),'/api/assistant','POST',assistant.POST,{write:false});

api('get_material_flow','Read authorized material master data, quarantine/QC tasks, locations, requests, daily serial plans, builds, repair history and replenishment alerts. Stock quantities are in thousandths.',obj({}),'/api/flow','GET',flow.GET);
const flowPost=(name:string,description:string,mode:string,properties:Record<string,Schema>)=>api(name,description,payload({id,...properties}),'/api/flow','POST',flow.POST,{},[],a=>({...a,mode}));
flowPost('save_material_master','Create/update material master and incoming QC form. Receipt snapshots preserve prior forms. Roles inventory/admin. Revision 0 for new.', 'material',{code:text('',12),name:text('',200),unit:enumeration(['عدد','کیلوگرم','متر','لیتر']),specs:text(),defaultLocation:text('',100),reorderPoint:text('',20),targetStock:text('',20),fields:list(qfield,40),qcOwner:text('',100),warehouseOwner:text('',100),procurementOwner:text('',100),revision:integer(0,1e9)});
flowPost('receive_material_batch','Receive a NEW lot into quarantine with a generated meaningful batch code. Does not copy previous QC decisions or lot-specific attachments.', 'receipt',{materialId:id,day:text('',10),quantity:text('',20),supplier:text('',200),maker:text('',200),manufacturerLot:text('',200),purchase:text('',200),specs:text(),notes:text(),expiry:text('',10)});
flowPost('inspect_incoming_batch','Record immutable incoming QC measurements and accepted/rejected quantities totaling receipt quantity. Assigned QC/admin only.', 'incoming_qc',{receiptId:id,accepted:text('',20),rejected:text('',20),values:data,notes:text()});
flowPost('shelve_approved_batch','Warehouse approval moves accepted quantity only from quarantine to raw stock and assigns empty aisle-rack-level-bin location.', 'shelve',{receiptId:id,location:text('',100)});
flowPost('request_production_material','Request materials for a production plan (planId may be blank). Does not move stock.', 'request',{materialId:id,quantity:text('',20),planId:text('',200),notes:text()});
flowPost('issue_production_material','Approve full request using one/multiple batch-location allocations, raw to line. FEFO/FIFO exception needs technical reason. Negative stock prohibited.', 'issue',{requestId:id,allocations:list(obj({batchId:id,location:text('',100),quantity:text('',20)}),40),reason:text()});
flowPost('request_replenishment','Warehouse confirms or edits proposed procurement quantity. Only one open request per material; includes specification snapshot.', 'supply',{materialId:id,quantity:text('',20),notes:text()});
flowPost('close_replenishment','Assigned procurement officer records outcome and closes request. Does not manufacture a goods receipt.', 'supply_close',{supplyId:id,result:text()});
flowPost('set_daily_capacity','Configure per-product daily capacity and small labels per serial; no serials are generated until a plan is confirmed.', 'capacity',{productId:id,capacity:integer(1,100),smallLabels:integer(0,20),revision:integer(0,1e9)});
flowPost('create_daily_production_plan','Reserve today’s serials and create device/build records atomically. Pins BOM and QC template. Over-capacity requires reason. Does not operate physical printer.', 'plan',{productId:id,count:integer(1,100),design:text('',200),firmware:text('',200),reason:text()});
flowPost('assign_serial_assembler','Assign selected planned serials to assembler. Reassignment requires reason and retains history.', 'assign',{deviceIds:list(id,100),assembler:text('',200),reason:text()});
flowPost('finalize_material_consumption','Finalize a serial production sheet; immediately consumes actual quantities from line stock. Supports multiple lots per BOM part; deviations require notes. No finished-goods receipt.', 'build',{deviceId:id,allocations:list(obj({batchId:id,quantity:text('',20)}),80),notes:text()});
flowPost('reject_line_material','Move unused rejected components from line stock to nonconforming stock with reason.', 'reject',{batchId:id,quantity:text('',20),reason:text()});
flowPost('replace_installed_component','Record removal of installed batch to nonconforming and consume replacement batch from line; preserve cause and require a fresh final QC test.', 'repair',{deviceId:id,oldBatchId:id,newBatchId:id,quantity:text('',20),cause:enumeration(['part','assembly','design','test','unknown']),reason:text()});
flowPost('record_serial_print','Record serial print/reprint intent for daily plan without generating new serials. Use print_serials to obtain printable HTML.', 'print',{planId:id,notes:text()});

// Optional additions preserve compatibility with earlier clients.
const qcTool=tools.find(t=>t.name==='record_quality_report')!;qcTool.inputSchema.required=qcTool.inputSchema.required.filter((k:string)=>k!=='cause');

api('decide_assistant_action','Confirm or cancel an immutable proposed assistant action owned by this account. Read its exact args in get_assistant_chat first. Confirm only after explicit user approval. Repeated confirmation never executes twice.',obj({id,decision:enumeration(['confirm','cancel']),confirmed},['id','decision','confirmed']),'/api/assistant/actions','POST',assistantActions.POST,{},[],a=>a);
