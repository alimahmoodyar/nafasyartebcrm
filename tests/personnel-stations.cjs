const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),sql=new DatabaseSync(':memory:');
for(const f of fs.readdirSync(path.join(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',f),'utf8'));
function prepared(q){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:sql.prepare(q).run(...args)}}}}
const db={prepare:prepared,async batch(statements){sql.exec('BEGIN');try{for(const s of statements)await s.run();sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}}};
let user='hr';class AccessError extends Error{constructor(text,status){super(text);this.status=status}}
const mock={
 './authorization':{AccessError,requireAccess:async()=>({userId:user})},
 './storage':{storage:()=>db},'./firmware-storage':{},'./firmware':{sha256:async bytes=>crypto.createHash('sha256').update(new Uint8Array(bytes)).digest('hex')},
 './personnel':{hrActor:async()=>({has:role=>user==='hr'&&role==='hr'})},
 './duties':{dayAt:(d=new Date())=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Tehran'}).format(d),addDay:(day,n)=>new Date(Date.parse(day+'T12:00Z')+n*86400000).toISOString().slice(0,10)}
};
const file=path.join(root,'lib/personnel-stations.ts'),domain={};
new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(domain,n=>mock[n]||require(n));
const req=q=>new Request('https://test.invalid/stations?'+q),seed=(id,type,data)=>sql.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').run(id,type,JSON.stringify(data),'2020','2020');
const stationFor=async mode=>{
 const issued=await domain.createTicket({name:'station '+mode,location:'factory',mode}),linked=await domain.linkStation(issued);
 await assert.rejects(domain.linkStation(issued),e=>e.status===401);
 const row=sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(linked.station.id);
 assert(!row.data.includes(linked.token.split('.')[1]));
 sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.linkedAt','2020-01-01T00:00:00.000Z') WHERE id=?").run(linked.station.id);
 return linked;
};
(async()=>{
 user='employee';await assert.rejects(domain.createTicket({}),e=>e.status===403);user='hr';
 const a=await stationFor('in'),b=await stationFor('out'),days=['2024-05-18','2024-05-19'];
 const setup=await domain.createTicket({name:'pending',location:'office',mode:'both'});
 sql.prepare("UPDATE flow_entities SET data=json_set(data,'$.expiresAt','2020') WHERE id=?").run(setup.station.id);
 await assert.rejects(domain.linkStation(setup),e=>e.status===401);
 seed('employee-a','hr_employee',{memberId:'person-a',name:'Employee',state:'active',start:'2020-01-01'});
 seed('employee-b','hr_employee',{memberId:'person-b',name:'Former',state:'disabled',start:'2020-01-01'});
 const roster=await domain.employeeRoster(req('stationId='+a.station.id));assert.deepEqual(roster.people,[{id:'person-a',name:'Employee'}]);
 user='employee';await assert.rejects(domain.employeeRoster(req('stationId='+a.station.id)),e=>e.status===403);user='hr';
 const stations=await domain.listStations(req(''));assert.equal(stations.stations.length,3);assert(!JSON.stringify(stations).includes('Hash'));
 const send=(station,event)=>domain.syncPunch(new Request('https://test.invalid/sync',{headers:{Authorization:'Bearer '+station.token}}),event);
 const event=(day,clock,direction)=>({id:crypto.randomUUID(),memberId:'person-a',at:day+'T'+clock+':00.000Z',direction});
 const entry=event(days[0],'05:00','in'),exit=event(days[0],'13:00','out');
 await assert.rejects(send(a,entry),e=>e.status===403);
 for(const station of [a,b]){
  await domain.enrollMember({stationId:station.station.id,memberId:'person-a'});
  await domain.enrollMember({stationId:station.station.id,memberId:'person-a'});
 }
 sql.prepare("UPDATE flow_entities SET created='2020-01-01T00:00:00.000Z' WHERE type='attendance_station_member'").run();
 assert((await send(b,exit)).saved);assert((await send(a,entry)).saved);assert((await send(a,entry)).repeated);
 await assert.rejects(send(b,entry),e=>e.status===403);
 await assert.rejects(send(a,{...entry,at:entry.at.replace('05:00','05:06')}),e=>e.status===409);
 await assert.rejects(send(a,{...entry,id:crypto.randomUUID()}),e=>e.status===409);
 assert.equal(sql.prepare("SELECT COUNT(*) c FROM flow_entities WHERE type='hr_punch'").get().c,2);
 const p=JSON.parse(sql.prepare('SELECT data FROM flow_entities WHERE id=?').get(entry.id).data);
 assert.equal(p.stationName,a.station.name);assert.equal(p.memberId,entry.memberId);assert.equal(p.createdBy,a.station.id);assert.equal(p.at,entry.at);assert(p.receivedAt>p.at);
 seed('locked','hr_period',{state:'closed',start:days[1],end:days[1],memberIds:['person-a']});
 await assert.rejects(send(a,event(days[1],'05:00','in')),e=>e.status===409);
 const audio={};
 const audioMocks={...mock,'./personnel-stations':domain,'./authorization':{...mock['./authorization'],accessResponse:e=>e instanceof AccessError?Response.json({error:e.message},{status:e.status}):null},'./firmware-storage':{boundedBody:async(r,limit)=>{const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>limit)throw new AccessError('limit',413);return bytes}}};
 new Function('exports','require',ts.transpileModule(fs.readFileSync(path.join(root,'lib/personnel-stations-audio.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(audio,n=>audioMocks[n]||require(n));
 const voice=Buffer.alloc(100044);voice.write('RIFF');voice.writeUInt32LE(voice.length-8,4);voice.write('WAVEfmt ',8);voice.writeUInt32LE(16,16);voice.writeUInt16LE(1,20);voice.writeUInt16LE(1,22);voice.writeUInt32LE(16000,24);voice.writeUInt32LE(32000,28);voice.writeUInt16LE(2,32);voice.writeUInt16LE(16,34);voice.write('data',36);voice.writeUInt32LE(voice.length-44,40);
 function upload(name,bytes){const form=new FormData();form.set('kind','in');form.set('file',new File([bytes],name));return audio.uploadStationSound(new Request('https://test.invalid/upload',{method:'PUT',body:form}))}
 const readSound=(query,headers={})=>audio.readStationSound(new Request('https://test.invalid/sound?kind='+query,{headers}));
 assert.equal((await readSound('in')).status,204);
 user='employee';await assert.rejects(upload('hello.wav',voice),e=>e.status===403);assert.equal((await readSound('in')).status,403);user='hr';
 await assert.rejects(upload('hello.wav',Buffer.alloc(44)),e=>e.status===400);
 await assert.rejects(upload('hello.wav',Buffer.alloc(2*1024*1024+1)),e=>e.status===413);
 await upload('hello.wav',voice);assert.equal((await audio.stationSounds()).in.name,'hello.wav');
 const heard=await readSound('in',{Authorization:'Bearer '+a.token});assert.equal(heard.status,200);assert.equal(heard.headers.get('Content-Type'),'audio/wav');assert.deepEqual(Buffer.from(await heard.arrayBuffer()),voice);
 assert.equal((await readSound('in',{'If-None-Match':heard.headers.get('ETag')})).status,304);
 assert.equal((await readSound('in',{Authorization:'Bearer wrong'})).status,401);
 // The complete previous voice survives failed replacement halfway through a transaction.
 sql.exec("CREATE TRIGGER audio_rollback_test BEFORE INSERT ON flow_entities WHEN NEW.type='attendance_station_sound_chunk' AND NEW.id='station-sound:in:01' BEGIN SELECT RAISE(ABORT,'injected write failure'); END");
 await assert.rejects(upload('replacement.wav',voice),/injected/);sql.exec('DROP TRIGGER audio_rollback_test');
 assert.equal((await audio.stationSounds()).in.name,'hello.wav');
 assert.deepEqual(Buffer.from(await (await readSound('in')).arrayBuffer()),voice);
 const mp3=Buffer.alloc(417);mp3.set([255,251,144,0],0);await upload('new.mp3',mp3);
 assert.equal((await readSound('in')).headers.get('Content-Type'),'audio/mpeg');
 await audio.removeStationSound('in');assert.equal((await readSound('in')).status,204);
 assert.equal(sql.prepare("SELECT COUNT(*) c FROM flow_entities WHERE type='attendance_station_sound_chunk'").get().c,0);
 console.log('PASS HR-only station audio, upload bounds, format validation, authorized station playback, content/Etag, replace and delete');
 await domain.revokeStation({id:a.station.id});await assert.rejects(send(a,entry),e=>e.status===401);
 console.log('PASS station access, one-use/expired tickets, scoped roster, credential secrecy, cross-station out-of-order offline events, identity, retry/duplicate protection, payroll lock and revocation');
})().catch(e=>{console.error(e);process.exitCode=1});

