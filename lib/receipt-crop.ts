export type ReceiptCrop={x:number;y:number;width:number;height:number};
export type CropHandle='move'|'nw'|'ne'|'sw'|'se';
export const fullReceiptCrop:ReceiptCrop={x:0,y:0,width:1,height:1};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function adjustReceiptCrop(start:ReceiptCrop,handle:CropHandle,dx:number,dy:number):ReceiptCrop{
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return start;
 if(handle==='move')return {...start,x:clamp(start.x+dx,0,1-start.width),y:clamp(start.y+dy,0,1-start.height)};
 const west=handle.endsWith('w'),north=handle.startsWith('n');
 const left=west?clamp(start.x+dx,0,start.x+start.width-0.03):start.x;
 const top=north?clamp(start.y+dy,0,start.y+start.height-0.03):start.y;
 const right=west?start.x+start.width:clamp(start.x+start.width+dx,start.x+0.03,1);
 const bottom=north?start.y+start.height:clamp(start.y+start.height+dy,start.y+0.03,1);
 return {x:left,y:top,width:right-left,height:bottom-top};
}
export function receiptCropPixels(crop:ReceiptCrop,width:number,height:number){
 if(![crop.x,crop.y,crop.width,crop.height,width,height].every(Number.isFinite)||width<1||height<1||crop.width<=0||crop.height<=0)throw Error('Invalid receipt crop');
 const x=clamp(Math.floor(crop.x*width),0,width-1),y=clamp(Math.floor(crop.y*height),0,height-1);
 return {x,y,width:Math.max(1,clamp(Math.ceil((crop.x+crop.width)*width),x+1,width)-x),height:Math.max(1,clamp(Math.ceil((crop.y+crop.height)*height),y+1,height)-y)};
}
