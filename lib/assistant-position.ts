export type Point={x:number;y:number};
export type Viewport={left:number;top:number;width:number;height:number};
export function boundAssistant(p:Point,v:Viewport,w:number,h:number):Point{return {x:Math.max(v.left+12,Math.min(p.x,v.left+v.width-w-12)),y:Math.max(v.top+12,Math.min(p.y,v.top+v.height-h-12))};}
export function assistantPanel(p:Point,v:Viewport,buttonHeight:number){const width=Math.min(420,Math.max(0,v.width-24)),height=Math.min(660,Math.max(0,v.height-24));const x=Math.max(v.left+12,Math.min(p.x,v.left+v.width-width-12));const above=p.y-height-12,below=p.y+buttonHeight+12;const y=above>=v.top+12?above:below+height<=v.top+v.height-12?below:v.top+12;return {left:x,top:y,width,height,maxHeight:height,bottom:'auto' as const};}
