// Isolated training tables. Keep aligned with schema.ts; verified by training tests.
import {sql} from "drizzle-orm";
import {sqliteTable,text,index,integer,uniqueIndex,check} from "drizzle-orm/sqlite-core";
export const trainingRecords=sqliteTable("training_records",{id:text("id").primaryKey(),kind:text("kind").notNull(),payload:text("payload").notNull(),created:text("created").notNull()},t=>[index("training_idx_records_kind").on(t.kind)]);

export const trainingAppIdentity=sqliteTable("training_app_identity",{id:text("id").primaryKey(),subject:text("subject").notNull().unique()});
export const trainingAppMembers=sqliteTable("training_app_members",{id:text("id").primaryKey(),email:text("email").notNull().unique(),name:text("name").notNull(),unit:text("unit").notNull(),status:text("status").notNull(),subject:text("subject").unique(),permissions:text("permissions").notNull(),revision:integer("revision").notNull().default(1),created:text("created").notNull(),updated:text("updated").notNull()});
export const trainingAccessAudit=sqliteTable("training_access_audit",{id:text("id").primaryKey(),actor:text("actor").notNull(),target:text("target").notNull(),action:text("action").notNull(),before:text("before"),after:text("after").notNull(),at:text("at").notNull()});

export const trainingFirmwareFiles=sqliteTable("training_firmware_files",{
 versionId:text("version_id").primaryKey().references(()=>trainingRecords.id),
 objectKey:text("object_key").notNull().unique(),
 filename:text("filename").notNull(),
 byteSize:integer("byte_size").notNull(),
 sha256:text("sha256").notNull(),
 uploadedAt:text("uploaded_at").notNull(),
 uploadedBy:text("uploaded_by").notNull(),
});

export const trainingSerialRuns=sqliteTable("training_serial_runs",{
 id:text("id").primaryKey(),productId:text("product_id").notNull().references(()=>trainingRecords.id),
 actor:text("actor").notNull(),day:text("day").notNull(),payload:text("payload").notNull(),created:text("created").notNull(),
},t=>[index("training_idx_serial_runs_day_created").on(t.day,t.created)]);
export const trainingSerialReservations=sqliteTable("training_serial_reservations",{
 serial:text("serial").primaryKey().notNull(),runId:text("run_id").notNull().references(()=>trainingSerialRuns.id),
 productId:text("product_id").notNull().references(()=>trainingRecords.id),
},t=>[index("training_idx_serial_reservations_run").on(t.runId)]);

export const trainingBatchFiles=sqliteTable("training_batch_files",{
 id:text("id").primaryKey(),batchId:text("batch_id").notNull().references(()=>trainingRecords.id),
 objectKey:text("object_key").notNull().unique(),filename:text("filename").notNull(),
 byteSize:integer("byte_size").notNull(),sha256:text("sha256").notNull(),
 uploadedAt:text("uploaded_at").notNull(),uploadedBy:text("uploaded_by").notNull(),
},t=>[index("training_idx_batch_files_batch").on(t.batchId)]);

export const trainingQualityTemplates=sqliteTable("training_quality_templates",{
 id:text("id").primaryKey(),productId:text("product_id").notNull().references(()=>trainingRecords.id),
 version:integer("version").notNull(),title:text("title").notNull(),fields:text("fields").notNull(),
 created:text("created").notNull(),createdBy:text("created_by").notNull(),
},t=>[uniqueIndex("training_idx_quality_template_version").on(t.productId,t.version)]);
export const trainingQualityReports=sqliteTable("training_quality_reports",{
 id:text("id").primaryKey(),deviceId:text("device_id").notNull().references(()=>trainingRecords.id),
 templateId:text("template_id").notNull().references(()=>trainingQualityTemplates.id),values:text("values").notNull(),
 verdict:text("verdict").notNull(),notes:text("notes").notNull(),created:text("created").notNull(),createdBy:text("created_by").notNull(),
},t=>[index("training_idx_quality_reports_device").on(t.deviceId)]);
export const trainingQualityFiles=sqliteTable("training_quality_files",{
 id:text("id").primaryKey(),reportId:text("report_id").notNull().references(()=>trainingQualityReports.id),
 objectKey:text("object_key").notNull().unique(),filename:text("filename").notNull(),byteSize:integer("byte_size").notNull(),
 sha256:text("sha256").notNull(),uploadedAt:text("uploaded_at").notNull(),uploadedBy:text("uploaded_by").notNull(),
},t=>[index("training_idx_quality_files_report").on(t.reportId)]);

