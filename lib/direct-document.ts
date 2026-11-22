export const documentPrintScript='<script defer src="/label-printer/documents.js"></script>';
export function documentPrintButton(width=210,height=297,pdfOnly=false){
 return '<button type="button" data-office-print '+(pdfOnly?'data-pdf-only':'')+' data-width="'+width+'" data-height="'+height+'">'+(pdfOnly?'دریافت PDF':'چاپ مستقیم / دریافت PDF')+'</button>'+documentPrintScript;
}

type PrintOptions={width:number;height:number;source?:HTMLElement;extraCss?:string};
export async function openDocumentPrint(options:PrintOptions){
 const host=window as typeof window & {hamnafasDocuments?:{open:(options:PrintOptions)=>void}};
 if(!host.hamnafasDocuments){
  await new Promise<void>((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='/label-printer/documents.js';
   script.onload=()=>resolve();
   script.onerror=()=>reject(Error('ابزار چاپ بارگذاری نشد.'));
   document.head.appendChild(script);
  });
 }
 host.hamnafasDocuments!.open(options);
}
