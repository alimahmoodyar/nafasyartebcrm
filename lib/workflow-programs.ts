import {qmsRoles} from './qms-contract';

// Programs are workflow entry points, not every data type a workflow needs.
// Reading a product or batch to deliver an order never grants its master app.
export const roleWorkflowPrograms:Record<string,string[]>={
 inventory:['build-projects','flow','inventory','sourcing','fulfillment','sales'],
 warehouse_supervisor:['build-projects','flow','inventory','sourcing','fulfillment','sales'],
 production_store_assistant:['flow','inventory'],
 production:['build-intake','build-projects','routine-production','sourcing','flow','fulfillment','event','device','serials','analytics'],
 planning:['sourcing'],
 engineering:['build-intake','qms','sourcing','routine-production','build-projects'],
 qc:['qms','sourcing','flow','routine-production','build-projects','action'],
 domestic:['sourcing','transport'],foreign:['sourcing','transport'],commerce:['sourcing','transport'],
 domestic_commerce_lead:['sourcing','transport'],foreign_commerce_lead:['sourcing','transport'],
 purchase_finance:['build-projects','sourcing','treasury'],
 finance:['costing','pricing','finance-control','transport'],
 ceo:['build-intake','after-sales','hospital','sourcing','qms','routine-production','build-projects','pricing'],
 sales:['build-intake','sales','sourcing','fulfillment','transport'],
 home_sales:['sales','fulfillment','transport'],
 hospital_sales:['build-intake','sales','sourcing','fulfillment','transport'],
 sales_manager_assistant:['build-intake','sales','sourcing','fulfillment','transport'],
 sales_manager:['build-intake','after-sales','hospital','activation-code','sales','sales-bank','sourcing','fulfillment','transport'],
 sales_finance:['sales','sales-bank'],sales_viewer:['sales'],
 delivery:['sales','fulfillment','transport'],
 transport_manager:['transport','sourcing'],driver:['transport'],
 custodian:['assets'],firmware:['firmware','device'],
 viewer:['overview','analytics','product','batch','device','event','service','action','distribution','firmware'],
 product_manager:['product'],
 treasurer:['treasury','guarantees','sales-bank'],finance_director:['build-projects','treasury','guarantees','costing','pricing','finance-control','transport'],
 accounting_head:['build-projects','treasury','costing','pricing','finance-control'],ceo_payment:['treasury'],warehouse_finance:['build-projects','costing','pricing','inventory'],
 sales_agent:['sales','fulfillment','transport'],service_agent:['after-sales','hospital'],
 service_manager:['after-sales','hospital','transport'],service_support:['after-sales','activation-code','hospital','transport'],
 service_intake:['after-sales','activation-code','hospital','transport'],service_technician:['build-projects','after-sales','activation-code','hospital','transport'],
 service_coordinator:['after-sales','hospital','transport'],service_inventory:['after-sales','hospital','transport'],
 service_finance:['after-sales','hospital','transport'],
};
for(const role of ['hr','payroll','approver','finance','treasury','executive_viewer','reporter'])roleWorkflowPrograms['personnel_'+role]=[];
for(const role of Object.keys(qmsRoles))if(role!=='qc')roleWorkflowPrograms['quality_'+role]=['qms'];

export const selfServicePrograms=['tasks','personnel','development','reminders','mobile-install'];
export function programsForRoles(roles:string[]){return [...new Set(roles.flatMap(role=>roleWorkflowPrograms[role]||[]))];}
