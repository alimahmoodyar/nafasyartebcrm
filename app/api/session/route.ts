import {session, accessResponse} from "@/lib/authorization";
export async function GET() {
  try {return Response.json(await session({allowPasswordChange:true}), {headers: {"Cache-Control": "no-store"}});}
  catch (error) {console.error(error); return accessResponse(error) || Response.json({error: "بررسی دسترسی ممکن نشد؛ دوباره تلاش کنید."}, {status: 503});}
}
