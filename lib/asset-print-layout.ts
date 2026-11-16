// Millimetres, including bounded text regions; small labels remain printable.
export function assetPrintLayout(width:number,height:number,name:string,code:string){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>1000||height>1000)return null;
 const inset=Math.min(1,Math.min(width,height)*.05),border=Math.min(.1,Math.min(width,height)*.02),gap=Math.min(1,Math.min(width,height)*.04),uw=width-2*(inset+border),uh=height-2*(inset+border);
 const estimate=(font:number,tw:number)=>{const line=(text:string,size:number)=>Math.max(1,Math.ceil([...text].length*size*.62/Math.max(.01,tw)));return (line(name,font)*font+font+line('شماره ۲۰ · اموال شرکت · نفس‌یار',font*.8)*font*.8)*1.2+Math.min(.8,uh*.04)*2;};
 const candidates:any[]=[];
 const rowQr=Math.min(uh,uw-gap-Math.min(16,uw*.4));if(rowQr>0)candidates.push({direction:'row',qr:rowQr,textWidth:uw-rowQr-gap,textHeight:uh});
 const minimumTextHeight=Math.min(9,uh*.28),colQr=Math.min(uw,uh-gap-minimumTextHeight);if(colQr>0)candidates.push({direction:'column',qr:colQr,textWidth:uw,textHeight:uh-colQr-gap});
 for(const c of candidates){let lo=.001,hi=3.2;for(let i=0;i<20;i++){const f=(lo+hi)/2;if(estimate(f,c.textWidth)<=c.textHeight)lo=f;else hi=f;}c.font=lo;c.inset=inset;c.border=border;c.gap=gap;c.wordGap=Math.min(.8,c.textHeight*.04);}
 return candidates.sort((a,b)=>b.qr-a.qr||b.font-a.font)[0]||null;
}
