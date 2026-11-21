# Warehouse compact presentation pilot — 2026-11-21

## Authorized scope

Owner approved the compact visual proposal for warehouse personnel and their forms only, with no workflow or authorization changes. Other roles remain outside the pilot pending owner review.

- `central-store` and `line-store` profile previews follow the selected persona even when the authenticated account is administrator.
- Real warehouse personnel use their existing inventory grants or assigned inventory / warehouse supervisor / production store assistant job roles. This predicate chooses appearance only and must never be used for authorization.
- An unscoped administrator sees the pilot in the warehouse section only.
- The existing page root receives one presentation class. Existing portal dialogs inherit the pilot through a scoped CSS selector. No body-wide state, new workflow, API, storage or migration is introduced.

## Visual contract

Neutral background, white panels, 10px control corners, compact neutral icon rows, 40px desktop fields/buttons and 44px coarse-pointer controls. Form text inputs remain 16px. Selected navigation uses a quiet brand tint; submit actions retain green. Tables retain all inventory classifications, quantities, units, batch/serial disclosures, passport links and history actions. The header remains the single visible warehouse breadcrumb.

All CSS is under `@media screen`; label, barcode, QR, report and print layouts are not restyled. No fields, required states, validation, event handlers, network calls, confirmations or stock calculations are changed. UI/HTTP/MCP continue using the same existing domain handlers; there is no new business capability requiring a new MCP action.

## Verification

- `tests/warehouse-compact-presentation.cjs` — warehouse/persona boundaries, non-warehouse previews, administrator warehouse-only and no identity/grant mutation.
- Passed existing warehouse-workspace, warehouse-operations-ui, warehouse-receipt-ui, warehouse-movements, warehouse-receipt-policy, warehouse-stock-groups, profile-permissions-and-receipt-edit, warehouse-dispatch-ui and warehouse-profile-ui checks.
- Existing warehouse-workspace-ui passes with an external Node-only `cloudflare:workers` environment shim, required by an existing imported runtime module. The shim is not shipped.
- TypeScript completed successfully. Framework build completed; existing bundle-size warnings remain.
- Real PersonalHome, WarehouseStockPanel and ReceiptEntryFields were rendered with synthetic local fixtures and built styles for browser layout inspection. This is not a company database test and creates no business records.
- Phone/printer hardware and end-user acceptance remain owner tests. Publication evidence and exact final source/GitHub parity belong in the external release report, not inferred from this document.

## Pre-existing test debt

`tests/warehouse-profile-roles.cjs` fails while creating a member without the newly required HR personnel dossier (HTTP 400 instead of its old expected 201). The identical failure was reproduced on the unchanged GitHub baseline `426de7c2186fca71f1d38f4705c6c1ce3fc3303f`. No personnel or access rule was weakened for this presentation release. Focused permission masks and real-actor warehouse/receipt tests passed separately.
