import * as expenseRegister from '@/app/api/expense-register/route';
import * as purchaseSettlement from '@/app/api/purchase-settlement/route';
import * as settlementFiles from '@/app/api/purchase-settlement/files/route';
import * as costing from '@/app/api/costing/route';
import * as expenses from '@/app/api/hospital/expenses/route';
import * as expenseFiles from '@/app/api/hospital/expenses/files/route';
import * as hospital from '@/app/api/hospital/route';
import * as hospitalFiles from '@/app/api/hospital/files/route';
import * as hospitalAssistant from '@/app/api/hospital/assistant/route';
// Explicit allowlist: authentication, users, secrets, real reset and external AI are never delegated.
import * as route0 from '@/app/api/firmware/route';
import * as route1 from '@/app/api/finance/route';
import * as route2 from '@/app/api/session/route';
import * as route3 from '@/app/api/records/route';
import * as route4 from '@/app/api/suppliers/route';
import * as route5 from '@/app/api/flow/route';
import * as route6 from '@/app/api/batch-files/route';
import * as route7 from '@/app/api/serials/route';
import * as route8 from '@/app/api/batch-suggestion/route';
import * as route9 from '@/app/api/sourcing/route';
import * as route10 from '@/app/api/development/route';
import * as route11 from '@/app/api/device-analytics/route';
import * as route12 from '@/app/api/replenishment/route';
import * as route13 from '@/app/api/production/route';
import * as route14 from '@/app/api/transport/route';
import * as route15 from '@/app/api/bom-import/route';
import * as route16 from '@/app/api/fulfillment/route';
import * as route17 from '@/app/api/after-sales/route';
import * as route18 from '@/app/api/distribution/route';
import * as route19 from '@/app/api/tasks/route';
import * as route20 from '@/app/api/profile/route';
import * as route21 from '@/app/api/inbox/route';
import * as route22 from '@/app/api/sales/route';
import * as route23 from '@/app/api/firmware/files/route';
import * as route24 from '@/app/api/finance/files/route';
import * as route25 from '@/app/api/suppliers/files/route';
import * as route26 from '@/app/api/suppliers/quality/route';
import * as route27 from '@/app/api/serials/print/route';
import * as route28 from '@/app/api/transport/files/route';
import * as route29 from '@/app/api/after-sales/print/route';
import * as route30 from '@/app/api/after-sales/files/route';
import * as route31 from '@/app/api/tasks/files/route';
import * as route32 from '@/app/api/tasks/tick/route';
import * as route33 from '@/app/api/quality/reports/route';
import * as route34 from '@/app/api/quality/templates/route';
import * as route35 from '@/app/api/quality/files/route';
import * as route36 from '@/app/api/inbox/files/route';
import * as route37 from '@/app/api/sales/files/route';
import * as route38 from '@/app/api/sales/quote/route';
import * as route39 from '@/app/api/sales/monitor/route';
export const trainingRoutes:Record<string,Record<string,any>>={
 hospital,
 "purchase-settlement":purchaseSettlement,
 "purchase-settlement/files":settlementFiles,
 "costing":costing,
 "expense-register":expenseRegister,
 "hospital/expenses":expenses,
 "hospital/expenses/files":expenseFiles,
 "hospital/files":hospitalFiles,
 "hospital/assistant":hospitalAssistant,
 'firmware':route0,
 'finance':route1,
 'session':route2,
 'records':route3,
 'suppliers':route4,
 'flow':route5,
 'batch-files':route6,
 'serials':route7,
 'batch-suggestion':route8,
 'sourcing':route9,
 'development':route10,
 'device-analytics':route11,
 'replenishment':route12,
 'production':route13,
 'transport':route14,
 'bom-import':route15,
 'fulfillment':route16,
 'after-sales':route17,
 'distribution':route18,
 'tasks':route19,
 'profile':route20,
 'inbox':route21,
 'sales':route22,
 'firmware/files':route23,
 'finance/files':route24,
 'suppliers/files':route25,
 'suppliers/quality':route26,
 'serials/print':route27,
 'transport/files':route28,
 'after-sales/print':route29,
 'after-sales/files':route30,
 'tasks/files':route31,
 'tasks/tick':route32,
 'quality/reports':route33,
 'quality/templates':route34,
 'quality/files':route35,
 'inbox/files':route36,
 'sales/files':route37,
 'sales/quote':route38,
 'sales/monitor':route39,
};
