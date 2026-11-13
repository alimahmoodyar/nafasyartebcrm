# Procurement operational baseline — 2026-11-13

Owner-approved flow: demand → quotations → supply manager selection → financial control → purchase issue/confirmation → partial/full physical receipt → QC → accepted stock. Services continue through their existing requester acceptance, not warehouse stock. Production and service materials retain one shared identity. Manual warehouse request full/subtract behavior is unchanged.

## Decisions and exceptions

- `commerce_manager` chooses the supplier; `ceo` no longer selects ordinary purchases. Three current, technically valid, distinct supplier offers are needed. No weighted quality/price model is introduced. The existing cheapest eligible comparator is advisory only.
- Finance reviews the selected quote before normal issue. A financially rejected selection can be cancelled by supply while awaiting funding. Amendments keep their financial controls. Existing issued orders are not rewritten.
- Urgent, sole-source and contract exceptions require evidence and CEO (or the person assigned the ceo supply authority) approval bound to the exact quote revision. A changed quote needs a new authorization. Urgent selection may issue without prior finance, but creates a separate outstanding financial review. It is not payment authority and cannot bypass technical qualification or actual advance-payment evidence.
- An unforeseen issue is registered against a specific line, with description and evidence. Pending/assigned/development issues block selection, normal issue and purchase confirmation for that line, not unrelated lines or physical receipt. Existing known technical/financial issues retain their owning workflows. Technical runtime errors are not silently turned into business approvals.
- CEO can reject the exception, assign an existing supply role to execute a documented decision, or create a linked development_request atomically. Free text never executes stock, payment or code. Completion is recorded by the assigned role; a rejected urgent financial review returns to finance after resolution, not silently to approved.
- Duties are derived from states and routed through the existing sourcing cartable. Missing role holders remain visible as assignment warnings; no fictitious approver is created. Development completion alone does not release the business issue: the CEO assigns execution and the responsible role records the outcome.

## Physical receipt

- Over-receipt or a different item/unit stays in quarantine with a purchase hold, even after quality passes. The whole held receipt is kept unavailable until its commercial identity is resolved. A valid replacement receipt does not count as over-receipt solely because the rejected original had arrived.
- Supply resolves against an issued matching order for the same supplier/route with enough remaining quantity and completed financial control. New/amended purchase cost goes through the existing financial process. Resolving the link does not physically shelve stock. The UI offers the most recent 100 issued orders; older orders remain addressable through the authenticated MCP/API using their exact IDs/revisions.
- Engineering may exceptionally accept a stated portion of rejected goods with reason before shelving, supplier return or replacement. Original QC is retained in receipt/concession history. A commercial hold is not released by a technical concession. Warehouse still explicitly confirms actual placement.
- Partial receipt, supplier return/replacement, remainder resolution with reason, and financial settlement reuse existing handlers.

## Storage and validation

All records remain in shared existing entities. Exceptions are bounded to 100 per plan; source links, actual actor/time, quote snapshot/revision, decisions and history are retained. Existing transactions, sourcing lock, revision guards, operation IDs, reset freezes and backups apply. No new table or production migration.

Focused automated tests: procurement-decisions, procurement-decisions-ui, sourcing-delivery, sourcing-quote-comparison-ui, direct-purchase-stock, purchase-services, purchase-settlement and TypeScript. Real browser/phone end-to-end acceptance is not established by these tests; browser-control tools were unavailable in this session.
