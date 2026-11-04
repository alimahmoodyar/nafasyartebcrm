// Explicit, disposable receiving configuration for in-memory integration tests.
// No production defaults or permission bypasses are installed by the application.
module.exports=function seedReceivingWarehouse(sql,{id='warehouse:receipt-fixture',name='Synthetic receiving store',inventorySubjects=[]}={}){
 const now='2026-01-01T00:00:00.000Z',qid=id+':quarantine',member='fixture-receipt-qc';
 const put=sql.prepare("INSERT INTO flow_entities(id,type,data,revision,created,updated) VALUES(?,'material_warehouse',?,1,?,?) ON CONFLICT(id) DO NOTHING");
 put.run(id,JSON.stringify({name,active:true,warehouseType:'storage',directReceiptEnabled:true,quarantineWarehouseId:qid,locations:[]}),now,now);
 put.run(qid,JSON.stringify({name:'Quarantine '+name,parentId:id,active:true,warehouseType:'quarantine',directReceiptEnabled:false,quarantineFor:id,internalQuarantine:true,locations:[]}),now,now);
 sql.prepare("INSERT INTO app_members(id,email,name,unit,status,permissions,created,updated) VALUES(?,?,?,'test','active',?,?,?) ON CONFLICT(id) DO NOTHING").run(member,member+'@example.test','Synthetic QC',JSON.stringify({read:['batch'],write:['batch'],eventStages:[],flowRoles:['qc'],warehouseResponsibilities:[{warehouseId:id,role:'qc'}]}),now,now);
 for(const [index,subject] of inventorySubjects.entries()){const mid='fixture-receiver-'+index;sql.prepare("INSERT INTO app_members(id,email,subject,name,unit,status,permissions,created,updated) VALUES(?,?,?,?,'test','active',?,?,?) ON CONFLICT(id) DO NOTHING").run(mid,mid+'@example.test',subject,'Synthetic receiver',JSON.stringify({read:[],write:[],eventStages:[],flowRoles:['inventory'],warehouseResponsibilities:[{warehouseId:id,role:'inventory'}]}),now,now);}
 return {id,quarantineId:qid,qcId:member};
};