export const trainingFinanceFiles=sqliteTable('training_finance_files',{
 id:text('id').primaryKey(),cadence:text('cadence').notNull(),period:text('period').notNull(),reportId:text('report_id').notNull(),
 objectKey:text('object_key').notNull().unique(),filename:text('filename').notNull(),byteSize:integer('byte_size').notNull(),sha256:text('sha256').notNull(),uploadedAt:text('uploaded_at').notNull(),uploadedBy:text('uploaded_by').notNull(),
},t=>[index('training_idx_finance_files_period').on(t.cadence,t.period)]);
export const trainingFinanceNotes=sqliteTable('training_finance_notes',{
 id:text('id').primaryKey(),cadence:text('cadence').notNull(),period:text('period').notNull(),reportId:text('report_id').notNull(),kind:text('kind').notNull(),body:text('body').notNull(),responsible:text('responsible').notNull(),parentId:text('parent_id'),created:text('created').notNull(),createdBy:text('created_by').notNull(),
},t=>[index('training_idx_finance_notes_period').on(t.cadence,t.period)]);

export const trainingLlmConfigs=sqliteTable('training_llm_configs',{
 id:text('id').primaryKey(),name:text('name').notNull(),model:text('model').notNull(),baseUrl:text('base_url').notNull(),systemPrompt:text('system_prompt').notNull(),temperature:text('temperature').notNull(),maxTokens:integer('max_tokens').notNull(),tokenCiphertext:text('token_ciphertext'),revision:integer('revision').notNull().default(1),updated:text('updated').notNull(),updatedBy:text('updated_by').notNull(),
});
export const trainingMcpTokens=sqliteTable('training_mcp_tokens',{
 id:text('id').primaryKey(),tokenHash:text('token_hash').notNull().unique(),subject:text('subject').notNull(),email:text('email').notNull(),name:text('name').notNull(),scope:text('scope').notNull(),expires:text('expires').notNull(),revoked:integer('revoked').notNull().default(0),created:text('created').notNull(),
});
export const trainingMcpStreams=sqliteTable('training_mcp_streams',{
 id:text('id').primaryKey(),tokenId:text('token_id').notNull().references(()=>trainingMcpTokens.id),expires:text('expires').notNull(),lease:text('lease').notNull(),leaseUntil:text('lease_until').notNull(),
},t=>[index('training_idx_mcp_streams_token').on(t.tokenId)]);
export const trainingMcpMessages=sqliteTable('training_mcp_messages',{
 seq:integer('seq').primaryKey({autoIncrement:true}),streamId:text('stream_id').notNull().references(()=>trainingMcpStreams.id,{onDelete:'cascade'}),requestKey:text('request_key').notNull(),requestHash:text('request_hash').notNull(),response:text('response'),created:text('created').notNull(),
},t=>[uniqueIndex('training_idx_mcp_request').on(t.streamId,t.requestKey)]);

// Inventory quantities use thousandths of the displayed unit (no floating-point stock).
export const trainingBomVersions=sqliteTable('training_bom_versions',{
 id:text('id').primaryKey(),productId:text('product_id').notNull().references(()=>trainingRecords.id),version:integer('version').notNull(),lines:text('lines').notNull(),created:text('created').notNull(),actor:text('actor').notNull(),
},t=>[uniqueIndex('training_idx_bom_version').on(t.productId,t.version)]);
export const trainingInventoryBatches=sqliteTable('training_inventory_batches',{
 batchId:text('batch_id').primaryKey().references(()=>trainingRecords.id),partCode:text('part_code').notNull(),unit:text('unit').notNull(),created:text('created').notNull(),
});
export const trainingInventoryOperations=sqliteTable('training_inventory_operations',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),payload:text('payload').notNull(),actor:text('actor').notNull(),created:text('created').notNull(),guard:integer('guard').notNull(),
},t=>[check('training_inventory_operation_guard',sql`${t.guard} = 1`)]);
export const trainingInventoryBalances=sqliteTable('training_inventory_balances',{
 id:text('id').primaryKey(),itemId:text('item_id').notNull().references(()=>trainingRecords.id),warehouse:text('warehouse').notNull(),quantity:integer('quantity').notNull(),
},t=>[uniqueIndex('training_idx_inventory_balance').on(t.itemId,t.warehouse),check('training_inventory_nonnegative',sql`${t.quantity} >= 0`)]);
export const trainingInventoryEntries=sqliteTable('training_inventory_entries',{
 id:text('id').primaryKey(),operationId:text('operation_id').notNull().references(()=>trainingInventoryOperations.id),itemId:text('item_id').notNull().references(()=>trainingRecords.id),warehouse:text('warehouse').notNull(),delta:integer('delta').notNull(),
},t=>[index('training_idx_inventory_entries_item').on(t.itemId)]);
export const trainingProductionOrders=sqliteTable('training_production_orders',{
 id:text('id').primaryKey(),deviceId:text('device_id').notNull().unique().references(()=>trainingRecords.id),bomId:text('bom_id').notNull().references(()=>trainingBomVersions.id),day:text('day').notNull(),operator:text('operator').notNull(),notes:text('notes').notNull(),actor:text('actor').notNull(),created:text('created').notNull(),
});
export const trainingProductionMaterials=sqliteTable('training_production_materials',{
 id:text('id').primaryKey(),orderId:text('order_id').notNull().references(()=>trainingProductionOrders.id),batchId:text('batch_id').notNull().references(()=>trainingRecords.id),warehouse:text('warehouse').notNull(),quantity:integer('quantity').notNull(),
});
export const trainingProductionReceipts=sqliteTable('training_production_receipts',{
 orderId:text('order_id').primaryKey().references(()=>trainingProductionOrders.id),operationId:text('operation_id').notNull().unique().references(()=>trainingInventoryOperations.id),created:text('created').notNull(),
});

