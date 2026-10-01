import {storage} from '@/lib/storage';
import {AccessError} from '@/lib/authorization';
import {authenticateMcp,tokenHash} from './auth';
import {dispatchRpc,readRpc,transportFailure,rpcError} from './protocol';
const headers={'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-store, no-transform','X-Accel-Buffering':'no','Referrer-Policy':'no-referrer'};
const iso=(ms=Date.now())=>new Date(ms).toISOString();
const encoder=new TextEncoder();
export async function openStream(request:Request){try{
 const p=await authenticateMcp(request,true),db=storage(),url=new URL(request.url),last=request.headers.get('last-event-id');
 let streamId:string,cursor=0;const lease=crypto.randomUUID();
 await db.prepare('DELETE FROM mcp_streams WHERE expires<?').bind(iso()).run();
 if(last){const parts=last.split(':');if(parts.length!==2||!/^\d+$/.test(parts[1]))throw new AccessError('Invalid Last-Event-ID.',400);streamId=parts[0];cursor=Number(parts[1]);if(!Number.isSafeInteger(cursor))throw new AccessError('Invalid event cursor.',400);const old=await db.prepare('SELECT * FROM mcp_streams WHERE id=? AND token_id=? AND expires>?').bind(streamId,p.tokenId,iso()).first();if(!old)throw new AccessError('SSE session expired. Reconnect without Last-Event-ID.',404);
 await db.prepare('UPDATE mcp_streams SET lease=?,lease_until=? WHERE id=? AND token_id=?').bind(lease,iso(Date.now()+60000),streamId,p.tokenId).run();
 }else{streamId=crypto.randomUUID();const r=await db.prepare('INSERT INTO mcp_streams(id,token_id,expires,lease,lease_until) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM mcp_streams WHERE token_id=? AND lease_until>?)<4').bind(streamId,p.tokenId,iso(Date.now()+3600000),lease,iso(Date.now()+60000),p.tokenId,iso()).run();if(!r.meta.changes)throw new AccessError('Maximum four active SSE connections per token.',429);}
 // Only this token's session is resumable. Reconnect replaces the previous stream lease.
 const endpoint=new URL('/mcp/messages',url.origin);endpoint.searchParams.set('sessionId',streamId);if(url.searchParams.has('token'))endpoint.searchParams.set('token',url.searchParams.get('token')!);
 let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined,wake:(()=>void)|undefined,lastHeartbeat=0;
 const cancel=()=>{cancelled=true;if(timer)clearTimeout(timer);wake?.();};request.signal.addEventListener('abort',cancel,{once:true});
 const body=new ReadableStream<Uint8Array>({async start(controller){
 const send=(v:string)=>controller.enqueue(encoder.encode(v));
 try{send('retry: 3000\nevent: endpoint\ndata: '+endpoint.pathname+endpoint.search+'\n\n');
 while(!cancelled){
 const current=await authenticateMcp(request,true);if(JSON.stringify(current.user.permissions)!==JSON.stringify(p.user.permissions)||current.user.isAdmin!==p.user.isAdmin)break;
 const active=await db.prepare('SELECT id FROM mcp_streams WHERE id=? AND token_id=? AND lease=? AND expires>?').bind(streamId,p.tokenId,lease,iso()).first();if(!active)break;
 const rows=await db.prepare('SELECT seq,response,request_key,created FROM mcp_messages WHERE stream_id=? AND seq>? ORDER BY seq LIMIT 25').bind(streamId,cursor).all<{seq:number;response:string|null;request_key:string;created:string}>();
 for(const row of rows.results){if(cancelled)break;if(row.response===null){if(Date.now()-Date.parse(row.created)<120000)break;row.response=JSON.stringify(rpcError(JSON.parse(row.request_key),-32603,'Result unavailable. Inspect records before retrying; the operation may have completed.'));await db.prepare('UPDATE mcp_messages SET response=? WHERE seq=? AND response IS NULL').bind(row.response,row.seq).run();}send('id: '+streamId+':'+row.seq+'\nevent: message\ndata: '+row.response+'\n\n');cursor=row.seq;}
 if(Date.now()-lastHeartbeat>15000){send(': heartbeat\n\n');await db.prepare('UPDATE mcp_streams SET lease_until=? WHERE id=? AND lease=?').bind(iso(Date.now()+60000),streamId,lease).run();lastHeartbeat=Date.now();}
 if(!cancelled)await new Promise<void>(resolve=>{wake=resolve;timer=setTimeout(resolve,2000);});
 }
 }catch{if(!cancelled)try{send('event: error\ndata: {"error":"Connection closed; reauthenticate or reconnect."}\n\n');}catch{}}
 finally{request.signal.removeEventListener('abort',cancel);try{await db.prepare('UPDATE mcp_streams SET lease_until=? WHERE id=? AND lease=?').bind(iso(),streamId,lease).run();}catch{}if(!cancelled)try{controller.close();}catch{}}
 },cancel});
 return new Response(body,{headers});
 }catch(e){return transportFailure(e);}}
export async function postMessage(request:Request){try{
 const p=await authenticateMcp(request,true),url=new URL(request.url),streamId=url.searchParams.get('sessionId'),db=storage();
 const stream=await db.prepare('SELECT id FROM mcp_streams WHERE id=? AND token_id=? AND expires>?').bind(streamId||'',p.tokenId,new Date().toISOString()).first();if(!stream)throw new AccessError('Unknown or expired SSE session.',404);
 const message=await readRpc(request);
 if(message?.jsonrpc==='2.0'&&typeof message.method==='string'&&message.id===undefined)return new Response(null,{status:202});
 const requestKey=JSON.stringify(message?.id??null),hash=await tokenHash(JSON.stringify(message));
 const inserted=await db.prepare('INSERT INTO mcp_messages(stream_id,request_key,request_hash,created) VALUES(?,?,?,?) ON CONFLICT(stream_id,request_key) DO NOTHING').bind(streamId,requestKey,hash,iso()).run();
 if(!inserted.meta.changes){const old=await db.prepare('SELECT request_hash,response FROM mcp_messages WHERE stream_id=? AND request_key=?').bind(streamId,requestKey).first<any>();if(old?.request_hash!==hash)throw new AccessError('Request ID already used with different arguments.',409);return new Response(null,{status:202});}
 const response=await dispatchRpc(message,url.origin,p)??rpcError(message?.id,-32600,'Invalid request.');
 // Responses survive isolate boundaries and reconnects; no process-local session map.
 await db.prepare('UPDATE mcp_messages SET response=? WHERE stream_id=? AND request_key=?').bind(JSON.stringify(response),streamId,requestKey).run();
 return new Response(null,{status:202,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch(e){return transportFailure(e);}}
