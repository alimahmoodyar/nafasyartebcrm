import {reservedBatchCodes} from '@/lib/batch-code-reservations';
import {requireAccess, accessResponse} from "@/lib/authorization";
import {normalizePartCode, receiptDay, suggestBatchNumber} from "@/lib/batch-number";

export async function GET(request: Request) {
  try {await requireAccess("batch");} catch(error) {return accessResponse(error) || Response.json({error:"بررسی دسترسی ممکن نشد."},{status:503});}
  const params = new URL(request.url).searchParams;
  const part = params.get("partCode") || "", date = params.get("date") || "";
  try { normalizePartCode(part); receiptDay(date); }
  catch (error) { return Response.json({error: (error as Error).message}, {status: 400}); }
  try {
    return Response.json(suggestBatchNumber(part, date, await reservedBatchCodes()), {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    console.error(error);
    return Response.json({error: "بررسی بچ‌های ثبت‌شده ممکن نشد. دوباره تلاش کنید."}, {status: 503});
  }
}