export const trainingPasswordAccounts=sqliteTable('training_password_accounts',{
 memberId:text('member_id').primaryKey().references(()=>trainingAppMembers.id),username:text('username').notNull().unique(),passwordHash:text('password_hash').notNull(),passwordCiphertext:text('password_ciphertext'),mustChange:integer('must_change').notNull().default(0),passwordChangedAt:text('password_changed_at'),version:integer('version').notNull().default(1),
});
export const trainingPasswordSessions=sqliteTable('training_password_sessions',{
 hash:text('hash').primaryKey(),memberId:text('member_id').notNull().references(()=>trainingAppMembers.id),version:integer('version').notNull(),expires:text('expires').notNull(),created:text('created').notNull(),
},t=>[index('training_idx_password_sessions_member').on(t.memberId)]);
export const trainingLoginAttempts=sqliteTable('training_login_attempts',{
 key:text('key').primaryKey(),count:integer('count').notNull(),reset:text('reset').notNull(),
});

export const trainingAssistantTurns=sqliteTable('training_assistant_turns',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),question:text('question').notNull(),answer:text('answer'),model:text('model').notNull(),created:text('created').notNull(),
},t=>[index('training_idx_assistant_turns_owner').on(t.owner,t.created)]);

export const trainingFlowEntities=sqliteTable('training_flow_entities',{
 id:text('id').primaryKey(),type:text('type').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(1),created:text('created').notNull(),updated:text('updated').notNull(),
},t=>[index('training_idx_flow_type').on(t.type)]);
export const trainingFlowSlots=sqliteTable('training_flow_slots',{
 location:text('location').primaryKey(),batchId:text('batch_id').notNull().references(()=>trainingRecords.id),quantity:integer('quantity').notNull(),
},t=>[check('training_flow_slot_nonnegative',sql`${t.quantity} >= 0`)]);

export const trainingAssistantActions=sqliteTable('training_assistant_actions',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),turnId:text('turn_id').notNull().references(()=>trainingAssistantTurns.id),tool:text('tool').notNull(),args:text('args').notNull(),state:text('state').notNull(),result:text('result'),created:text('created').notNull(),expires:text('expires').notNull(),
},t=>[index('training_idx_assistant_actions_owner').on(t.owner,t.created)]);

export const trainingDutyRuns=sqliteTable('training_duty_runs',{
 id:text('id').primaryKey(),templateId:text('template_id').notNull(),period:text('period').notNull(),assignee:text('assignee').notNull().references(()=>trainingAppMembers.id),supervisor:text('supervisor'),due:text('due').notNull(),state:text('state').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(1),created:text('created').notNull(),updated:text('updated').notNull(),
},t=>[uniqueIndex('training_idx_duty_occurrence').on(t.templateId,t.period,t.assignee),index('training_idx_duty_assignee_state').on(t.assignee,t.state),index('training_idx_duty_supervisor').on(t.supervisor,t.state)]);
export const trainingDutyFiles=sqliteTable('training_duty_files',{
 id:text('id').primaryKey(),taskId:text('task_id').notNull().references(()=>trainingDutyRuns.id),objectKey:text('object_key').notNull(),filename:text('filename').notNull(),byteSize:integer('byte_size').notNull(),sha256:text('sha256').notNull(),uploadedBy:text('uploaded_by').notNull(),created:text('created').notNull(),
},t=>[index('training_idx_duty_files_task').on(t.taskId)]);
export const trainingDutyNotices=sqliteTable('training_duty_notices',{
 id:text('id').primaryKey(),taskId:text('task_id').notNull().references(()=>trainingDutyRuns.id),recipient:text('recipient').notNull(),phase:text('phase').notNull(),message:text('message').notNull(),created:text('created').notNull(),readAt:text('read_at'),
},t=>[uniqueIndex('training_idx_duty_notice_phase').on(t.taskId,t.recipient,t.phase),index('training_idx_duty_notice_recipient').on(t.recipient,t.readAt)]);

