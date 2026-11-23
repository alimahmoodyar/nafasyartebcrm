export function cartableUrl(path:string,workspace=''){
 return workspace?path+(path.includes('?')?'&':'?')+'workspace='+encodeURIComponent(workspace):path;
}
