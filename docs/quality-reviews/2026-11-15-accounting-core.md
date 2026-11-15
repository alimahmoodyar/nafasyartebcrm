# Accounting core / purchase first phase — 2026-11-15

Baseline: GitHub sites/nafasyar-trace 58eaf4e5fd760bb18e1e1428ed32d2d7564e99ea; Sites source 5c5b69099bde312b12f3ca11343f7dab8c9bc086, live v287. All 1267 paths, modes and blobs compared equal, tree 3ee96c0e9a62831098e3684f4c4a1a293a9aabcf.

## Completed checks

25 focused suites passed (2026-11-15T08:49:56.447Z through 2026-11-15T08:52:41.908Z), no failures:

- accounting (5472 ms)
- accounting-purchase (6573 ms)
- accounting-uninvoiced (6259 ms)
- accounting-interleavings (5757 ms)
- accounting-routine (1746 ms)
- accounting-replacement-invoice (7335 ms)
- purchase-returns (6557 ms)
- purchase-adjustments (7240 ms)
- purchase-payables (8312 ms)
- purchase-settlement (6423 ms)
- costing (3422 ms)
- treasury (11013 ms)
- routine-production (26650 ms)
- material-flow (27866 ms)
- finance-workspace (1968 ms)
- finance-control (7396 ms)
- manual-permissions-ui (12200 ms)
- manual-permissions (31338 ms)
- system-reset (31783 ms)
- purchase-services (9071 ms)
- mcp-integration (25635 ms)
- purchase-shipments (23351 ms)
- employee-purchases (24003 ms)
- finance-shortage-ui (3434 ms)
- finance-shortage-access (18838 ms)

TypeScript passed after the access/UI changes. The dependency-wakeup follow-up was additionally checked with core accounting, purchase/interleaving/replacement suites and TypeScript. Official Sites build and full source parity are release gates; exact release SHAs/version/deployment and full diff inventory are retained in the release audit outside the source tree to avoid a self-referential commit hash.

## Financial evidence

- Exact balanced micro-rial journals; immutable economic facts/posted documents, typed three-detail registries, source/version pins, tested-rule preview token, independent reviewer, cancellation/reversal uniqueness and period controls.
- Receipt30, consumptionWIP9, invoice33, subsequent finished6.6/COGS3.3/raw13.2, advance6 and AP27; later invoice correction propagates to actual destinations rather than posting invoice debt twice.
- Supplier transit stays owned/fixed in custody until contractual acceptance; unrelated WIP movements between dispatch and accounting acceptance are retained.
- Before-invoice credit: GRNI30->24, returned2 units frozen6, surviving8 at3.3=26.4, no artificial AP refund. Later WIP/raw remains exact.
- Direct replacement: return6.6, replacement8, debt27->28.4. Alternative real credit7.26 including tax.66 plus actual new invoice8.8 including tax.8 yields AP31.84 and input tax3.44, without duplicate replacement right or net amendment.
- Chained semi production: root60 becomes raw40/semi10/COGS10; repricing66 becomes44/11/11. Legacy stage outputs, worker final output and quarantine releases traced; unknown/unapproved consumed semi is a finance exception. Current derived full semi cost adds approved labor/overhead once and preserves the signed-off baseline.
- Direct treasury allocations cannot be voided independently of their cash source. Active return/exchange blocks simple invoice unrecognition regardless of accounting queue timing. Return tax reservations are checked at approval/acceptance/amendment. Cancelled reversal drafts no longer prevent a later valid reversal.
- Current membership and authority are checked and guarded at commit. Ordinary technical and financial roles, revoked membership collision, external denial, exact source evidence and source scopes covered. UI/HTTP/MCP use the same handlers.
- All98 tables initialize in SQLite; seven new financial tables covered by freeze, backup/reset contract and FK-safe transactional rollback. No applied historical migration changed; 0027 is schema-only and unseeded. Old role_preview_sessions (already introduced in0026 but missing prior snapshot) is represented in the new snapshot without recreating it in SQL.

## UI and boundaries

Local browser fixture checked real accounting components: event/value review, rule form and opening/manual journal; desktop and narrow viewport render. Screenshot is a local preview, not live data or proof of a multi-role hosted workflow. No live synthetic purchase, bank payment, reset or SMS was performed. Private audience and shared operational dataset retained.

Service/multiple-beneficiary costs, unclear ownership, unsupported lineage and statutory reporting are explicit later-scope/finance-review cases, never guessed auto postings. The existing operational UI is reused for source documents, receipt/QC/shelving, settlement and treasury. Legacy all-history workspace loaders and production-scale load/recovery remain documented technical debt, not evidence of measured capacity.
