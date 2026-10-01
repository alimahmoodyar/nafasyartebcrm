import {localPrincipal} from '@/lib/password-auth';
import {session,resolveIdentity,AccessError,checkOrigin} from '@/lib/authorization';
import {storage} from '@/lib/storage';
export type McpPrincipal={user:Awaited<ReturnType<typeof session>>;scope:'read'|'read_write';tokenId:string|null};
export async function tokenHash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function validateOrigin(request:Request){const origin=request.headers.get('origin');if(origin)checkOrigin(request);}
export async function tokenPrincipal(token:string):Promise<McpPrincipal>{
 if(!/^nfy_[0-9a-f]{64}$/.test(token))throw new AccessError('Invalid reference token.',401);
 const t=await storage().prepare('SELECT * FROM mcp_tokens WHERE token_hash=? AND revoked=0 AND expires>?').bind(await tokenHash(token),new Date().toISOString()).first<any>();if(!t)throw new AccessError('Reference token expired, revoked or invalid.',401);
 const user=t.subject.startsWith('local:')?await localPrincipal(t.subject.slice(6)):await resolveIdentity({userId:t.subject,email:t.email,displayName:t.email,fullName:null});if(!user)throw new AccessError('Account is inactive.',401);return {user,scope:t.scope,tokenId:t.id};
}
export async function authenticateMcp(request:Request,requireToken=false):Promise<McpPrincipal>{
 validateOrigin(request);const url=new URL(request.url),query=url.searchParams.get('token'),authorization=request.headers.get('authorization');
 // Hosted OAuth bearer headers may belong to Sites, not a reference token.
 const bearer=authorization?.startsWith('Bearer nfy_')?authorization.slice(7):null;
 if(query&&bearer&&query!==bearer)throw new AccessError('Conflicting credentials.',401);
 if(query||bearer)return tokenPrincipal((query||bearer)!);
 if(requireToken)throw new AccessError('Reference token is required.',401);
 return {user:await session(),scope:'read_write',tokenId:null};
}
