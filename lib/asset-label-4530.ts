export const approvedAssetLabelScript=String.raw`
let approvedAssetsReady;
function prepareApprovedAssets(){
 if(approvedAssetsReady)return approvedAssetsReady;
 return approvedAssetsReady=(async()=>{
  const labels=document.querySelectorAll('.approved-asset');
  if(!labels.length)return;
  await document.fonts.load('800 34px Vazirmatn');
  await document.fonts.ready;
  const logo=new Image();
  logo.src='/brand/nafasyar-logo.png';
  await logo.decode();
  for(const label of labels){
   const canvas=label.querySelector('canvas');
   const ctx=canvas.getContext('2d');
   ctx.fillStyle='white';ctx.fillRect(0,0,360,240);
   ctx.filter='grayscale(1) contrast(2)';
   ctx.drawImage(logo,200,6,146,75);ctx.filter='none';
   ctx.fillStyle='black';ctx.fillRect(174,88,174,2);
   ctx.drawImage(await loadLabelSvg(label.querySelector('svg')),17,35,132,132);
   const write=(value,x,y,size,font,space,align='right')=>{
    ctx.textAlign=align;ctx.direction=font.includes('Arial')?'ltr':'rtl';
    ctx.font=font.replace('SIZE',size);
    while(size>4&&ctx.measureText(value).width>space)ctx.font=font.replace('SIZE',--size);
    ctx.fillText(value,x,y,space);
   };
   write(label.dataset.name,348,135,34,'800 SIZEpx Vazirmatn',180);
   write('شماره اموال',348,177,21,'600 SIZEpx Vazirmatn',175);
   write(label.dataset.assetCode,348,216,32,'bold SIZEpx Arial',183);
   if(label.dataset.assetNumber){
    write('ردیف ثبت گروهی: '+Number(label.dataset.assetNumber).toLocaleString('fa-IR',{minimumIntegerDigits:2}),83,208,16,'650 SIZEpx Vazirmatn',154,'center');
   }
   const pixels=ctx.getImageData(0,0,360,240);
   for(let i=0;i<pixels.data.length;i+=4){
    const ink=pixels.data[i]<175?0:255;
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=ink;
   }
   ctx.putImageData(pixels,0,0);
  }
 })().catch(error=>{approvedAssetsReady=null;throw error;});
}
window.addEventListener('load',()=>prepareApprovedAssets().catch(()=>assetPdfStatus('آماده‌سازی طرح لیبل انجام نشد.')));
`;
