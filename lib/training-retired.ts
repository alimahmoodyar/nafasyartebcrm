import {requireAccess,accessResponse} from './authorization';

// Kept as a tombstone for existing tabs and old practice links. Never dispatch
// them to real business handlers or initialize/delete stored practice data.
export async function trainingRetired(){
 try{
  await requireAccess();
  return Response.json({error:'محیط جداگانهٔ آزمایش حذف شده است.',code:'training_retired'},{status:410,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
 }catch(error){return accessResponse(error)||Response.json({error:'دسترسی مجاز نیست.'},{status:503});}
}
