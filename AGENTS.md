# Nafasyar development rules

- Every new business capability must also have a corresponding MCP tool in `lib/mcp/tools.ts`, reusing the authenticated domain handler. Maintain parity when changing existing features.
- Enforce the same roles, validation, confirmations, idempotency and auditing in UI, HTTP and MCP. Never expose passwords, provider tokens or session credentials.
- Add a concise entry to `docs/CHANGELOG.md` for each release and verify meaningful permission/data-integrity cases.
- Push completed changes to GitHub `alimahmoodyar/nafasyartebcrm`, branch `sites/nafasyar-trace` for this TypeScript/Cloudflare app. `main` contains the separate .NET 8 application; do not overwrite it.
- Keep credentials outside the repository. A source push does not deploy the .NET application.
