# Nafasyar development rules

- Every new business capability must also have a corresponding MCP tool in `lib/mcp/tools.ts`, reusing the authenticated domain handler. Maintain parity when changing existing features.
- Enforce the same roles, validation, confirmations, idempotency and auditing in UI, HTTP and MCP. Never expose provider tokens or session credentials. Per the explicit owner request, current local passwords may be revealed ONLY by the audited, reauthenticated admin browser endpoint; never expose password plaintext/ciphertext in general APIs, MCP, assistant history, exports or audit snapshots.
- Add a concise entry to `docs/CHANGELOG.md` for each release and verify meaningful permission/data-integrity cases.
- Push completed changes to GitHub `alimahmoodyar/nafasyartebcrm`, branch `sites/nafasyar-trace` for this TypeScript/Cloudflare app. `main` contains the separate .NET 8 application; do not overwrite it.
- Keep credentials outside the repository. A source push does not deploy the .NET application.

- When adding persistent business data, update `lib/reset-contract.ts` and the reset freeze triggers/migrations so preview, backup, delete ordering and preservation stay complete. Test FK-safe rollback; never run reset on production merely to test a release.

## Admin workflow testing and role access

- The system administrator may advance an end-to-end workflow from the owning module for process testing and operational oversight. Keep each action in its domain module; do not create a parallel admin-only workflow.
- Administrator actions must pass the same workflow state, validation, confirmation, idempotency and data-integrity checks as other users. Record the authenticated administrator as the actual actor; never impersonate a business role or fabricate an approval by another person.
- Configure ordinary users later with explicit, least-privilege access per role and operation. Navigation visibility is not authorization: enforce record and action permissions in the server handler, and keep HTTP, UI and MCP behavior aligned.
- Preserve segregation of duties for sensitive approvals. When the administrator personally performs an approval during a test, record it as the administrator's approval; do not treat it as proof that the intended role's permissions work.
- Before release, walk each workflow as administrator to validate transitions, then verify each role with its own account and confirm it sees and performs only its assigned work. Keep test evidence separate from real financial, inventory and supplier records.
- Create business test records through the owning forms or their authenticated operation handlers in isolated test data. Walk role to role using the same record ID, and verify the destination worklist and search; do not inject a display-only record into the final screen as evidence of a workflow test.
