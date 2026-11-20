import {requireAccess,checkOrigin,accessResponse,AccessError} from '@/lib/authorization';
import {uploadDeclarationPhoto,declarationPhoto} from '@/lib/asset-declarations';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
function account(r:Request,u:{userId:string}){if(r.headers.get('x-asset-account')&&r.headers.get('x-asset-account')!==u.userId)throw new AccessError('حساب ورود تغییر کرده است.',409);}
export async function GET(r:Request){try{const u=await requireAccess();account(r,u);return await declarationPhoto(u,new URL(r.url).searchParams.get('id')||'');}catch(e){return accessResponse(e)||Response.json({error:'عکس در دسترس نیست.'},{status:503,headers});}}
export async function POST(r:Request){try{checkOrigin(r);const u=await requireAccess();account(r,u);return Response.json(await uploadDeclarationPhoto(u,r),{headers});}catch(e){return accessResponse(e)||Response.json({error:'ذخیره عکس انجام نشد؛ پیش از تکرار، اعلام را بازخوانی کنید.'},{status:/inventory_operation_guard|UNIQUE/.test(String(e))?409:503,headers});}}
