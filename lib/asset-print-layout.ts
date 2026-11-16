// Physical dimensions are millimetres. QR size is maximized before text size.
export function assetPrintLayout(width:number,height:number,name:string,code:string){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>1000||height>1000)return null;
 const inset=1,gap=1,uw=width-2*inset,uh=height-2*inset;
 const lines=(s:string,w:number,font:number)=>Math.ceil([...s].length/Math.max(1,Math.floor(w/font)));
 let best:{direction:'row'|'column';qr:number;textWidth:number;font:number;textHeight:number}|null=null;
 for(const font of [3.2,3,2.8,2.6])for(const direction of ['row','column'] as const){
  const widths=direction==='column'?[uw]:Array.from({length:Math.max(0,Math.floor(uw-12))},(_,i)=>12+i);
  for(const tw of widths){const th=(lines(name,tw,font)+lines(code,tw,font)+lines('اموال شرکت · نفس‌یار',tw,font*0.8))*font*1.4+2;
   const qr=direction==='row'?Math.min(uh,uw-tw-gap):Math.min(uw,uh-th-gap);
   if(qr<12||direction==='row'&&th>uh)continue;
   if(!best||qr>best.qr+0.01||Math.abs(qr-best.qr)<0.01&&font>best.font)best={direction,qr,textWidth:tw,font,textHeight:th};
  }
 }
 return best;
}