export const trainingSourcingHolds=sqliteTable('training_sourcing_holds',{
 id:text('id').primaryKey(),planId:text('plan_id').notNull().references(()=>trainingFlowEntities.id),partCode:text('part_code').notNull(),unit:text('unit').notNull(),sourceType:text('source_type').notNull(),sourceId:text('source_id').notNull(),quantity:integer('quantity').notNull(),
},t=>[uniqueIndex('training_idx_sourcing_hold_source_plan').on(t.planId,t.sourceType,t.sourceId),index('training_idx_sourcing_hold_source').on(t.sourceType,t.sourceId),check('training_sourcing_hold_positive',sql`${t.quantity}>0`)]);

export const trainingServiceActivations=sqliteTable('training_service_activations',{serial:text('serial').primaryKey(),day:text('day').notNull(),months:integer('months').notNull(),source:text('source').notNull(),created:text('created').notNull(),actor:text('actor').notNull()});
export const trainingServiceLots=sqliteTable('training_service_lots',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),domain:text('domain').notNull(),batchId:text('batch_id').notNull().references(()=>trainingRecords.id),orderId:text('order_id'),lineId:text('line_id'),quantity:integer('quantity').notNull(),unitRial:text('unit_rial').notNull(),created:text('created').notNull(),
},t=>[index('training_idx_service_lots_owner').on(t.owner,t.domain),check('training_service_lot_nonnegative',sql`${t.quantity}>=0`)]);
export const trainingServiceReservations=sqliteTable('training_service_reservations',{
 id:text('id').primaryKey(),caseId:text('case_id').notNull().references(()=>trainingFlowEntities.id),lineId:text('line_id').notNull(),lotId:text('lot_id').notNull().references(()=>trainingServiceLots.id),quantity:integer('quantity').notNull(),
},t=>[uniqueIndex('training_idx_service_reserve_line_lot').on(t.caseId,t.lineId,t.lotId),index('training_idx_service_reserve_lot').on(t.lotId),check('training_service_reservation_positive',sql`${t.quantity}>0`)]);
export const trainingServiceLedger=sqliteTable('training_service_ledger',{
 id:text('id').primaryKey(),agentId:text('agent_id').notNull().references(()=>trainingFlowEntities.id),domain:text('domain').notNull(),kind:text('kind').notNull(),sourceId:text('source_id').notNull(),debit:text('debit').notNull(),credit:text('credit').notNull(),due:text('due'),data:text('data').notNull(),created:text('created').notNull(),actor:text('actor').notNull(),
},t=>[uniqueIndex('training_idx_service_ledger_source_kind').on(t.sourceId,t.kind),index('training_idx_service_ledger_agent').on(t.agentId,t.created)]);
export const trainingServiceOffsets=sqliteTable('training_service_offsets',{
 id:text('id').primaryKey(),debitId:text('debit_id').notNull().references(()=>trainingServiceLedger.id),creditId:text('credit_id').notNull().references(()=>trainingServiceLedger.id),amount:text('amount').notNull(),created:text('created').notNull(),actor:text('actor').notNull(),
},t=>[index('training_idx_service_offset_debit').on(t.debitId),index('training_idx_service_offset_credit').on(t.creditId)]);
export const trainingServiceFiles=sqliteTable('training_service_files',{
 id:text('id').primaryKey(),caseId:text('case_id').notNull().references(()=>trainingFlowEntities.id),purpose:text('purpose').notNull(),objectKey:text('object_key').notNull(),filename:text('filename').notNull(),mime:text('mime').notNull(),byteSize:integer('byte_size').notNull(),sha256:text('sha256').notNull(),created:text('created').notNull(),actor:text('actor').notNull(),
},t=>[index('training_idx_service_files_case').on(t.caseId)]);

export const trainingResetControl=sqliteTable('training_reset_control',{
 id:integer('id').primaryKey(),passwordHash:text('password_hash'),phase:text('phase').notNull().default('testing'),jobId:text('job_id'),internal:integer('internal').notNull().default(0),revision:integer('revision').notNull().default(1),updated:text('updated').notNull(),
},t=>[check('training_reset_singleton',sql`${t.id}=1`),check('training_reset_internal_flag',sql`${t.internal} IN (0,1)`)]);
export const trainingResetJobs=sqliteTable('training_reset_jobs',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),scope:text('scope').notNull(),state:text('state').notNull(),created:text('created').notNull(),expires:text('expires').notNull(),backupKey:text('backup_key'),backupHash:text('backup_hash'),byteSize:integer('byte_size'),summary:text('summary'),downloadedAt:text('downloaded_at'),completed:text('completed'),guard:integer('guard').notNull().default(1),
},t=>[check('training_reset_job_guard',sql`${t.guard}=1`)]);
