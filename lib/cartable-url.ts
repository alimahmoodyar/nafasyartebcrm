export function cartableUrl(path:string,workspace=''){
 return workspace?path+(path.includes('?')?'&':'?')+'workspace='+encodeURIComponent(workspace):path;
}

export function directInboxUrl(path:string,channel:'direct'|'history'='direct'){
 return path+(path.includes('?')?'&':'?')+'channel='+channel;
}
