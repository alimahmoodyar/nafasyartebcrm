// Browser-side PDF engine shared by label pages. Only the canvas is written to the PDF.
export const labelPdfScript=String.raw`
async function loadLabelSvg(svg){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'})),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('رسم کد لیبل انجام نشد.'))};image.src=url;});}
async function createLabelPdf(pages,width,height,drawPage,onProgress,dpi=600){
 const enc=new TextEncoder(),ascii=value=>enc.encode(value),objects=[null,[],[]],pageIds=[];
 const stream=(dictionary,bytes)=>[ascii(dictionary+' /Length '+bytes.length+' >>\nstream\n'),bytes,ascii('\nendstream')];
 const w=width*96/25.4,h=height*96/25.4;
 for(let index=0;index<pages.length;index++){
  onProgress(index+1,pages.length);
  const scale=Math.min(dpi/96,Math.sqrt(12000000/(w*h)),16000/w,16000/h),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('خروجی تصویر در مرورگر در دسترس نیست.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(canvas.width/w,canvas.height/h);ctx.imageSmoothingEnabled=false;
  await drawPage(ctx,pages[index]);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,rgb=new Uint8Array(canvas.width*canvas.height*3);for(let i=0,j=0;i<rgba.length;i+=4){rgb[j++]=rgba[i];rgb[j++]=rgba[i+1];rgb[j++]=rgba[i+2];}
  let bytes=rgb,filter='';if(typeof CompressionStream==='function'){bytes=new Uint8Array(await new Response(new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());filter=' /Filter /FlateDecode';}
  const id=objects.length,imageId=id+1,contentId=id+2,pw=width*72/25.4,ph=height*72/25.4;pageIds.push(id);
  objects.push([ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pw.toFixed(6)+' '+ph.toFixed(6)+'] /Resources << /XObject << /Im0 '+imageId+' 0 R >> >> /Contents '+contentId+' 0 R >>')]);
  objects.push(stream('<< /Type /XObject /Subtype /Image /Width '+canvas.width+' /Height '+canvas.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate false'+filter,bytes));
  objects.push(stream('<<',ascii('q\n'+pw.toFixed(6)+' 0 0 '+ph.toFixed(6)+' 0 0 cm\n/Im0 Do\nQ')));canvas.width=canvas.height=1;
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 objects[1]=[ascii('<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling /None >> >>')];objects[2]=[ascii('<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] >>')];
 const chunks=[ascii('%PDF-1.4\n'),new Uint8Array([37,226,227,207,211,10])],offsets=[0];let offset=chunks.reduce((sum,b)=>sum+b.length,0);
 for(let id=1;id<objects.length;id++){offsets.push(offset);const parts=[ascii(id+' 0 obj\n'),...objects[id],ascii('\nendobj\n')];chunks.push(...parts);offset+=parts.reduce((sum,b)=>sum+b.length,0);}
 const start=offset,xref='xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';chunks.push(ascii(xref));return new Blob(chunks,{type:'application/pdf'});
}
`;
