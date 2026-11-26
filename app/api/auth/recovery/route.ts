import {AccessError,accessResponse,checkOrigin,session} from '@/lib/authorization';
import {boundedBody} from '@/lib/firmware-storage';
import {mcpActor} from '@/lib/mcp/context';
import {trainingContext} from '@/lib/training-context';
import {finishEnrollment,finishRecovery,recoveryStatus,startEnrollment,startRecovery} from '@/lib/password-recovery';

const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};

async function memberId(request:Request){
 if(mcpActor.getStore()||trainingContext.getStore())throw new AccessError('تنظیم بازیابی از پروفایل حساب شخصی انجام می‌شود.',403);
 const user=await session();
 if(user.authType!=='password'||!user.userId.startsWith('local:')||user.rolePreview||user.profileReview)
  throw new AccessError('تنظیم بازیابی از پروفایل حساب شخصی انجام می‌شود.',403);
 if(request.headers.get('x-profile-account')!==user.userId)throw new AccessError('حساب تغییر کرده است. صفحه را تازه کنید.',409);
 return user.userId.slice(6);
}

function failure(error:unknown){
 const expected=accessResponse(error);
 if(expected)return expected;
 if(error instanceof SyntaxError)return Response.json({error:'درخواست بازیابی معتبر نیست.'},{status:400,headers});
 if(/UNIQUE constraint failed: password_accounts\.recovery_mobile/.test(String(error)))
  return Response.json({error:'این شماره برای بازیابی حساب دیگری ثبت شده است.'},{status:409,headers});
 if(/inventory_operation_guard/i.test(String(error)))
  return Response.json({error:'درخواست بازیابی تغییر کرده است. دوباره شروع کنید.'},{status:409,headers});
 const missingSchema=/no such column:.*(?:recovery_mobile|recovery_revision|recovery_backup_hash)|no such table:.*password_recovery_challenges/i.test(String(error));
 if(missingSchema)return Response.json({error:'به‌روزرسانی پایگاه داده برای بازیابی رمز روی این سرور کامل نشده است.'},{status:503,headers});
 console.error('Password recovery failed unexpectedly.',{type:error instanceof Error?error.name:typeof error});
 return Response.json({error:'بازیابی در حال حاضر در دسترس نیست. دوباره تلاش کنید.'},{status:503,headers});
}

export async function GET(request:Request){
 try{return Response.json(await recoveryStatus(await memberId(request)),{headers});}
 catch(error){return failure(error);}
}

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const input=JSON.parse(new TextDecoder().decode(await boundedBody(request,4096)));
  if(!input||typeof input!=='object'||Array.isArray(input))throw new AccessError('درخواست بازیابی معتبر نیست.',400);
  const client=(request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||'shared').trim().slice(0,64);
  switch(input.action){
   case 'enroll_start': return Response.json(await startEnrollment(await memberId(request),input),{headers});
   case 'enroll_confirm': return Response.json(await finishEnrollment(await memberId(request),input),{headers});
   case 'reset_start': return Response.json(await startRecovery(input,client),{headers});
   case 'reset_confirm': return Response.json(await finishRecovery(input,client),{headers});
   default: throw new AccessError('درخواست بازیابی معتبر نیست.',400);
  }
 }catch(error){return failure(error);}
}