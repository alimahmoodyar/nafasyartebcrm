# Paired internal form follow — 2026-11-13

Reported defect: opening edit receipt on the phone did not open that receipt on the paired computer. Root route and field sharing alone did not capture local modal state.

Fix: explicit view-only control markers and stable record identity, serial action delivery, filter checkpoints before opening a search result, exact unique control matching, local-origin deduplication and form-context field keys. Business submission is not replayed; the existing paired commit lock remains. Unavailable controls wait visibly. Protocol 2 requires refreshing and reconnecting both devices under the same account and effective role.

Validation: run the paired domain, two simulated UI contexts with real SQLite/API, DOM identity, registered action safety and receipt/navigation regressions plus TypeScript before publication. The UI regression selects receipt two after filtering, opens that exact form on its peer, shares edits, and prevents duplicate business posting. This is not a physical phone/browser acceptance test. No live inventory or payment data was created.

Data: no schema change, new table or blob; bounded short-lived UI history remains inside device_pair flow_entities with the existing reset, freeze, backup and scrub behavior.

Limits: file bytes and camera/crop state remain local. A role change terminates pairing. Unknown controls are not remotely executed. Complete source comparison and native deployment evidence are recorded outside the source tree so source hashes remain stable.

Completed checks: all 11 targeted suites passed (device-pair, device-pair-ui, shared-form-dom, paired-open-actions, profile-receipt-actions-ui, receipt-workspace-ui, compact-receipts-ui, receipt-entry-ui, material-select-ui, workflow-scanner-ui, mcp-integration). TypeScript noEmit passed. Static action verification covered 567 registered controls in 116 files.
