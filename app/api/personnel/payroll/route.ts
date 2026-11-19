import {requireAccess,accessResponse} from '@/lib/authorization';
import {payrollRead} from '@/lib/personnel-payroll-read';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
export async function GET(request:Request){try{const user=await requireAccess(),q=Object.fromEntries(new URL(request.url).searchParams);return Response.json(await payrollRead(user,q),{headers})}catch(e){return accessResponse(e)||Response.json({error:'گزارش حقوق دریافت نشد؛ دوباره تلاش کنید.'},{status:503,headers})}}
