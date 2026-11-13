import {accessResponse,checkOrigin} from '@/lib/authorization';
import {devicePair} from '@/lib/device-pair';
async function post(r:Request){try{checkOrigin(r);if(Number(r.headers.get('content-length')||0)>180000)return Response.json({error:'درخواست بیش از اندازه است.'},{status:413});const raw=await r.text();if(raw.length>180000)return Response.json({error:'درخواست بیش از اندازه است.'},{status:413});const b=JSON.parse(raw);return Response.json(await devicePair(b.mode,b),{headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}})}catch(e){return accessResponse(e)||Response.json({error:'ارتباط دو دستگاه برقرار نشد؛ دوباره تلاش کنید.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
// Pair the authenticated person and their exact effective position; do not
// replace the real actor with a profile-preview actor while binding devices.
export const POST=post;
