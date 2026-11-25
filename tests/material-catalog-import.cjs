const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
let beforeBatch;
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){return{meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){if(beforeBatch){const fn=beforeBatch;beforeBatch=null;fn();}sql.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={DB:db},cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n==='cloudflare:workers')return{env};if(n==='@/app/chatgpt-auth')return{getChatGPTUser:async()=>null};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout,clearTimeout,console},{filename:file});return exports;}
const context=load('lib/mcp/context.ts').mcpActor,route=load('app/api/material-import/route.ts'),parser=load('lib/material-import.ts'),base='https://test.local';
const actor=(id,roles=[])=>({userId:id,email:id+'@test.local',name:id,isAdmin:false,permissions:{read:[],write:[],eventStages:[],flowRoles:roles,warehouseResponsibilities:[]}}),inventory=actor('inventory',['inventory']);
const sample=(code='001234',name='Material',unit='عدد')=>({code,name,unit}),input=rows=>({source:'catalog.xls · برگه 1',rows});
const counts=()=>({masters:sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='material'").get().n,all:sql.prepare('SELECT COUNT(*) n FROM flow_entities').get().n,operations:sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n,audits:sql.prepare('SELECT COUNT(*) n FROM access_audit').get().n,stock:sql.prepare('SELECT COUNT(*) n FROM inventory_balances').get().n,records:sql.prepare('SELECT COUNT(*) n FROM records').get().n,bom:sql.prepare('SELECT COUNT(*) n FROM bom_versions').get().n});
const master=code=>{const r=sql.prepare('SELECT * FROM flow_entities WHERE id=?').get('material:'+code);return r?{...r,data:JSON.parse(r.data)}:null};
async function invoke(payload,status=200,user=inventory){const response=await context.run(user,()=>route.POST(new Request(base+'/api/material-import',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify(payload)}))),data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
const preview=data=>invoke({mode:'preview',...data});
const commit=(data,p,extra={},status=200,user=inventory)=>invoke({mode:'commit',id:crypto.randomUUID(),confirmed:true,...data,catalogSnapshot:p.catalogSnapshot,...extra},status,user);
(async()=>{
 const grid=[['کد','نام','واحد','مقدار مصرف'],['\u200f۰۰۱۲۳۴','قطعه','سانتي متر','invalid ignored quantity']];
 const mapping=parser.guessMaterialImportMapping(grid[0]),rows=parser.parseMaterialImportGrid(grid,0,mapping);assert.equal(rows[0].code,'001234');assert.equal(rows[0].unit,'سانتی‌متر');assert.equal(Object.keys(rows[0]).length,3);
 const noConsumption=[['کد کالا','نام کالا'],['۰۰۱۲۳۴','Part']];assert.equal(parser.parseMaterialImportGrid(noConsumption,0,parser.guessMaterialImportMapping(noConsumption[0]))[0].unit,'');
 if(process.env.BOM_WORKBOOK){const xlsx=require('xlsx'),book=xlsx.read(fs.readFileSync(process.env.BOM_WORKBOOK),{type:'buffer'}),source=xlsx.utils.sheet_to_json(book.Sheets['1'],{header:1,defval:'',raw:false}),actual=parser.parseMaterialImportGrid(source,0,parser.guessMaterialImportMapping(source[0]));assert.equal(actual.length,81);assert.equal(parser.normalizeMaterialImportRows(actual).errors.length,0);assert.equal(actual.find(row=>row.code==='10100822').unit,'کیلوگرم');assert.ok(actual.every(row=>Object.keys(row).length===3));console.log('PASS supplied workbook, read-only: 81 catalog rows; consumption excluded.');}
 const start=counts();await invoke({mode:'parse',grid,header:0,mapping});assert.deepEqual(counts(),start);
 const scoped=actor('scoped');scoped.permissions.warehouseResponsibilities=[{warehouseId:'WH1',role:'inventory'}];
 for(const user of [actor('reader'),actor('qc',['qc']),actor('production',['production']),scoped]){await invoke({mode:'preview',...input([sample()])},403,user);await invoke({mode:'parse',grid,header:0,mapping},403,user);}
 const hospital=actor('hospital',['inventory']);hospital.permissions.hospitalCenterId='center';await invoke({mode:'preview',...input([sample()])},403,hospital);
 const full=input(Array.from({length:81},(_,i)=>sample(String(10100000+i),'Material '+i,['عدد','ست','جفت','سانتی‌متر','کیلوگرم'][i%5]))),p=await preview(full);assert.equal(p.newMaterialCount,81);assert.equal(p.errors.length,0);assert.deepEqual(counts(),start,'Preview must be read-only without product permission');
 await commit(full,p,{confirmed:false},400);await commit(full,p,{catalogSnapshot:'wrong'},409);assert.deepEqual(counts(),start);
 const id=crypto.randomUUID(),saved=await commit(full,p,{id});assert.equal(saved.newMaterialCount,81);assert.equal(counts().masters,81);assert.equal(counts().all,81);assert.equal(counts().audits,1);
 for(const row of full.rows){const m=master(row.code);assert.equal(m.data.name,row.name);assert.equal(m.data.unit,row.unit);assert.equal(m.data.fields.length,0);assert.equal(m.data.qcSetupRequired,true);assert.equal(m.data.quantity,undefined);}
 const after=counts();assert.equal((await commit(full,p,{id})).repeated,true);assert.deepEqual(counts(),after);await commit({...full,source:'different'},p,{id},409);await commit(full,p,{id},409,actor('other',['inventory']));
 const again=await preview(full);assert.equal(again.existingCount,81);await commit(full,again);assert.equal(counts().masters,81,'Same catalog cannot duplicate masters');
 const original=master('10100000'),snapshot=JSON.stringify(original),rename=input([sample('10100000','Renamed')]),rp=await preview(rename);assert.ok(rp.warnings.length);await commit(rename,rp);assert.equal(JSON.stringify(master('10100000')),snapshot,'Existing specs/QC/name remain unchanged');
 const unitConflict=input([sample('10100000','Material','کیلوگرم')]),up=await preview(unitConflict);assert.ok(up.errors.length);await commit(unitConflict,up,{},400);
 for(const rows of [[sample('x')],[sample('001234','')],[sample('001234','Part','')],[sample(),sample()],[sample('001234','Part','unknown')]]){const data=input(rows),before=counts(),invalid=await preview(data);assert.ok(invalid.errors.length);await commit(data,invalid,{},400);assert.deepEqual(counts(),before);}
 for(const rows of [[],Array.from({length:201},(_,i)=>sample(String(20000000+i))),[{code:123,name:'Part',unit:'عدد'}]])await invoke({mode:'preview',...input(rows)},400);
 const stale=input([sample('10100000')]),sp=await preview(stale);sql.prepare("UPDATE flow_entities SET revision=revision+1 WHERE id='material:10100000'").run();await commit(stale,sp,{},409);
 const altered=input([sample('001234')]),ap=await preview(altered);await commit({...altered,rows:[sample('001234','Edited')]},ap,{},409);
 const rollback=input([sample('22222222'),sample('22222223')]),bp=await preview(rollback),before=counts();sql.exec("CREATE TRIGGER reject_import BEFORE INSERT ON flow_entities WHEN NEW.id='material:22222223' BEGIN SELECT RAISE(ABORT,'test failure'); END");await commit(rollback,bp,{},503);sql.exec('DROP TRIGGER reject_import');assert.deepEqual(counts(),before);assert.equal(master('22222222'),null,'Failed row rolls back the full import');
 const raced=input([sample('33333333'),sample('33333334')]),racePreview=await preview(raced);beforeBatch=()=>sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES('material:33333333','material',?,1,'now','now')").run(JSON.stringify(sample('33333333')));await commit(raced,racePreview,{},409);assert.equal(master('33333334'),null,'Concurrent catalog change prevents partial writes');
 const frozen=input([sample('44444444')]),fp=await preview(frozen),freezeBefore=counts();sql.prepare("UPDATE reset_control SET phase='maintenance',internal=0 WHERE id=1").run();await commit(frozen,fp,{},423);assert.deepEqual(counts(),freezeBefore);sql.prepare("UPDATE reset_control SET phase='idle' WHERE id=1").run();
 const tools=load('lib/mcp/tools.ts').tools,parseTool=tools.find(t=>t.name==='parse_material_catalog_spreadsheet'),previewTool=tools.find(t=>t.name==='preview_material_import'),commitTool=tools.find(t=>t.name==='commit_material_import');assert.equal(parseTool.write,false);assert.equal(previewTool.write,false);assert.equal(commitTool.write,true);
 const mcpInput=input([sample('55555555')]),mp=await context.run(inventory,()=>previewTool.run(mcpInput,base));assert.equal(mp.newMaterialCount,1);assert.equal(master('55555555'),null);await assert.rejects(()=>context.run(actor('qc',['qc']),()=>previewTool.run(mcpInput,base)));await assert.rejects(()=>context.run(inventory,()=>commitTool.run({...mcpInput,id:crypto.randomUUID(),confirmed:false,catalogSnapshot:mp.catalogSnapshot},base)));
 await context.run(inventory,()=>commitTool.run({...mcpInput,id:crypto.randomUUID(),confirmed:true,catalogSnapshot:mp.catalogSnapshot},base));assert.ok(master('55555555'));const parsed=await context.run(inventory,()=>parseTool.run({grid,header:0,mapping},base));assert.equal(parsed.rows[0].code,'001234');
 const admin={...actor('admin'),isAdmin:true};
 const accounting=(rows,mode='preview',other={})=>({mode,catalog:'accounting',source:'accounting.xlsx',rows,...other});
 const inspect=rows=>invoke(accounting(rows),200,admin);
 const apply=(rows,view,expected=200,other={})=>invoke(accounting(rows,'commit',{id:crypto.randomUUID(),confirmed:true,catalogSnapshot:view.catalogSnapshot,...other}),expected,admin);
 const accountingRow=(code,name,unit='عدد',existingCode='')=>({code,name,unit,existingCode});
 const migration=[accountingRow('10100000','Material 0'),accountingRow('A-001','New accounting item'),accountingRow('A-001','New accounting item')];
 const previewMigration=await inspect(migration);assert.equal(previewMigration.linkedCount,1);assert.equal(previewMigration.newMaterialCount,1);assert.equal(previewMigration.duplicateCount,1);assert.equal(previewMigration.errors.length,0);
 assert.equal(master('10100000').data.accountingCode,undefined);
 await invoke(accounting(migration),403,inventory);
 const newInternalCode=previewMigration.changes[1].internalCode,materialId=master('10100000').id;
 const migrationId=crypto.randomUUID();
 assert.equal((await apply(migration,previewMigration,200,{id:migrationId})).linkedCount,1);
 assert.equal(master('10100000').id,materialId);assert.equal(master('10100000').data.accountingCode,'10100000');assert.equal(master(newInternalCode).data.accountingCode,'A-001');
 assert.match(newInternalCode,/^\d{12}$/);assert.equal((await apply(migration,previewMigration,200,{id:migrationId})).repeated,true);
 assert.equal((await inspect(migration)).existingCount,2);
 const ambiguous=[accountingRow('000777','Material 1','ست')];assert.equal((await inspect(ambiguous)).changes[0].status,'review');
 const resolved=[{...ambiguous[0],existingCode:'10100001'}],resolvedPreview=await inspect(resolved);assert.equal(resolvedPreview.linkedCount,1);
 await apply(resolved,resolvedPreview);assert.equal(master('10100001').data.accountingCode,'000777');
 for(const conflicting of [
  [accountingRow('A-001','New accounting item','کیلوگرم')],
  [accountingRow('A-001','Linked elsewhere','عدد','10100000')],
  [accountingRow('Conflicting','Part'),accountingRow('Conflicting','Different part')]
 ]){const reviewed=await inspect(conflicting);assert.ok(reviewed.errors.length);await apply(conflicting,reviewed,400);}
 const raceRow=[accountingRow('RACE-ACCT','New racing item')],raceView=await inspect(raceRow);
 beforeBatch=()=>sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.accountingCode','race-acct') WHERE id='material:10100002'").run();
 await apply(raceRow,raceView,409);assert.equal(master(raceView.changes[0].internalCode),null);
 const workbookGrid=[['کد هم‌نفس','کد حسابداری','نام کالا','واحد'],['10100001','۰۰۰۷۷۷','Material 1','ست']];
 const accountingMapping=parser.guessMaterialImportMapping(workbookGrid[0],true),accountingFileRows=parser.parseMaterialImportGrid(workbookGrid,0,accountingMapping,true);
 assert.equal(accountingFileRows[0].code,'000777');assert.equal(accountingFileRows[0].existingCode,'10100001');
 assert.equal((await inspect([accountingRow('','Material 3','سانتی‌متر','10100003')])).skippedCount,1);
 const workbook=await context.run(admin,()=>route.GET());assert.equal(workbook.status,200);
 const xlsx=require('xlsx'),wb=xlsx.read(await workbook.arrayBuffer(),{type:'array'}),sheet=xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
 assert.ok(sheet.some(row=>row[0]==='10100001'&&row[1]==='000777'));
 const formattedBook=xlsx.utils.book_new(),formattedSheet=xlsx.utils.aoa_to_sheet([['کد حسابداری','نام کالا','واحد'],[77,'Formatted code','عدد']]);
 formattedSheet.A2.z='000000';
 xlsx.utils.book_append_sheet(formattedBook,formattedSheet,'اقلام');
 const formatted=await load('lib/bom-import-file.ts').readBomSheets(new File([xlsx.write(formattedBook,{type:'array',bookType:'xlsx'})],'accounting.xlsx'),true);
 assert.equal(formatted[0].grid[1][0],'000077');

 const actualFile=process.env.FINANCE_MATERIAL_WORKBOOK;
 const financeBook=xlsx.utils.book_new();
 const fixtureRows=Array.from({length:999},(_,i)=>[String(50100000+i),'Finance item '+i,'عدد','']);
 fixtureRows[0][1]='اجرت ساخت قطعه';
 fixtureRows[1][2]='بسته';
 xlsx.utils.book_append_sheet(financeBook,xlsx.utils.aoa_to_sheet([['اقلام پر مصرف سال ۱۴۰۵'],['کد کالا','عنوان کالا','واحد اصلی','واحد فرعی'],...fixtureRows]),'Sheet1');
 xlsx.utils.book_append_sheet(financeBook,xlsx.utils.aoa_to_sheet([['کد','نوع','عنوان','واحد اصلی','واحد فرعی'],...fixtureRows.map(([code,name,unit,aux])=>[code,'کالا',name,unit,aux])]),'Sheet2');
 const bytes=actualFile?fs.readFileSync(actualFile):xlsx.write(financeBook,{type:'array',bookType:'biff8'});
 const file=new File([bytes],'اقلام پرمصرف.xls'),reader=load('lib/bom-import-file.ts');
 await assert.rejects(()=>reader.readBomSheets(file,true),/باینری/);
 const importSource=parser.financeMaterialWorkbook(await reader.readBomSheets(file,true,true));
 const expectedRows=Number(process.env.FINANCE_MATERIAL_EXPECTED_ROWS||999);
 assert.equal(importSource.name,'Sheet1');assert.equal(importSource.rows.length,expectedRows);
 const profile={profile:'finance-frequent',source:'finance.xls · Sheet1'};
 const beforeBatchImport=counts();
 const financeView=await invoke(accounting(importSource.rows,'preview',profile),200,admin);
 const units=load('lib/material-units.ts');
 const sourceExcluded=importSource.rows.filter(row=>row.financeIssue||!units.normalizeMaterialUnit(row.unit)).length;
 assert.equal(sourceExcluded,actualFile?Number(process.env.FINANCE_MATERIAL_EXPECTED_EXCLUDED||50):2);
 const expectedExcluded=financeView.excludedCount;
 assert.ok(expectedExcluded>=sourceExcluded);
 if(actualFile)assert.ok(expectedExcluded>sourceExcluded,'legacy conflicts are excluded along with source issues');
 assert.equal(financeView.errors.length,0);
 assert.equal(financeView.excludedCount,expectedExcluded);
 assert.equal(financeView.newMaterialCount+financeView.linkedCount+financeView.existingCount,expectedRows-expectedExcluded);
 assert.deepEqual(counts(),beforeBatchImport,'preview does not write');
 await invoke(accounting(importSource.rows,'preview'),400,admin);
 await invoke(accounting(importSource.rows,'preview',profile),403,inventory);
 const financeCommit={...profile,id:crypto.randomUUID(),confirmed:true,catalogSnapshot:financeView.catalogSnapshot};
 assert.equal((await invoke(accounting(importSource.rows,'commit',financeCommit),200,admin)).newMaterialCount,financeView.newMaterialCount);
 assert.equal((await invoke(accounting(importSource.rows,'commit',financeCommit),200,admin)).repeated,true);
 assert.equal(counts().masters,beforeBatchImport.masters+financeView.newMaterialCount);
 const afterFinance=await invoke(accounting(importSource.rows,'preview',profile),200,admin);
 assert.equal(afterFinance.newMaterialCount,0);assert.equal(afterFinance.excludedCount,expectedExcluded);
 for(const issue of financeView.changes.filter(row=>row.status==='excluded'))
  assert.equal(sql.prepare("SELECT 1 FROM flow_entities WHERE type='material' AND json_extract(data,'$.accountingCode')=? AND json_extract(data,'$.importSource')=?").get(issue.accountingCode,profile.source),undefined);
 console.log('PASS '+expectedRows+'-row binary finance workbook: one confirmation, excluded rows, no duplicates and retry.');
 assert.equal(counts().stock,0);assert.equal(counts().records,0);assert.equal(counts().bom,0);
 const reset=load('lib/reset-contract.ts');assert.ok(reset.resetWhere('flow_entities','operations').includes("'material'"));assert.equal(sql.prepare("SELECT COUNT(*) n FROM flow_entities WHERE type='material' AND ("+reset.resetWhere('flow_entities','full')+')').get().n,counts().masters);
 console.log('PASS material catalog import: independent 81-row catalog, no invented stock/BOM, incomplete/QC handling, permissions, preserve masters, duplicates, stale/racing snapshots, atomic rollback, idempotency, reset freeze and MCP parity.');
})().catch(e=>{console.error(e);process.exitCode=1});
