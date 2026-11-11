/** Read-only presentation of the scoped service APIs; never creates financial entries. */
export function serviceDashboardSummary(workspace:any,commercial:any,contracts:any,agentId:string){
 const collection=workspace?.ownAgent===agentId?workspace.collection:null,account=commercial?.accounts?.find((a:any)=>a.agentId===agentId),agent=contracts?.agents?.find((a:any)=>a.id===agentId),contract=contracts?.contracts?.find((c:any)=>c.id===agent?.currentContractId);
 const net=collection?BigInt(collection.netRial):null,limit=account?.limitRial==null?null:BigInt(account.limitRial),exposure=account?.outstandingRial==null?null:BigInt(account.outstandingRial);
 return {balanceLabel:net===null?'مانده حساب':net<BigInt(0)?'مانده طلب':net===BigInt(0)?'مانده حساب':'مانده بدهی',balanceRial:net===null?null:(net<BigInt(0)?-net:net).toString(),availableRial:limit===null||exposure===null?null:(limit>exposure?limit-exposure:BigInt(0)).toString(),limitRial:limit?.toString()??null,heldRial:collection?.heldWarrantyRial??null,collectibleRial:collection?.collectibleRial??null,contract:contract||null};
}
