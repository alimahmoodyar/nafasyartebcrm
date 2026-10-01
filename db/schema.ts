import {sqliteTable,text,index,integer,uniqueIndex} from "drizzle-orm/sqlite-core";
export const records=sqliteTable("records",{id:text("id").primaryKey(),kind:text("kind").notNull(),payload:text("payload").notNull(),created:text("created").notNull()},t=>[index("idx_records_kind").on(t.kind)]);

export const appIdentity=sqliteTable("app_identity",{id:text("id").primaryKey(),subject:text("subject").notNull().unique()});
export const appMembers=sqliteTable("app_members",{id:text("id").primaryKey(),email:text("email").notNull().unique(),name:text("name").notNull(),unit:text("unit").notNull(),status:text("status").notNull(),subject:text("subject").unique(),permissions:text("permissions").notNull(),revision:integer("revision").notNull().default(1),created:text("created").notNull(),updated:text("updated").notNull()});
export const accessAudit=sqliteTable("access_audit",{id:text("id").primaryKey(),actor:text("actor").notNull(),target:text("target").notNull(),action:text("action").notNull(),before:text("before"),after:text("after").notNull(),at:text("at").notNull()});

export const firmwareFiles=sqliteTable("firmware_files",{
 versionId:text("version_id").primaryKey().references(()=>records.id),
 objectKey:text("object_key").notNull().unique(),
 filename:text("filename").notNull(),
 byteSize:integer("byte_size").notNull(),
 sha256:text("sha256").notNull(),
 uploadedAt:text("uploaded_at").notNull(),
 uploadedBy:text("uploaded_by").notNull(),
});

export const serialRuns=sqliteTable("serial_runs",{
 id:text("id").primaryKey(),productId:text("product_id").notNull().references(()=>records.id),
 actor:text("actor").notNull(),day:text("day").notNull(),payload:text("payload").notNull(),created:text("created").notNull(),
},t=>[index("idx_serial_runs_day_created").on(t.day,t.created)]);
export const serialReservations=sqliteTable("serial_reservations",{
 serial:text("serial").primaryKey().notNull(),runId:text("run_id").notNull().references(()=>serialRuns.id),
 productId:text("product_id").notNull().references(()=>records.id),
},t=>[index("idx_serial_reservations_run").on(t.runId)]);

export const batchFiles=sqliteTable("batch_files",{
 id:text("id").primaryKey(),batchId:text("batch_id").notNull().references(()=>records.id),
 objectKey:text("object_key").notNull().unique(),filename:text("filename").notNull(),
 byteSize:integer("byte_size").notNull(),sha256:text("sha256").notNull(),
 uploadedAt:text("uploaded_at").notNull(),uploadedBy:text("uploaded_by").notNull(),
},t=>[index("idx_batch_files_batch").on(t.batchId)]);

export const qualityTemplates=sqliteTable("quality_templates",{
 id:text("id").primaryKey(),productId:text("product_id").notNull().references(()=>records.id),
 version:integer("version").notNull(),title:text("title").notNull(),fields:text("fields").notNull(),
 created:text("created").notNull(),createdBy:text("created_by").notNull(),
},t=>[uniqueIndex("idx_quality_template_version").on(t.productId,t.version)]);
export const qualityReports=sqliteTable("quality_reports",{
 id:text("id").primaryKey(),deviceId:text("device_id").notNull().references(()=>records.id),
 templateId:text("template_id").notNull().references(()=>qualityTemplates.id),values:text("values").notNull(),
 verdict:text("verdict").notNull(),notes:text("notes").notNull(),created:text("created").notNull(),createdBy:text("created_by").notNull(),
},t=>[index("idx_quality_reports_device").on(t.deviceId)]);
export const qualityFiles=sqliteTable("quality_files",{
 id:text("id").primaryKey(),reportId:text("report_id").notNull().references(()=>qualityReports.id),
 objectKey:text("object_key").notNull().unique(),filename:text("filename").notNull(),byteSize:integer("byte_size").notNull(),
 sha256:text("sha256").notNull(),uploadedAt:text("uploaded_at").notNull(),uploadedBy:text("uploaded_by").notNull(),
},t=>[index("idx_quality_files_report").on(t.reportId)]);

export const financeFiles=sqliteTable('finance_files',{
 id:text('id').primaryKey(),cadence:text('cadence').notNull(),period:text('period').notNull(),reportId:text('report_id').notNull(),
 objectKey:text('object_key').notNull().unique(),filename:text('filename').notNull(),byteSize:integer('byte_size').notNull(),sha256:text('sha256').notNull(),uploadedAt:text('uploaded_at').notNull(),uploadedBy:text('uploaded_by').notNull(),
},t=>[index('idx_finance_files_period').on(t.cadence,t.period)]);
export const financeNotes=sqliteTable('finance_notes',{
 id:text('id').primaryKey(),cadence:text('cadence').notNull(),period:text('period').notNull(),reportId:text('report_id').notNull(),kind:text('kind').notNull(),body:text('body').notNull(),responsible:text('responsible').notNull(),parentId:text('parent_id'),created:text('created').notNull(),createdBy:text('created_by').notNull(),
},t=>[index('idx_finance_notes_period').on(t.cadence,t.period)]);

export const llmConfigs=sqliteTable('llm_configs',{
 id:text('id').primaryKey(),name:text('name').notNull(),model:text('model').notNull(),baseUrl:text('base_url').notNull(),systemPrompt:text('system_prompt').notNull(),temperature:text('temperature').notNull(),maxTokens:integer('max_tokens').notNull(),tokenCiphertext:text('token_ciphertext'),revision:integer('revision').notNull().default(1),updated:text('updated').notNull(),updatedBy:text('updated_by').notNull(),
});
export const mcpTokens=sqliteTable('mcp_tokens',{
 id:text('id').primaryKey(),tokenHash:text('token_hash').notNull().unique(),subject:text('subject').notNull(),email:text('email').notNull(),name:text('name').notNull(),scope:text('scope').notNull(),expires:text('expires').notNull(),revoked:integer('revoked').notNull().default(0),created:text('created').notNull(),
});
export const mcpStreams=sqliteTable('mcp_streams',{
 id:text('id').primaryKey(),tokenId:text('token_id').notNull().references(()=>mcpTokens.id),expires:text('expires').notNull(),lease:text('lease').notNull(),leaseUntil:text('lease_until').notNull(),
},t=>[index('idx_mcp_streams_token').on(t.tokenId)]);
export const mcpMessages=sqliteTable('mcp_messages',{
 seq:integer('seq').primaryKey({autoIncrement:true}),streamId:text('stream_id').notNull().references(()=>mcpStreams.id,{onDelete:'cascade'}),requestKey:text('request_key').notNull(),requestHash:text('request_hash').notNull(),response:text('response'),created:text('created').notNull(),
},t=>[uniqueIndex('idx_mcp_request').on(t.streamId,t.requestKey)]);
