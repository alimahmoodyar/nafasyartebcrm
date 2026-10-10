import {requireAccess,checkOrigin,accessResponse,AccessError,can} from '@/lib/authorization';
import {tools,validateToolArguments} from '@/lib/mcp/tools';
import {assistantWriteNames,actionTitles,actionSection,canOpenSection} from '@/lib/assistant-policy';
import {cleanFormArgs} from '@/lib/assistant-workspace';
import {boundedBody} from '@/lib/firmware-storage';
import {storage} from '@/lib/storage';
import {publicAction} from '../actions/route';
export async function POST(request:Request){try{
 checkOrigin(request);const u=await requireAccess();if(request.headers.get('x-assistant-account')!==u.userId)throw new AccessError('حساب ورود تغییر کرده است.',409);
 const b=JSON.parse(new TextDecoder().decode(await boundedBody(request,22000))),tool=tools.find(t=>t.name===b.tool&&t.write&&assistantWriteNames.has(t.name));
 if(!tool||tool.admin&&!u.isAdmin||tool.kind&&!can(u,tool.kind,'write')||tool.finance&&!u.isAdmin&&u.permissions.finance!=='write')throw new AccessError('این فرمان برای شما مجاز نیست.',403);
 if(!/^[a-f0-9-]{36}$/i.test(b.id))throw new AccessError('شناسه فرم معتبر لازم است.',400);
 const args=cleanFormArgs(b.args),db=storage(),prior:any=await db.prepare('SELECT * FROM assistant_actions WHERE id=?').bind(b.id).first();
 if(prior){const saved=JSON.parse(prior.args),submitted={...args};for(const key of ['id','requestId'])if(saved[key]&&!submitted[key])delete saved[key];const stable=(v:any):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(stable(v[k]))])):v);if(stable(saved)!==stable(submitted))throw new AccessError('شناسه فرم با اطلاعات متفاوت تکرار شده است.',409);if(prior.owner!==u.userId||prior.tool!==b.tool)throw new AccessError('فرم متعلق به این حساب نیست.',409);return Response.json({accountId:u.userId,action:publicAction(prior)});}
 if(tool.inputSchema.properties.requestId&&!['issue_production_material','review_development_request','close_development_request','clarify_development_request','respond_development_request','acknowledge_development_request'].includes(tool.name))args.requestId=crypto.randomUUID();
 if(tool.inputSchema.properties.id&&!['update_record','delete_record','update_user','delete_user','save_material_master'].includes(tool.name))args.id=crypto.randomUUID();
 if(tool.name==='save_material_master'&&args.revision===0)args.id=crypto.randomUUID();
 const section=actionSection(tool.name,args);if(!canOpenSection(u,section))throw new AccessError('دسترسی فرم مجاز نیست.',403);
 if(!validateToolArguments(tool.name,{...args,confirmed:true,...(tool.name==='create_password_user'?{password:'validation-only'}:{})}))throw new AccessError('موارد لازم فرم را کامل و بررسی کنید.',400);
 const turn=crypto.randomUUID(),now=new Date().toISOString(),expires=new Date(Date.now()+15*60000).toISOString();
 await db.batch([db.prepare('INSERT INTO assistant_turns(id,owner,question,answer,model,created) VALUES(?,?,?,?,?,?)').bind(turn,u.userId,'تکمیل دستی فرم '+(actionTitles[tool.name]||tool.name),'فرم آماده تأیید است؛ هنوز تغییری اعمال نشده است.','manual-form',now),db.prepare("UPDATE assistant_actions SET state='cancelled' WHERE owner=? AND state='pending'").bind(u.userId),db.prepare("INSERT INTO assistant_actions(id,owner,turn_id,tool,args,state,created,expires) VALUES(?,?,?,?,?,'pending',?,?)").bind(b.id,u.userId,turn,tool.name,JSON.stringify(args),now,expires)]);
 const action:any=await db.prepare('SELECT * FROM assistant_actions WHERE id=? AND owner=?').bind(b.id,u.userId).first();return Response.json({accountId:u.userId,action:publicAction(action)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return accessResponse(e)||Response.json({error:'آماده‌سازی فرم انجام نشد.'},{status:400,headers:{'Cache-Control':'no-store'}});}}
