export type WorkspaceBackEntry={element:()=>HTMLElement|null;handler:()=>void;priority:number;order:number;modal?:boolean};

export function visibleWorkspaceBack(entry:WorkspaceBackEntry){
 const node=entry.element();
 if(!node||!node.isConnected||!node.getClientRects().length||node.closest('[hidden], [aria-hidden="true"], [data-state="closed"]'))return false;
 if(typeof window!=='undefined'&&window.getComputedStyle(node).visibility==='hidden')return false;
 return true;
}

export function currentWorkspaceBack(entries:WorkspaceBackEntry[]){
 const depth=(entry:WorkspaceBackEntry)=>{let node=entry.element(),n=0;while(node){n++;node=node.parentElement;}return n;};
 const visible=entries.filter(visibleWorkspaceBack),compare=(a:WorkspaceBackEntry,b:WorkspaceBackEntry)=>b.priority-a.priority||depth(b)-depth(a)||b.order-a.order;
 const modal=visible.filter(entry=>entry.modal).sort(compare)[0];
 if(modal){const shell=modal.element();return visible.filter(entry=>entry!==modal&&!!shell?.contains(entry.element())).sort(compare)[0]||modal;}
 return visible.sort(compare)[0];
}
