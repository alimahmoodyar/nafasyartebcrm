import {AccessError,accessResponse} from './authorization';
import {stationHr,authenticatedStation} from './personnel-stations';
import {boundedBody} from './firmware-storage';
import {sha256} from './firmware';
import {storage} from './storage';

const maxBytes=2*1024*1024,chunkSize=48*1024;
const kind='attendance_station_sound',chunkKind='attendance_station_sound_chunk';
type Direction='in'|'out';
type Sound={name:string;mime:string;bytes:number;hash:string;parts:number;actor:string};
const header={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
function direction(input:unknown):Direction{if(input==='in'||input==='out')return input;throw new AccessError('جهت تردد معتبر نیست.',400)}
const key=(d:Direction)=>'station-sound:'+d;
function invalid():never{throw new AccessError('فایل صوتی سالم با فرمت MP3 یا WAV انتخاب کنید.',400)}
function magic(bytes:Uint8Array,at:number,length:number){return String.fromCharCode(...bytes.subarray(at,at+length))}
function wav(bytes:Uint8Array){
 if(bytes.length<44||magic(bytes,0,4)!=='RIFF'||magic(bytes,8,4)!=='WAVE')return false;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(4,true)+8!==bytes.length)return false;
 let fmt=false,samples=false;
 for(let offset=12;offset+8<=bytes.length;){
  const id=magic(bytes,offset,4),size=view.getUint32(offset+4,true),body=offset+8;
  if(body+size>bytes.length)return false;
  if(id==='fmt '){
   if(size<16)return false;const codec=view.getUint16(body,true),channels=view.getUint16(body+2,true),rate=view.getUint32(body+4,true),bits=view.getUint16(body+14,true);
   fmt=[1,3].includes(codec)&&channels>0&&channels<=8&&rate>0&&rate<=384000&&[8,16,24,32,64].includes(bits);
  }
  if(id==='data'&&size>0)samples=true;
  offset=body+size+(size%2);
 }
 return fmt&&samples;
}
function mp3(bytes:Uint8Array){
 let start=0;
 if(magic(bytes,0,3)==='ID3'){
  if(bytes.length<10||bytes[3]<2||bytes[3]>4||Array.from(bytes.subarray(6,10)).some(b=>b>127))return false;
  start=10+bytes.subarray(6,10).reduce((n,b)=>n*128+b,0)+(bytes[3]===4&&(bytes[5]&16)?10:0);
 }
 if(start+4>bytes.length||bytes[start]!==255||(bytes[start+1]&224)!==224)return false;
 const version=bytes[start+1]>>3&3,layer=bytes[start+1]>>1&3,bitrateIndex=bytes[start+2]>>4,rateIndex=bytes[start+2]>>2&3;
 if(version===1||layer!==1||bitrateIndex===0||bitrateIndex===15||rateIndex===3)return false;
 const rates=version===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
 const hz=[44100,48000,32000][rateIndex]/(version===3?1:version===2?2:4);
 const size=Math.floor((version===3?144000:72000)*rates[bitrateIndex]/hz)+(bytes[start+2]>>1&1);
 return start+size<=bytes.length;
}
export function validateStationSound(name:string,bytes:Uint8Array){
 if(!bytes.length||bytes.length>maxBytes)throw new AccessError('حجم فایل باید حداکثر دو مگابایت باشد.',413);
 if(/\.wav$/i.test(name)&&wav(bytes))return 'audio/wav';
 if(/\.mp3$/i.test(name)&&mp3(bytes))return 'audio/mpeg';
 return invalid();
}
function deleteParts(d:Direction){
 const prefix=key(d)+':';
 return storage().prepare('DELETE FROM flow_entities WHERE type=? AND id>=? AND id<?').bind(chunkKind,prefix,prefix+'z');
}
async function metadata(d:Direction):Promise<Sound|null>{
 const r=await storage().prepare('SELECT data FROM flow_entities WHERE id=? AND type=?').bind(key(d),kind).first<{data:string}>();
 return r?JSON.parse(r.data):null;
}
export async function stationSounds(){
 await stationHr();const [entry,exit]=await Promise.all([metadata('in'),metadata('out')]);
 return {in:entry?{name:entry.name}:null,out:exit?{name:exit.name}:null};
}
export async function uploadStationSound(request:Request){
 const actor=await stationHr(),type=request.headers.get('content-type')||'';
 if(!/^multipart\/form-data\s*;/i.test(type))return invalid();
 const body=await boundedBody(request,maxBytes+16384);
 let form:FormData;
 try{form=await new Response(body.buffer as ArrayBuffer,{headers:{'Content-Type':type}}).formData()}catch{return invalid()}
 const d=direction(form.get('kind')),file=form.get('file');
 if(!file||typeof file==='string'||form.getAll('file').length!==1)return invalid();
 const name=file.name.normalize('NFC').split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim();
 if(!name||name.length>160)return invalid();
 const bytes=new Uint8Array(await file.arrayBuffer()),mime=validateStationSound(name,bytes),hash=await sha256(bytes.buffer);
 const db=storage(),now=new Date().toISOString(),parts=Math.ceil(bytes.length/chunkSize);
 const meta:Sound={name,mime,hash,bytes:bytes.length,parts,actor};
 const statements=[deleteParts(d),db.prepare(`INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)
 ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=flow_entities.revision+1,updated=excluded.updated`).bind(key(d),kind,JSON.stringify(meta),now,now)];
 for(let i=0;i<parts;i++){
  const segment=bytes.subarray(i*chunkSize,(i+1)*chunkSize);
  // Small slices avoid oversized SQL bindings and JavaScript argument limits.
  let binary='';for(let j=0;j<segment.length;j+=4096)binary+=String.fromCharCode(...segment.subarray(j,j+4096));
  statements.push(db.prepare('INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,?,?,1,?,?)').bind(key(d)+':'+String(i).padStart(2,'0'),chunkKind,JSON.stringify({content:btoa(binary)}),now,now));
 }
 statements.push(db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,key(d),'station_sound_upload',JSON.stringify({name,hash,bytes:bytes.length}),now));
 await db.batch(statements);return {saved:true,name};
}
export async function removeStationSound(value:unknown){
 const actor=await stationHr(),d=direction(value),db=storage(),now=new Date().toISOString();
 await db.batch([db.prepare('INSERT INTO access_audit(id,actor,target,action,after,at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM flow_entities WHERE id=? AND type=?)').bind(crypto.randomUUID(),actor,key(d),'station_sound_remove','{}',now,key(d),kind),deleteParts(d),db.prepare('DELETE FROM flow_entities WHERE id=? AND type=?').bind(key(d),kind)]);
 return {removed:true};
}
export async function readStationSound(request:Request){
 try{
  if(request.headers.has('Authorization'))await authenticatedStation(request);else await stationHr();
  const d=direction(new URL(request.url).searchParams.get('kind')),meta=await metadata(d);
  if(!meta)return new Response(null,{status:204,headers:header});
  const tag='"'+meta.hash+'"';
  if(request.headers.get('If-None-Match')?.split(',').some(t=>t.trim()===tag||t.trim()==='*'))return new Response(null,{status:304,headers:{...header,ETag:tag}});
  const rows=(await storage().prepare('SELECT id,data FROM flow_entities WHERE type=? AND id>=? AND id<? ORDER BY id LIMIT 44').bind(chunkKind,key(d)+':',key(d)+':z').all<{id:string;data:string}>()).results;
  const bytes=new Uint8Array(meta.bytes);let offset=0;
  if(rows.length!==meta.parts)throw Error('audio changed');
  for(const row of rows){const binary=atob(JSON.parse(row.data).content);for(let i=0;i<binary.length;i++)bytes[offset+i]=binary.charCodeAt(i);offset+=binary.length}
  if(offset!==bytes.length||await sha256(bytes.buffer)!==meta.hash)throw Error('audio changed');
  return new Response(bytes,{headers:{...header,'Content-Type':meta.mime,'Content-Length':String(meta.bytes),ETag:tag,'Content-Security-Policy':"sandbox; default-src 'none'"}});
 }catch(e){return accessResponse(e)||Response.json({error:'دریافت صدا کامل نشد. دوباره تلاش کنید.'},{status:503,headers:header})}
}

