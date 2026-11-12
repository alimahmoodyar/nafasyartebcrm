const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const root=path.resolve(__dirname,'..');const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
const db={prepare(q){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}}}},async batch(stmts){sql.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const objects=new Map();const bucket={async put(k,b){objects.set(k,b.slice(0));return {key:k}},async get(k){const b=objects.get(k);return b?{arrayBuffer:async()=>b.slice(0)}:null},async delete(k){objects.delete(k)}};
let bwip;let identity=null;const env={TRACE_OWNER_EMAIL:'owner@example.com',LLM_CONFIG_ENCRYPTION_KEY:require('node:crypto').randomBytes(32).toString('base64'),DB:db,BUCKET:bucket};
const cache={};function load(file){file=path.resolve(root,file);if(cache[file])return cache[file];const exports={};cache[file]=exports;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports,require:n=>{if(n==='cloudflare:workers')return {env};if(n==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity};if(n.startsWith('@/')||n.startsWith('.')){const p=n.startsWith('@/')?path.join(root,n.slice(2)):path.resolve(path.dirname(file),n);return load(p+(path.extname(p)?'':'.ts'));}if(n==='@bwip-js/generic')return bwip;return require(n)},Response,Request,URL,URLSearchParams,Error,crypto:globalThis.crypto,Date,Intl,Set,Map,FormData,Blob,File,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,ReadableStream,btoa,atob,setTimeout:(f,n)=>setTimeout(f,Math.min(n,10)),clearTimeout,console},{filename:file});return exports;}
const auth=load('lib/authorization.ts'),http=load('app/mcp/route.ts'),sse=load('lib/mcp/sse.ts'),tokens=load('app/api/mcp-tokens/route.ts'),configs=load('app/api/llm-config/route.ts'),secrets=load('lib/llm-secrets.ts'),catalog=load('lib/mcp/tools.ts');
const base='https://test.local';const owner={userId:'owner',email:'owner@example.com',displayName:'Owner',fullName:null};
const request=(path,method='GET',body,headers={})=>new Request(base+path,{method,headers:{origin:base,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const rpc=(method,params={},id=1)=>({jsonrpc:'2.0',method,params,id});
let token;
async function call(name,args={},key=token){const r=await http.POST(request('/mcp','POST',rpc('tools/call',{name,arguments:args}),key?{authorization:'Bearer '+key}:{}));assert.equal(r.status,200);const d=await r.json();if(d.result?.isError)return {error:d.result.content[0].text};return JSON.parse(d.result.content[0].text);}
async function mint(scope='read'){return (await (await tokens.POST(request('/api/mcp-tokens','POST',{name:'test',scope,days:1}))).json());}

const flow=load('app/api/flow/route.ts'),context=load('lib/mcp/context.ts').mcpActor;
const entities=t=>sql.prepare('SELECT * FROM flow_entities WHERE type=?').all(t).map(r=>({...r,data:JSON.parse(r.data)}));
async function op(u,mode,args,status=200){const body={id:crypto.randomUUID(),confirmed:true,mode,...args},r=await context.run(u,()=>flow.POST(request('/api/flow','POST',body))),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return {body,d};}

const labels=load('app/api/batch-labels/route.ts');
async function print(u,id,query=''){return context.run(u,()=>labels.GET(request('/api/batch-labels?id='+encodeURIComponent(id)+query)));}
(async()=>{
 bwip=await import('@bwip-js/generic');identity=owner;const admin=await auth.session(),now=new Date().toISOString(),code='20100040-14050725-001',bid='batch:'+code;
 const make=(id,permissions)=>{sql.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,created,updated) VALUES(?,?,?,'Staff','active',?,?,?)").run(id,id+'@test.local',id,JSON.stringify(permissions),now,now);return {userId:'local:'+id,email:id+'@test.local',name:id,isAdmin:false,permissions};};
 const blank={read:[],write:[],eventStages:[]},qc=make('qc',{...blank,warehouseResponsibilities:[{warehouseId:'w1',role:'qc'}]}),other=make('other',{...blank,warehouseResponsibilities:[{warehouseId:'w2',role:'inventory'}]}),viewer=make('viewer',{...blank,read:['batch']}),sales=make('sales',{...blank,salesRoles:['staff']}),external=make('external',{...blank,read:['batch'],serviceAgentId:'outside',serviceRoles:['agent']});
 for(const id of ['w1','w2'])sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'material_warehouse',?,1,?,?)").run(id,JSON.stringify({name:id,active:true,locations:[]}),now,now);
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES(?,'batch',?,?)").run(bid,JSON.stringify({code,part:'فیلتر مصرفی <script>alert(1)</script>',partCode:'20100040',date:'2026-10-17',unit:'عدد',quantity:'10',supplier:'SECRET-SUPPLIER'}),now);
 sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'receipt',?,1,?,?)").run(bid,JSON.stringify({warehouseId:'w1',qcOwner:'qc',state:'pending_qc',quantity:10000,day:'2026-10-17'}),now,now);
 const {batchQrText,batchScanCode}=load('lib/batch-qr.ts'),batchData=JSON.parse(sql.prepare('SELECT payload FROM records WHERE id=?').get(bid).payload),expectedQr=batchQrText({id:bid,data:batchData},base);
 assert.ok(expectedQr.includes('مقدار اولیه دریافت (نه موجودی فعلی): 10 عدد'));assert.ok(expectedQr.includes(base+'/b/'+code));assert.ok(!expectedQr.includes('SECRET-SUPPLIER'));assert.equal(batchScanCode(expectedQr),code);assert.equal(batchScanCode(code),code);assert.equal(batchScanCode(expectedQr+'\nبچ: OTHER'),'');

 const landing=load('app/b/[code]/route.ts'),land=async(query='',actor)=>actor?context.run(actor,()=>landing.GET(request('/b/'+code+query),{params:Promise.resolve({code})})):landing.GET(request('/b/'+code+query),{params:Promise.resolve({code})});
 let landingResponse=await land('',admin);assert.equal(landingResponse.status,200);assert.ok((await landingResponse.text()).includes('اطلاعات عمومی بچ'));
 landingResponse=await land('?details=1',admin);assert.equal(landingResponse.status,200);assert.ok((await landingResponse.text()).includes('رسید ورود کالا به انبار'));
 identity=null;landingResponse=await land();assert.equal(landingResponse.status,200);const publicHtml=await landingResponse.text();assert.ok(publicHtml.includes('فیلتر مصرفی'));assert.ok(publicHtml.includes('&lt;script&gt;'));assert.ok(!publicHtml.includes('<script>alert'));assert.ok(publicHtml.includes('10 عدد'));assert.ok(publicHtml.includes('?details=1'));assert.ok(!publicHtml.includes('SECRET-SUPPLIER'));assert.ok(!publicHtml.includes('/files?id='));
 const summary=await (await land('?format=json')).json();assert.deepEqual(Object.keys(summary).sort(),['batchCode','expiry','initialQuantity','name','notice','partCode','receiptDay','unit','defaultLocations','actualLocations','locationNotice','photo'].sort());assert.equal(summary.initialQuantity,'10');assert.equal(summary.batchCode,code);assert.equal(summary.partCode,'20100040');
 landingResponse=await land('?details=1');assert.equal(landingResponse.status,200);const loginHtml=await landingResponse.text();assert.ok(loginHtml.includes('/?batch='));assert.ok(loginHtml.includes('فیلتر مصرفی'));assert.ok(!loginHtml.includes('SECRET-SUPPLIER'));
 landingResponse=await land('?details=1',other);assert.equal(landingResponse.status,200);const deniedHtml=await landingResponse.text();assert.ok(deniedHtml.includes('حساب فعلی اجازه'));assert.ok(deniedHtml.includes('فیلتر مصرفی'));assert.ok(!deniedHtml.includes('SECRET-SUPPLIER'));assert.ok(!deniedHtml.includes('منتظر کنترل کیفیت'));
 assert.equal((await load('app/api/receipt-report/route.ts').GET(request('/api/receipt-report?id='+encodeURIComponent(bid)))).status,401,'Public label must not bypass the private report');
 const missing=await landing.GET(request('/b/not-found'),{params:Promise.resolve({code:'not-found'})});assert.equal(missing.status,404);
 assert.equal((await landing.GET(request('/b/bad'),{params:Promise.resolve({code:'bad\ncode'})})).status,400);
 identity=owner;
 const before=sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n;
 const result=await print(admin,bid,'&copies=3');assert.equal(result.status,200,JSON.stringify(admin)+': '+(result.ok?'':await result.text()));assert.equal(result.headers.get('cache-control'),'private, no-store');let html=await result.text();assert.equal((html.match(/<article class="label">/g)||[]).length,3);assert.equal((html.match(/<svg /g)||[]).length,6);assert.ok(html.includes('100mm 80mm'));assert.ok(html.includes(code));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('https://'));
 for(const actor of [qc,viewer]){const check=await print(actor,bid);assert.equal(check.status,200,actor.name+': '+(check.ok?'':await check.text()));}for(const actor of [other,sales,external])assert.equal((await print(actor,bid)).status,403);
 assert.equal((await print(admin,'missing')).status,404);assert.equal((await print(admin,bid,'&copies=101')).status,400);assert.equal((await print(admin,bid,'&width=0')).status,400);assert.equal((await print(admin,bid,'&layout=wrong')).status,400);assert.equal((await print(admin,bid,'&width=50&symbol=both')).status,200,'Operator-selected dimensions are accepted without a barcode size gate');
 for(const symbol of ['barcode','qr']){const response=await print(admin,bid,'&symbol='+symbol+'&width=60&layout=a4');assert.equal(response.status,200);const content=await response.text();assert.equal((content.match(/<svg /g)||[]).length,1);assert.ok(content.includes('size:A4'));}
 for(const [symbol,width,height] of [['barcode',70,40],['qr',60,75],['both',100,80]]){const page=await (await print(admin,bid,'&symbol='+symbol)).text();assert.ok(page.includes('عرض '+width+' × ارتفاع '+height+' میلی‌متر'));assert.ok(page.includes('size:'+width+'mm '+height+'mm'));}
 // Small dimensions keep the entire design and real symbol, with no negative CSS sizes.
 for(const symbol of ['barcode','qr','both']){
  for(const layout of ['thermal','a4','roll']){
   const small=await print(admin,bid,'&symbol='+symbol+'&layout='+layout+'&width=12.5&height=6.25&rollWidth=27&columns=2&gapX=2&copies=3');
   assert.equal(small.status,200,await small.clone().text());const page=await small.text();
   assert.ok(page.includes('width:12.5mm;height:6.25mm'));
   assert.ok(page.includes('class="label-content"')&&page.includes('scale('));
   assert.ok(!/height:-|width:-|NaN|Infinity/.test(page));
   const widthInput=page.match(/<input name="width"[^>]+>/)[0];assert.ok(!widthInput.includes('max='));
  }
 }
 assert.equal((await print(admin,bid,'&symbol=qr&layout=a4&width=500&height=200')).status,200);
 for(const value of ['0','-1','NaN','Infinity'])assert.equal((await print(admin,bid,'&width='+value)).status,400);
 const narrow=await print(admin,bid,'&layout=roll&symbol=qr&width=5&height=5&columns=2&gapX=1');
 assert.equal(narrow.status,200);assert.ok((await narrow.text()).includes('size:11mm 7mm'),'Automatic roll width does not impose the old 35mm minimum');
 const requested=await (await print(admin,bid,'&symbol=barcode&copies=7&print=1')).text();assert.equal((requested.match(/<article class="label">/g)||[]).length,7,'Print submission applies the newly requested count');assert.ok(requested.includes('name="print" value="1"'));
 let change,onloadfn,printed=0,submitted,replaced;const inputs={layout:{value:'thermal',addEventListener(){}},symbol:{value:'barcode',addEventListener(type,fn){change=fn}},width:{value:'70'},height:{value:'40'},copies:{value:'7'}},preview={id:'label-preview'},hint={textContent:''},form={elements:{namedItem:k=>inputs[k]},requestSubmit:button=>submitted=button,addEventListener(){}};const script=requested.match(/<script>([\s\S]*?)<\/script>/)[1];
 vm.runInNewContext(script,{URL,document:{getElementById:id=>id==='label-options'?form:id==='label-preview'?preview:hint,fonts:{ready:Promise.resolve()}},window:{location:{href:base+'/api/batch-labels?id='+encodeURIComponent(bid)+'&copies=7&print=1'},history:{replaceState:(_s,_t,url)=>replaced=String(url)},addEventListener:(_event,fn)=>onloadfn=fn,print:()=>printed++}});assert.equal(printed,0);inputs.symbol.value='qr';change();assert.equal(inputs.width.value,'60');assert.equal(inputs.height.value,'75');assert.equal(inputs.copies.value,'7');assert.equal(submitted,preview);assert.ok(hint.textContent.includes('عرض 60 × ارتفاع 75'));onloadfn();await new Promise(r=>setImmediate(r));assert.equal(printed,1);assert.ok(!new URL(replaced).searchParams.has('print'),'Reload must not reopen the print dialog');assert.equal(new URL(replaced).searchParams.get('copies'),'7'); inputs.width.value='20';inputs.height.value='10';inputs.symbol.value='both';change();assert.equal(inputs.width.value,'20');assert.equal(inputs.height.value,'10','Changing symbol preserves operator-selected small dimensions');
 const rollQuery='&layout=roll&symbol=barcode&copies=10&width=65.5&height=40&rollWidth=205&columns=3&gapX=2.25&gapY=2.5&left=1&top=1';
 const roll=await print(admin,bid,rollQuery);assert.equal(roll.status,200);
 const rollHtml=await roll.text();assert.deepEqual([...rollHtml.matchAll(/<div class="roll-row">([\s\S]*?)<\/article><\/div>/g)].map(row=>(row[0].match(/<article class="label">/g)||[]).length),[3,3,3,1]);
 assert.ok(rollHtml.includes('size:205mm 42.5mm'));assert.ok(rollHtml.includes('column-gap:2.25mm'));
 const oneRow=await (await print(admin,bid,rollQuery+'&print=test')).text();assert.equal((oneRow.match(/<article class="label">/g)||[]).length,3);assert.match(oneRow,/name="copies"[^>]+value="10"/);
 assert.equal((await print(admin,bid,rollQuery.replace('rollWidth=205','rollWidth=190'))).status,400);
 assert.equal((await print(admin,bid,rollQuery.replace('top=1','top=3'))).status,400);
 const long='123456789012-14050725-001';sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('long','batch',?,?)").run(JSON.stringify({code:long,part:'کالای دیگر',partCode:'123456789012'}),now);const longPage=await print(admin,'long');assert.equal(longPage.status,200);assert.ok((await longPage.text()).includes('عرض 100 × ارتفاع 80'));
 sql.prepare("INSERT INTO records(id,kind,payload,created) VALUES('legacy','batch',?,?)").run(JSON.stringify({code:'بچ قدیمی',part:'قدیمی'}),now);assert.equal((await print(admin,'legacy')).status,400);assert.equal((await print(admin,'legacy','&symbol=qr')).status,200);
 token=(await mint('read')).token;const publicTool=await call('get_batch_label_summary',{code});assert.equal(publicTool.batchCode,code);assert.ok(!JSON.stringify(publicTool).includes('SECRET-SUPPLIER'));const mc=await call('print_batch_labels',{id:bid,copies:2});assert.ok(mc.html?.includes(code),JSON.stringify(mc));assert.equal((mc.html.match(/<article class="label">/g)||[]).length,2);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM inventory_operations').get().n,before,'Preview, print and reprint never mutate identities or balances');assert.equal(sql.prepare("SELECT COUNT(*) n FROM records WHERE kind='batch'").get().n,3);
 sql.prepare("UPDATE app_members SET status='disabled' WHERE id='qc'").run();assert.equal((await print(qc,bid)).status,403,'Directory rechecks active warehouse membership');
 if(process.env.LABEL_PREVIEW){const dir=path.join(root,'outputs/qa-batch-labels');fs.mkdirSync(dir,{recursive:true});html=await (await print(admin,bid)).text();fs.writeFileSync(path.join(dir,'label.html'),html.replaceAll('&lt;script&gt;alert(1)&lt;/script&gt;',''));const svgs=html.match(/<svg [\s\S]*?<\/svg>/g);fs.writeFileSync(path.join(dir,'barcode.svg'),svgs[0]);fs.writeFileSync(path.join(dir,'qr.svg'),svgs[1]);}
 if(process.env.LABEL_DECODER_MODULE&&process.env.LABEL_RASTER_MODULE){const z=require(process.env.LABEL_DECODER_MODULE),sharp=require(process.env.LABEL_RASTER_MODULE);const output=await (await print(admin,bid)).text(),svgs=output.match(/<svg [\s\S]*?<\/svg>/g);for(const [i,symbol] of ['barcode','qr'].entries()){const width=Math.round((symbol==='barcode'?96:40)*203/25.4),{data,info}=await sharp(Buffer.from(svgs[i])).resize({width}).flatten({background:'#fff'}).greyscale().raw().toBuffer({resolveWithObject:true});const bitmap=new z.BinaryBitmap(new z.HybridBinarizer(new z.RGBLuminanceSource(Uint8ClampedArray.from(data),info.width,info.height))),reader=symbol==='barcode'?new z.Code128Reader():new z.QRCodeReader();assert.equal(reader.decode(bitmap).getText(),code,'203dpi label must decode the exact batch: '+symbol);}console.log('PASS independent Code128/QR decoding at 203dpi label dimensions.');}
 const templateRoute=load('app/api/label-templates/route.ts'),serialRoute=load('app/api/serials/print/route.ts');
 const templatePath='/api/label-templates';
 const createTemplate=(u,body,headers)=>context.run(u,()=>templateRoute.POST(request(templatePath,'POST',body,headers)));
 const config={width:32,height:15,rollWidth:103,columns:3,gapX:2,gapY:3,left:1,top:1};
 const first={name:'رول سه‌ستونه',revision:0,roll:config,confirmed:true};
 assert.equal((await createTemplate(viewer,{...first,confirmed:false})).status,400);assert.equal((await createTemplate(external,first)).status,403);
 assert.equal((await createTemplate(admin,first,{origin:'https://foreign.test'})).status,403);
 assert.equal((await createTemplate(admin,{...first,roll:{...config,rollWidth:90}})).status,400);
 const created=await createTemplate(admin,first);assert.equal(created.status,200,created.ok?'':await created.clone().text());
 const saved=await created.json();assert.equal(saved.revision,1);
 assert.equal((await createTemplate(admin,first)).status,409);
 const otherConfig={...config,width:60,height:40,rollWidth:125,columns:2};
 assert.equal((await createTemplate(admin,{...first,name:'رول دو ستونه',roll:otherConfig})).status,200);
 assert.equal((await createTemplate(admin,{...saved,roll:{...config,top:2},confirmed:true})).status,200);
 assert.equal((await createTemplate(admin,{...saved,confirmed:true})).status,409);
 const loadTemplates=actor=>context.run(actor,()=>templateRoute.GET(request(templatePath)));
 assert.equal((await (await loadTemplates(viewer)).json()).templates.length,2);
 assert.equal((await loadTemplates(external)).status,403);
 assert.equal((await context.run(viewer,()=>templateRoute.GET(request(templatePath+'?view=manage')))).status,403);
 const managed=await (await context.run(admin,()=>templateRoute.GET(request(templatePath+'?view=manage')))).text();
 assert.ok(managed.includes('مدیریت قالب‌های چاپ')&&managed.includes('رول سه‌ستونه'));
 // Save the operator's current calibration directly from the shared print widget.
 const rollLib=load('lib/label-roll.ts'),events={},values=Object.fromEntries(Object.entries(config).map(([k,v])=>[k,{value:String(v),addEventListener(){}}]));
 values.copies={value:'7'};const paper={value:'roll',addEventListener(){}};values.layout=paper;
 const blankOption={value:'',dataset:{}},picker={value:'',options:[blankOption],get selectedOptions(){return [this.options.find(o=>o.value===this.value)]},add(option){this.options.push(option)},addEventListener(type,fn){events.select=fn}},saveButton={disabled:false,addEventListener(type,fn){events.save=fn}},nameInput={value:'پرینتر انبار ـ ۳۲ در ۱۵',focus(){}},notice={textContent:''},previewButton={id:'label-preview'};
 let presetSubmissions=0,sentPayload,settingsUpdated=0;const printForm={elements:{namedItem:key=>values[key]},reportValidity:()=>true,requestSubmit(button){assert.equal(button,previewButton);presetSubmissions++}};
 vm.runInNewContext(rollLib.selectRollScript,{document:{getElementById:id=>({'roll-template':picker,'save-roll-preset':saveButton,'roll-preset-name':nameInput,'roll-preset-feedback':notice,'label-preview':previewButton}[id])},form:printForm,layout:paper,updateRoll:()=>settingsUpdated++,fetch:async(path,options)=>{assert.equal(path,templatePath);sentPayload=JSON.parse(options.body);return createTemplate(viewer,sentPayload)},Option:function(name,id){return {textContent:name,value:id,dataset:{}}},crypto:globalThis.crypto,Array,Object,JSON,Number,Error});
 assert.ok(!rollLib.templatePicker([],templatePath,false,'',false).includes('id="save-roll-preset"'),'Isolated training pages must not post a shared company preset');
 await events.save();assert.ok(notice.textContent.includes('ذخیره شد'),notice.textContent);assert.equal(presetSubmissions,0,'Saving must neither print nor change the page');assert.deepEqual(sentPayload.roll,config);assert.equal(sentPayload.layout,'roll');assert.equal(saveButton.disabled,false);assert.equal(values.copies.value,'7');
 const operatorPreset=(await (await loadTemplates(other)).json()).templates.find(t=>t.name===sentPayload.name);assert.ok(operatorPreset,'A different authorized workstation sees the saved calibration');
 assert.equal((await createTemplate(viewer,{...operatorPreset,confirmed:true})).status,403,'Operators cannot overwrite shared presets');
 const retriesBefore=entities('label_template').length,repeatSave=await createTemplate(viewer,sentPayload);assert.equal(repeatSave.status,200);assert.equal((await repeatSave.json()).id,operatorPreset.id);assert.equal(entities('label_template').length,retriesBefore);assert.equal((await createTemplate(other,sentPayload)).status,409);assert.equal((await createTemplate(viewer,{...sentPayload,name:'Different request'})).status,409);const withoutRetry={...sentPayload};delete withoutRetry.requestId;assert.equal((await createTemplate(viewer,withoutRetry)).status,409,'A new operation must not duplicate a name');
 for(const field of Object.values(values))field.value='0';paper.value='thermal';picker.value=operatorPreset.id;events.select();assert.equal(paper.value,'roll');for(const [key,value] of Object.entries(config))assert.equal(Number(values[key].value),value);assert.equal(settingsUpdated,1);assert.equal(presetSubmissions,1);assert.equal(values.copies.value,'0','Applying geometry does not change the requested copy count');
 const single=await createTemplate(viewer,{...first,name:'چاپگر دیگر ـ تکی',layout:'thermal',roll:{width:10,height:5,rollWidth:10,columns:1,gapX:0,gapY:0,left:0,top:0}});assert.equal(single.status,200);assert.equal((await single.json()).layout,'thermal');
 assert.ok((await (await print(viewer,bid)).text()).includes('id="save-roll-preset"'));assert.ok((await print(viewer,bid)).headers.get('content-security-policy').includes("connect-src 'self'"));

 const presetTool=catalog.tools.find(t=>t.name==='save_label_template'),mcpPreset={...first,name:'قالب اپراتور از ابزار',layout:'roll',requestId:crypto.randomUUID()};const viaTool=await context.run(viewer,()=>presetTool.run(mcpPreset,base,{}));assert.ok(viaTool.id);const viaToolRepeat=await context.run(viewer,()=>presetTool.run(mcpPreset,base,{}));assert.equal(viaToolRepeat.id,viaTool.id);assert.equal(viaToolRepeat.repeated,true);
 await assert.rejects(()=>context.run(external,()=>presetTool.run({...mcpPreset,requestId:crypto.randomUUID()},base,{})),/دسترسی/);
 const training=load('lib/training-context.ts').trainingContext;
 assert.deepEqual((await (await training.run({actor:'test',role:'test'},()=>loadTemplates(admin))).json()).templates,[]);
 sql.prepare("INSERT INTO serial_runs(id,product_id,actor,day,payload,created) VALUES('test-run',?,?,?,?,?)").run(bid,'owner','2026-10-17',JSON.stringify({name:'دستگاه تست',model:'A',smallLabels:2}),now);
 for(const serial of ['DEVICE-0001','DEVICE-0002'])sql.prepare("INSERT INTO serial_reservations(serial,run_id,product_id) VALUES(?,'test-run',?)").run(serial,bid);
 const serialPage=(actor,query)=>context.run(actor,()=>serialRoute.GET(request('/api/serials/print?id=test-run'+query)));
 const params='&layout=roll&label=small&serial=DEVICE-0001&copies=10&'+new URLSearchParams(config);
 const serialResponse=await serialPage(admin,params);
 assert.equal(serialResponse.status,200,serialResponse.ok?'':await serialResponse.clone().text());
 const serialHtml=await serialResponse.text();assert.ok(serialHtml.includes('<svg'),'Device serial label contains permanent service QR');
 assert.ok(serialHtml.includes('size:103mm 18mm')&&serialHtml.includes('رول سه‌ستونه'));assert.ok(serialHtml.includes('id="save-roll-preset"'));assert.ok(serialResponse.headers.get('content-security-policy').includes("connect-src 'self'"));
 assert.deepEqual([...serialHtml.matchAll(/<div class="roll-row">([\s\S]*?)<\/article><\/div>/g)].map(row=>(row[0].match(/class="serial" dir="ltr">DEVICE-0001/g)||[]).length),[3,3,3,1]);
 const trial=await (await serialPage(admin,params+'&print=test')).text();
 assert.equal((trial.match(/class="serial" dir="ltr">DEVICE-0001/g)||[]).length,3);
 assert.ok(trial.includes('name="copies" type="number" min="1" max="100" value="10"'));
 assert.equal((await serialPage(admin,'&serial=not-in-run')).status,404);
 assert.equal((await serialPage(viewer,'')).status,403);
 assert.equal((await (await serialPage(admin,'&label=small')).text()).match(/<article class="label">/g).length,4);
 for(const layout of ['thermal','a4','roll']){
  const tinySerial=await serialPage(admin,'&layout='+layout+'&label=small&serial=DEVICE-0001&width=10&height=5');
  assert.equal(tinySerial.status,200);const content=await tinySerial.text();assert.ok(content.includes('width:10mm;height:5mm'));assert.ok(content.includes('DEVICE-0001'));
  assert.ok(!/height:-|width:-|NaN|Infinity/.test(content));
 }
 const tinyConfig={width:5,height:5,rollWidth:11,columns:2,gapX:1,gapY:0,left:0,top:0};
 assert.equal((await createTemplate(admin,{...first,name:'رول کوچک پنج میلی‌متری',roll:tinyConfig})).status,200);
 assert.equal((await createTemplate(admin,{...first,name:'رول عریض',roll:{...tinyConfig,width:400,height:200,rollWidth:850,gapX:50}})).status,200);
 const tinyMcp=await call('print_batch_labels',{id:bid,layout:'roll',symbol:'qr',width:5,height:5,rollWidth:11,columns:2,gapX:1,gapY:0,left:0,top:0});
 assert.ok(tinyMcp.html?.includes('size:11mm 5mm'),JSON.stringify(tinyMcp));
 const tinySerialMcp=await call('print_serials',{id:'test-run',layout:'thermal',width:10,height:5});
 assert.ok(tinySerialMcp.html?.includes('size:10mm 5mm'),JSON.stringify(tinySerialMcp));
 console.log('PASS unrestricted label dimensions: small QR/barcode/combined labels, large pages, automatic narrow rolls, saved templates, serial printing, uniform content scaling, valid geometry and HTTP/MCP parity.');
 console.log('PASS inline preset save/apply: current geometry, shared workstations, thermal/roll layout, no automatic printing, operator creation with admin-only updates.');
 console.log('PASS shared label layouts: multiple presets, authorization, training isolation, geometry, per-serial copies and test row.');
 console.log('PASS batch labels: existing identity only, real SVG encoders, copies/sizing/layout, operator-selected geometry, escaped business text, own/foreign/inactive warehouse and external access, MCP read parity, zero stock/identity writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
