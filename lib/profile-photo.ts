export const profilePhotoImageLimit=64*1024;
export const profilePhotoSourceLimit=384*1024;
export const profilePhotoMinZoom=0.5;
export const profilePhotoMaxZoom=3.5;

export type ProfilePhotoCrop={zoom:number;turns:number;x:number;y:number};
export const initialProfilePhotoCrop:ProfilePhotoCrop={zoom:1,turns:0,x:0,y:0};

export function profilePhotoCrop(value:unknown):ProfilePhotoCrop|null{
 if(!value||typeof value!=='object')return null;
 const {zoom,turns,x,y}=value as ProfilePhotoCrop;
 if(!Number.isFinite(zoom)||zoom<profilePhotoMinZoom||zoom>profilePhotoMaxZoom||
  !Number.isInteger(turns)||turns<0||turns>3||
  !Number.isFinite(x)||Math.abs(x)>1||!Number.isFinite(y)||Math.abs(y)>1)return null;
 return {zoom,turns,x,y};
}

export function profilePhotoFrame(width:number,height:number,crop:ProfilePhotoCrop,size:number){
 const rotatedWidth=crop.turns%2?height:width;
 const rotatedHeight=crop.turns%2?width:height;
 const scale=size/Math.min(rotatedWidth,rotatedHeight)*crop.zoom;
 const panX=Math.max(size*0.12,Math.abs(rotatedWidth*scale-size)/2);
 const panY=Math.max(size*0.12,Math.abs(rotatedHeight*scale-size)/2);
 return {scale,panX,panY};
}
