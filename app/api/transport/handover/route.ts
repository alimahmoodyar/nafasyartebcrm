import {checkOrigin,accessResponse} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {externalMission,externalSummary,saveExternalPhoto,confirmExternalReceipt} from '@/lib/transport-external';
export async function POST(r:Request){try{checkOrigin(r);let b:any,file:File|null=null;
 if(r.headers.get('content-type')?.startsWith('multipart/form-data')){const raw=await boundedBody(r,10*1024*1024+10000),f=await new Response(raw,{headers:{'Content-Type':r.headers.get('content-type')!}}).formData();b=JSON.parse(String(f.get('metadata')||'{}'));const candidate=f.get('file');if(!candidate||typeof candidate==='string')throw Error('photo');file=candidate;}
 else b=JSON.parse(new TextDecoder().decode(await boundedBody(r,12000)));
 const m=await externalMission(String(b.missionId||''),String(b.token||''));
 const result=b.mode==='read'?externalSummary(m):b.mode==='photo'&&file?await saveExternalPhoto(m,file):b.mode==='confirm'?await confirmExternalReceipt(m,b):null;
 if(!result)throw Error('mode');return Response.json(result,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch(e){return accessResponse(e)||Response.json({error:'ثبت قطعی نشد؛ دوباره وضعیت را بخوانید.'},{status:409,headers:{'Cache-Control':'no-store'}});}}
