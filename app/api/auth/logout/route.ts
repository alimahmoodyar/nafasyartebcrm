import {cookies} from 'next/headers';
import {storage} from '@/lib/storage';
import {checkOrigin,accessResponse} from '@/lib/authorization';
import {digest,cookieName} from '@/lib/password-auth';
export async function POST(request:Request){try{checkOrigin(request);const token=(await cookies()).get(cookieName)?.value;if(token)await storage().prepare('DELETE FROM password_sessions WHERE hash=?').bind(await digest(token)).run();return Response.json({loggedOut:true},{headers:{'Cache-Control':'no-store','Set-Cookie':cookieName+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'}});}catch(e){return accessResponse(e)||Response.json({error:'خروج انجام نشد.'},{status:503});}}
