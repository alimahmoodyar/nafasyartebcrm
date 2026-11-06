export const warehouseTypes:Record<string,string>={storage:'انبار مواد و کالا',production_line:'پای کار / خط تولید',quarantine:'قرنطینه ورودی',scrap:'انبار داغی و ضایعات',other:'سایر محل‌ها'};
export function receiptQuarantine(warehouse:any,warehouses:any[]){
 const q=warehouses.find(q=>q.id===warehouse?.data.quarantineWarehouseId);
 return q&&q.data.active&&q.data.warehouseType==='quarantine'&&q.data.parentId===warehouse.id&&q.data.quarantineFor===warehouse.id?q:null;
}
export function receiptPolicyEnabled(w:any){return w?.data.active&&w.data.warehouseType==='storage'&&w.data.directReceiptEnabled===true&&!!w.receiptQuarantine?.active;}
export function receiptQCWarehouse(receipt:any,warehouses:any[]){return warehouses.find(w=>w.id===(receipt.data.quarantineWarehouseId||receipt.data.warehouseId));}
