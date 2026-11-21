# Personnel forms: readable amounts and explicit approval feedback

- Scope: personnel insurance confirmation and contract shift-work checkbox alignment; contract base-salary grouping; HR base-approval/account feedback beside the action. Adds contract_edit to the existing shared HR-authorized confirmed/idempotent handler and MCP/form catalogs; no schema or payroll calculation rule change. Existing confirmed/idempotent POST payload and record revision remain unchanged.
- MoneyInput keeps exact integer strings, supports Persian/Arabic paste and caret/deletion behavior, limits to 18 digits, and displays comma grouping. Native required/positive validation accepts the formatted display; the payload remains separator-free.
- Pending/error/success is local to the employee record. Persistent confirmation timestamp and account state come from refreshed server data. Existing accounts, username collisions and deleted-account restoration have distinct text. A successful write followed by failed refresh is reported as saved with a refresh warning, not retried as a failed write. Completed account-processing states show a disabled approved action; legacy approval without an account result can still request account processing.
- Base information approval never claims identity documents are complete. Checkboxes remain native associated label controls, 18px, with 8px RTL gap and a 44px label area. Shift-work flag and existing payroll treatment are preserved; help text describes rotating shifts and required approved shift rules.

## Active contract editing

HR can open an active finalized contract in the same form, with grouped existing salary and required reason. It retains member/renewal linkage, original finalizer/time, signed evidence and prior snapshot; actual editor/time/reason are audited. Existing server CAS/global HR snapshot guard covers concurrent edits and downstream record races. Ended/renewed contracts are not rewritten. Locked work in the old/new date range, noncancelled calculated payroll referencing the contract or overlapping period (unknown ranges fail closed), and existing wage amendments prevent direct editing; the dated salary amendment workflow remains available. Dates/overlap, positive salary/basis, salary effective day and benefits are validated through the existing contract rules. HTTP/MCP share the same mode and permissions; no job access is granted.

## Validation

- personnel-admin-ui: pending/double-submit lock, success, rejection, created/linked/needs_link/needs_restore, refresh failure, incomplete documents, role denial, task switching, active editor/reason and exact contract payload. Updated an outdated approval-button label in its existing task-switch test.
- money-input: exact 18-digit strings, Persian/Arabic paste, caret and deletion behavior, invalid input rejection.
- payroll-approved-ui and personnel-employment: passed, including contract salary validation, existing draft finalization, private evidence, permissions, MCP and atomic race checks. Contract-edit cases cover HR-only permissions, confirmation/reason, immutable member/renewal links, original finalizer/time, prior salary, audit actor, exact retries, stale revisions, HTTP/MCP parity, locked work, existing calculated slips/rulings and concurrent editors. Expected denied-action diagnostics from personnel-employment are intentional.
- personnel-contract-browser: current component is imported through the checkout alias, replacing the old absolute baseline path. In-memory fixture tests native positive validation, formatted salary, unchanged draft details/submissions, clickable adjacent insurance/shift checkboxes, explicit account approval feedback and incomplete document state at true 1280/430/320px viewports. Chrome CDP screenshots use the final rendered DOM. No company records/accounts are created.
- TypeScript passed. Production build and final browser evidence are checked before packaging; external release report records publication results. Existing large-chunk build warnings are unchanged.

## Deployment boundary

GitHub source and owner-private Sites publication are separate from deployment to newcrm.nafasyar.com. Do not claim a company-server deployment without its own verification. External evidence is stored beside the active checkout; no credentials enter source or documentation.
