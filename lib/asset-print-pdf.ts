// Browser-only, lossless PDF pages from the already-authorized label DOM.
// No external conversion service, document URL, date or browser page furniture.
export function assetPdfScript(config:{selector:string;width:number;height:number;margin:number}){return 'const assetPdfConfig='+JSON.stringify(config)+';'+String.raw`
let assetPdfBusy=false;
function assetPdfStatus(message){const node=document.getElementById('asset-pdf-status');if(node)node.textContent=message;}
async function buildAssetPdf(){
 await document.fonts.ready;fitAssetLabels();
 const pages=Array.from(document.querySelectorAll(assetPdfConfig.selector));
 if(!pages.length)throw Error('لیبلی برای چاپ وجود ندارد.');
 const enc=new TextEncoder(),ascii=value=>enc.encode(value),objects=[null,[],[]],pageIds=[];
 const stream=(dictionary,bytes)=>[ascii(dictionary+' /Length '+bytes.length+' >>\nstream\n'),bytes,ascii('\nendstream')];
 async function qrImage(svg){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'})),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('رسم کد لیبل انجام نشد.'))};image.src=url;});}
 function lines(ctx,text,maxWidth,nowrap){
  if(nowrap)return [text];const result=[];let line='';
  for(const word of text.split(/\s+/u).filter(Boolean)){
   if(line&&ctx.measureText(line+' '+word).width<=maxWidth){line+=' '+word;continue;}
   if(line){result.push(line);line='';}
   if(ctx.measureText(word).width<=maxWidth){line=word;continue;}
   for(const char of Array.from(word)){if(line&&ctx.measureText(line+char).width>maxWidth){result.push(line);line='';}line+=char;}
  }
  if(line)result.push(line);return result;
 }
 function drawWords(ctx,words,x,y,width,height){
  const elements=Array.from(words.children),gap=parseFloat(getComputedStyle(words).gap)||0;let factor=1,blocks=[];
  for(let attempt=0;attempt<160;attempt++){
   blocks=elements.map(element=>{const style=getComputedStyle(element),size=parseFloat(style.fontSize)*factor;ctx.font=style.fontWeight+' '+size+'px '+style.fontFamily;return {style,size,rows:lines(ctx,element.textContent||'',width,style.whiteSpace==='nowrap')};});
   const total=blocks.reduce((sum,b)=>sum+b.rows.length*b.size*1.5,0)+gap*Math.max(0,blocks.length-1);
   const fits=total<=height&&blocks.every(b=>{ctx.font=b.style.fontWeight+' '+b.size+'px '+b.style.fontFamily;return b.rows.every(line=>ctx.measureText(line).width<=width+.01)});
   if(fits){y+=(height-total)/2;break;}factor*=.94;
  }
  ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const block of blocks){ctx.font=block.style.fontWeight+' '+block.size+'px '+block.style.fontFamily;ctx.direction=block.style.direction;const lineHeight=block.size*1.5;for(const line of block.rows){ctx.fillText(line,x+width/2,y+lineHeight/2);y+=lineHeight;}y+=gap;}
 }
 for(let index=0;index<pages.length;index++){
  assetPdfStatus('آماده‌سازی PDF؛ صفحه '+(index+1).toLocaleString('fa-IR')+' از '+pages.length.toLocaleString('fa-IR'));
  const page=pages[index],rect=page.getBoundingClientRect(),w=assetPdfConfig.width*96/25.4,h=assetPdfConfig.height*96/25.4,margin=assetPdfConfig.margin*96/25.4;
  const scale=Math.min(600/96,Math.sqrt(12000000/(w*h)),16000/w,16000/h),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('خروجی تصویر در مرورگر در دسترس نیست.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(canvas.width/w,canvas.height/h);ctx.imageSmoothingEnabled=false;
  const labels=page.matches('.label')?[page]:Array.from(page.querySelectorAll('.label'));
  for(const label of labels){const qr=label.querySelector('.qr'),svg=qr&&qr.querySelector('svg'),words=label.querySelector('.words');if(!svg||!words)throw Error('محتوای لیبل کامل نیست.');const qrRect=qr.getBoundingClientRect(),textRect=words.getBoundingClientRect();ctx.drawImage(await qrImage(svg),qrRect.left-rect.left+margin,qrRect.top-rect.top+margin,qrRect.width,qrRect.height);drawWords(ctx,words,textRect.left-rect.left+margin,textRect.top-rect.top+margin,textRect.width,textRect.height);}
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,rgb=new Uint8Array(canvas.width*canvas.height*3);for(let i=0,j=0;i<rgba.length;i+=4){rgb[j++]=rgba[i];rgb[j++]=rgba[i+1];rgb[j++]=rgba[i+2];}
  let bytes=rgb,filter='';if(typeof CompressionStream==='function'){bytes=new Uint8Array(await new Response(new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());filter=' /Filter /FlateDecode';}
  const id=objects.length,imageId=id+1,contentId=id+2,pw=assetPdfConfig.width*72/25.4,ph=assetPdfConfig.height*72/25.4;pageIds.push(id);
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
async function showAssetPdf(download=false){
 if(assetPdfBusy)return;assetPdfBusy=true;try{const blob=await buildAssetPdf(),url=URL.createObjectURL(blob);if(download){const link=document.createElement('a');link.href=url;link.download='asset-labels.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);assetPdfStatus('PDF لیبل آماده و دریافت شد.');}else{assetPdfStatus('PDF آماده شد؛ چاپ را از نمایشگر PDF انجام دهید.');window.location.assign(url);}}catch(error){assetPdfStatus('ساخت PDF انجام نشد؛ دوباره تلاش کنید. '+error.message);}finally{assetPdfBusy=false;}
}
`;}
