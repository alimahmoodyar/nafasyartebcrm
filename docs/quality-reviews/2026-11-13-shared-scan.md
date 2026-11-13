# Shared workflow scan — 2026-11-13

Baseline GitHub: 2222593772c2960f51ffc7e4c8d896af522c57b3 (release branch sites/nafasyar-trace). Baseline live v270 source: 2cb0bc6889e29c0e2254c0154ffaa4fc4e22d434.

## Behavior and evidence

- GET /api/workflow-scan and MCP resolve_workflow_label share authenticated server resolution. Never writes stock, receipts, payments, approvals or role selection. Existing domain forms revalidate at action time.
- Batch labels open exact receiving/QC row or assigned inter-warehouse transfer. Permanent device labels route to office repair/history, production/final QC, authorized finished-goods handoff or assigned driver package. Shipping/carton/driver-receipt identities retain their original scopes and handlers.
- Unknown external text opens identification only for an active configured receiving warehouse custodian. externalLabel is bounded inert evidence on the same receipt, survives retries and remains visible. No duplicate training data or new schema.
- Invalid/version-mismatched/retired/missing internal codes are not supplier receipts. Known but unauthorized serials also never enter the unknown-code fallback. Duplicate codes and multiple open office cases are rejected; multiple permitted routes require selection.
- Supplier URLs are never navigated. Five QR constructors roundtrip; all seven QR print producers are registered in an executable policy test. Existing printed codes stay compatible.
- Camera requests require user gesture; scanner closes after resolution. Role changes invalidate delayed responses. Driver pickup receipt remains linked when creating its service case through the existing handler.

## Validation

19 focused regression suites, including shared resolver, React handler tests, all print-producer registration, incoming QC, shipping/package partial receipts, return cartons, driver receipts/workspace, office service, warehouse operations/profile roles, MCP integration and role navigation. TypeScript checked without incremental cache.

The older driver/expert/office camera UI tests were updated to assert delegation to the shared scanner. Their list, next-action, intake and pagination checks remain; shared-scanner tests now cover one/multiple route handling and delayed-response isolation.

Each resolver test snapshots all test tables before/after every call and checks zero mutations. Receiver/QC/other warehouse/driver/intake/external-agent paths are exercised. Unknown supplier receipt persistence and exact UUID retry were tested through the existing receiving API. No live business fixture was created. Physical phone camera/portable printer and a logged-in browser walkthrough were not performed in this change; no success claim for them.

No migration, dependency upgrade, reset, financial policy change or access expansion. Existing broad workspace loaders are prior debt; resolver lookups are exact and bounded (ambiguity LIMIT 2, related transfers/handoffs LIMIT 21 with an explicit overflow error). Warehouse/member directory loading remains shared existing behavior. Deployment and complete Git-tree comparison proof is recorded outside the source checkout in full-code-audit-20261111/shared-scan to avoid modifying the release after its verification.
