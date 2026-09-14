export const MAX_BATCH_FILE_BYTES=10*1024*1024;
export type BatchFile={id:string;batch_id:string;filename:string;byte_size:number;sha256:string;uploaded_at:string;uploaded_by:string};
export function validateBatchFile(name:string,size:number){
 if(!name.trim()||name.length>180||/[\x00-\x1f\x7f/\\]/.test(name))throw new Error('نام فایل معتبر نیست؛ نامی کوتاه‌تر از ۱۸۰ نویسه انتخاب کنید.');
 if(size<=0||size>MAX_BATCH_FILE_BYTES)throw new Error('هر فایل باید غیرخالی و حداکثر ۱۰ مگابایت باشد.');
}
