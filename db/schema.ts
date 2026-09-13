import {sqliteTable,text,index} from "drizzle-orm/sqlite-core";
export const records=sqliteTable("records",{id:text("id").primaryKey(),kind:text("kind").notNull(),payload:text("payload").notNull(),created:text("created").notNull()},t=>[index("idx_records_kind").on(t.kind)]);
