import {requireAccess,AccessError,accessResponse} from '@/lib/authorization';
import {withServiceRolePreview} from '@/lib/service-role-preview';
import {storage} from '@/lib/storage';
import {entity,warehouseAccess} from '@/lib/material-flow';
import {warehouseDirectory,warehouseMember} from '@/lib/material-warehouses';
import {salesRep,salesStaff,salesScope} from '@/lib/sales';
import {transportAccess} from '@/lib/transport';
import {assignedPackageDriver,parseShippingQr,shippingQr} from '@/lib/shipping-packages';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function get(request:Request){try{
 const u=await requireAccess(),q=new URL(request.url).searchParams;
 let saleId=q.get('saleId')||'',packageId=q.get('packageId')||'';
 if(q.get('code'))({saleId,packageId}=parseShippingQr(q.get('code')!));
 if(!saleId||saleId.length>200)throw new AccessError('شناسه بسته معتبر نیست.',400);
 const db=storage(),row:any=await db.prepare("SELECT * FROM flow_entities WHERE type='sale' AND id=?").bind(saleId).first();
 if(!row)throw new AccessError('بسته پیدا نشد.',404);const sale=entity(row),d=sale.data;
 const missionRow=d.transportId?await db.prepare("SELECT * FROM flow_entities WHERE type='transport' AND id=?").bind(d.transportId).first():null,linked=missionRow?entity(missionRow):null;
 const pickupAllowed=assignedPackageDriver(u,d,linked?.data);
 if(u.isAdmin||pickupAllowed){}else if(salesRep(u)||salesStaff(u)){await salesScope(u,d.salesAgentId,'read');}
 else if(warehouseAccess(u,'finished')){const ws=await warehouseDirectory();for(const did of d.deviceIds){const b:any=await db.prepare("SELECT data FROM flow_entities WHERE id=? AND type='build'").bind(did).first();const wid=b&&JSON.parse(b.data).warehouseId;const w=ws.find(w=>w.id===wid&&w.data.active);if(!w||!warehouseMember(u,w,'inventory'))throw new AccessError('بسته در دسترسی شما نیست.',404);}}
 else if(d.transportId){await transportAccess(u,d.transportId);}else throw new AccessError('بسته در دسترسی شما نیست.',404);
 if(d.state==='cancelled')throw new AccessError('حواله لغو شده است.',409);
 const packages=d.shippingPackages||[],p=packages.find((p:any)=>p.id===packageId);
 if(packageId&&!p||!packages.length)throw new AccessError('بسته پیدا نشد.',404);
 const mission=d.transportId?(pickupAllowed?linked:await transportAccess(u,d.transportId)):null;
 if(q.get('format')!=='print')return Response.json({saleId,pickup:{allowed:pickupAllowed,state:d.state,receivedDeviceIds:d.acknowledgedDeviceIds||[],packageReceipts:d.pickupPackageReceipts||[]},packages:packages.map((p:any)=>({...p,qrText:shippingQr(saleId,p.id)})),package:p?{...p,qrText:shippingQr(saleId,p.id)}:null,recipient:d.packageRecipient,mission:mission?{id:mission.id,revision:mission.revision,state:mission.data.state,nextAction:mission.data.state==='collected'?(mission.data.inbound||mission.data.route==='direct'?'offer':'carrier'):'',receivedDeviceIds:mission.data.receivedDeviceIds||[],packageReceipts:mission.data.packageReceipts||[]}:null},{headers:{'Cache-Control':'private, no-store'}});
 const {qrcode,drawingSVG}=await import('@bwip-js/generic');
 const contact=(title:string,c:any)=>'<section><h2>'+title+'</h2><b>'+esc(c?.name)+'</b><p>شهر: '+esc(c?.city)+' · تلفن: <bdi>'+esc(c?.phone)+'</bdi></p><p>'+esc(c?.address)+'</p></section>';
 const html=(p:any)=>'<article><h1>برگه ارسال محصول نهایی</h1><h2>بسته '+p.number+' از '+packages.length+' — شامل '+p.deviceIds.length+' دستگاه</h2><p>سفارش: <bdi>'+esc(d.packageOrderCode||d.salesOrderId||'—')+'</bdi> · حواله: <bdi>'+esc(saleId)+'</bdi></p><div class="contacts">'+contact('فرستنده',d.packageSender)+contact('گیرنده',d.packageRecipient)+'</div><h2>'+esc(p.model)+'</h2><table><thead><tr><th>سریال دستگاه‌های داخل همین بسته</th></tr></thead><tbody>'+p.serials.map((s:string)=>'<tr><td><bdi>'+esc(s)+'</bdi></td></tr>').join('')+'</tbody></table>'+qrcode({bcid:'qrcode',text:shippingQr(saleId,p.id),scale:3,padding:4,backgroundcolor:'FFFFFF'},drawingSVG())+'<p>شناسه بسته: <bdi>'+esc(p.id)+'</bdi></p><p>اسکن، فرم بررسی سریال‌ها را باز می‌کند؛ دریافت فقط با تأیید ثبت می‌شود.</p></article>';
 return new Response('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>برگه بسته‌های محصول نهایی</title><style>@page{size:A5 portrait;margin:8mm}body{font:14px Tahoma;color:#152434;margin:auto;max-width:132mm}article{break-after:page;padding:5mm;border:1px solid}article:last-child{break-after:auto}.contacts{display:flex;gap:8px}section{flex:1;border:1px solid;padding:6px}h1{font-size:22px}h2{font-size:17px}p{overflow-wrap:anywhere}svg{width:40mm;height:40mm;display:block;margin:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid;padding:5px}button{padding:10px;margin:10px}@media print{button{display:none}}</style><button onclick="window.print()">چاپ / ذخیره PDF</button>'+ (p?[p]:packages).map(html).join('')+'</html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'"}});
 }catch(e){return accessResponse(e)||Response.json({error:e instanceof Error&&!/SQLITE|D1/.test(e.message)?e.message:'بسته دریافت نشد.'},{status:400});}}
export const GET=withServiceRolePreview(get);
