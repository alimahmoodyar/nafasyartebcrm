# Nafasyar development rules

- Every new business capability must also have a corresponding MCP tool in `lib/mcp/tools.ts`, reusing the authenticated domain handler. Maintain parity when changing existing features.
- Enforce the same roles, validation, confirmations, idempotency and auditing in UI, HTTP and MCP. Never expose provider tokens or session credentials. Per the explicit owner request, current local passwords may be revealed ONLY by the audited, reauthenticated admin browser endpoint; never expose password plaintext/ciphertext in general APIs, MCP, assistant history, exports or audit snapshots.
- Add a concise entry to `docs/CHANGELOG.md` for each release and verify meaningful permission/data-integrity cases.
- Push completed changes to GitHub `alimahmoodyar/nafasyartebcrm`, branch `sites/nafasyar-trace` for this TypeScript/Cloudflare app. `main` contains the separate .NET 8 application; do not overwrite it.
- Keep credentials outside the repository. A source push does not deploy the .NET application.

- When adding persistent business data, update `lib/reset-contract.ts` and the reset freeze triggers/migrations so preview, backup, delete ordering and preservation stay complete. Test FK-safe rollback; never run reset on production merely to test a release.
