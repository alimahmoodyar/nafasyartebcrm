import {sql} from 'drizzle-orm';
import {sqliteTable,text,integer,index,uniqueIndex,check} from 'drizzle-orm/sqlite-core';

export const accountingSettings=sqliteTable('accounting_settings',{
 id:text('id').primaryKey(),data:text('data').notNull(),revision:integer('revision').notNull().default(1),updated:text('updated').notNull(),actor:text('actor').notNull(),
});
export const accountingAccounts=sqliteTable('accounting_accounts',{
 id:text('id').primaryKey(),code:text('code').notNull().unique(),title:text('title').notNull(),parentId:text('parent_id'),level:text('level').notNull(),classification:text('classification').notNull(),details:text('details').notNull(),active:integer('active').notNull().default(1),revision:integer('revision').notNull().default(1),
},t=>[check('account_level',sql`${t.level} IN ('group','general','subsidiary')`)]);
export const accountingPeriods=sqliteTable('accounting_periods',{
 id:text('id').primaryKey(),title:text('title').notNull(),start:text('start').notNull(),end:text('end').notNull(),state:text('state').notNull().default('open'),revision:integer('revision').notNull().default(1),actor:text('actor').notNull(),
},t=>[index('idx_accounting_period_dates').on(t.start,t.end),check('account_period_state',sql`${t.state} IN ('open','closed')`)]);
export const accountingRules=sqliteTable('accounting_rules',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),version:integer('version').notNull(),effective:text('effective').notNull(),end:text('end'),state:text('state').notNull(),data:text('data').notNull(),actor:text('actor').notNull(),created:text('created').notNull(),
},t=>[uniqueIndex('idx_accounting_rule_version').on(t.kind,t.version),index('idx_accounting_rule_effective').on(t.kind,t.effective)]);
export const economicEvents=sqliteTable('economic_events',{
 id:text('id').primaryKey(),sourceKey:text('source_key').notNull().unique(),kind:text('kind').notNull(),sourceId:text('source_id').notNull(),sourceVersion:integer('source_version').notNull(),occurredDay:text('occurred_day').notNull(),created:text('created').notNull(),actor:text('actor').notNull(),payload:text('payload').notNull(),state:text('state').notNull().default('pending'),issue:text('issue'),attempts:integer('attempts').notNull().default(0),
},t=>[index('idx_economic_event_queue').on(t.state,t.created,t.id),index('idx_economic_event_source').on(t.sourceId,t.sourceVersion)]);
export const accountingJournals=sqliteTable('accounting_journals',{
 id:text('id').primaryKey(),eventId:text('event_id').references(()=>economicEvents.id),effectKey:text('effect_key').notNull().unique(),periodId:text('period_id').notNull().references(()=>accountingPeriods.id),day:text('day').notNull(),description:text('description').notNull(),state:text('state').notNull(),ruleId:text('rule_id').references(()=>accountingRules.id),reversesId:text('reverses_id'),totalDebit:text('total_debit').notNull(),totalCredit:text('total_credit').notNull(),actor:text('actor').notNull(),reviewer:text('reviewer'),created:text('created').notNull(),source:text('source').notNull(),
},t=>[index('idx_accounting_journal_day').on(t.day,t.id),index('idx_accounting_journal_event').on(t.eventId),uniqueIndex('idx_accounting_single_reversal').on(t.reversesId).where(sql`${t.reversesId} IS NOT NULL AND ${t.state} != 'cancelled'`),check('account_journal_balanced',sql`${t.totalDebit} = ${t.totalCredit}`),check('account_journal_state',sql`${t.state} IN ('draft','posted','cancelled')`)]);
export const accountingLines=sqliteTable('accounting_lines',{
 id:text('id').primaryKey(),journalId:text('journal_id').notNull().references(()=>accountingJournals.id),accountId:text('account_id').notNull().references(()=>accountingAccounts.id),debit:text('debit').notNull(),credit:text('credit').notNull(),details:text('details').notNull(),dimensions:text('dimensions').notNull(),description:text('description').notNull(),
},t=>[index('idx_accounting_lines_journal').on(t.journalId),index('idx_accounting_lines_account').on(t.accountId,t.journalId)]);
