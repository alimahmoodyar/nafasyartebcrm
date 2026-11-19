export const identityDocumentCategories=['national_card','birth_certificate','spouse_page','children_page'] as const;
export const personnelSelfFileCategories=[...identityDocumentCategories,'insurance_record'] as const;
// Older personnel-file uploads were restricted to HR; their evidence stays valid.
export function acceptedPersonnelFile(file:any){return !file.data.reviewState||file.data.reviewState==='approved';}
export function personnelDocumentStatus(rows:any[],recordId:string){
 const files=rows.filter(r=>r.type==='hr_file'&&r.data.caseId===recordId);
 const missing=identityDocumentCategories.filter(category=>!files.some(r=>r.data.category===category&&acceptedPersonnelFile(r)));
 return {complete:missing.length===0,missing,pending:files.filter(r=>r.data.reviewState==='pending').length};
}
export function personnelBaseApproved(data:any){return data.state==='active'&&!!(data.profileApprovedAt||data.identityCompleteAt);}
