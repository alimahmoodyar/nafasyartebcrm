# Nafasyar MCP and LLM configuration

## Entry points and identity
- `POST /mcp`: stateless Streamable HTTP, JSON responses. Protocol negotiation supports 2024-11-05, 2025-03-26, 2025-06-18 and 2025-11-25. `GET /mcp` returns 405 (optional standalone stream not offered there).
- `GET /sse?token=REFERENCE_TOKEN`: legacy HTTP+SSE. Sends `endpoint`, `message`, event IDs and 15-second heartbeat comments. Clients POST JSON-RPC to the returned `/mcp/messages?sessionId=...&token=...` URI.
- Both transports share the same tool dispatcher and business handlers. Tools always use real company records, never browser demo records.
- Site OAuth supplies trusted identity for `/mcp`; explicit reference tokens can alternatively authenticate at the application layer, using the query parameter or `Authorization: Bearer nfy_...`. Invalid explicit credentials never fall back to another identity.
- Discovery (`initialize`, `ping`, `tools/list`) is schema-only. Data operations require a valid account; account disablement, subject binding and current module permissions apply.
- **The hosted Site remains private.** Application reference tokens do not bypass Sites' outer authentication. Use the Site-provisioned OAuth MCP connection for the hosted publication. A token-only URL in Cursor requires a hosting ingress that forwards these MCP routes to the app. Do not make the entire application public to work around this. On another host, additionally replace the trusted Sites identity integration with the company's trusted identity provider; never trust client-supplied identity headers.

## Administrator UI
Menu: مدیریت → تنظیمات LLM و MCP.

LLM profiles contain name, model, system prompt, temperature (0–2), HTTPS base URL and maximum output tokens. The API token is optional, encrypted AES-256-GCM with profile ID as authenticated additional data, and write-only. A blank token preserves the saved secret; explicit removal erases it. Changing the destination requires replacing/removing the old credential. Save/delete uses optimistic revision checks.

Set `LLM_CONFIG_ENCRYPTION_KEY` to base64 encoding of 32 cryptographically random bytes in the deployment secret store. Retain it securely for backup/restore; changing it without re-encryption makes existing credentials unreadable. It is never included in source or exports. Existing provider tokens are never returned through UI or MCP, and are excluded from audit entries.

Profiles now power the floating in-app assistant through an OpenAI-compatible /chat/completions endpoint. Saving a profile sends no provider request; sending a chat message does and may incur provider charges. The provider must support tools, temperature and max_tokens. These settings do not change Cursor/ChatGPT settings and do not enable voice. The runner caps each response at 4096 tokens and uses up to four model rounds and eight read-only tool calls. Business writes are excluded from the chat runner. Chat history is stored per authenticated user in D1; provider keys never reach the browser.

## Reference tokens / Cursor
Administrators create a token for their own current account: name, read-only/read-write scope and expiry (1–90 days). The raw 256-bit token is displayed once. Only its SHA-256 hash is stored. Revocation terminates its SSE sessions and prevents subsequent calls. Current account rights are an additional restriction, not replaced by token scope.

On compatible hosting, `.cursor/mcp.json` (do not commit the real token):
```json
{"mcpServers":{"nafasyar":{"url":"https://YOUR_HOST/sse?token=YOUR_REFERENCE_TOKEN"}}}
```
For Streamable HTTP use `/mcp` and an Authorization bearer header where supported by the client. For the current private Site use its OAuth connection instead of assuming this reference token clears the hosting boundary.

URL tokens are credentials: redact `token` in reverse-proxy/access logs, keep the config private, and do not paste connection URLs into shared tickets. Responses set no-store and no-referrer; the app does not log tokens or tool arguments. No wildcard CORS is enabled. Native MCP clients generally omit Origin; supplied Origins must match the request's origin.

## SSE behavior
- D1-backed sessions and response queue work across Worker isolates; no in-memory session map.
- Maximum four live streams per token; sessions expire after one hour. Resume with Last-Event-ID (`sessionUUID:sequence`) while valid; another token cannot resume or post to the session. A reconnect replaces the old connection lease.
- Repeated POSTs with the same request ID and payload do not execute twice within a session. Changed payload with that ID returns 409. Responses remain available for reconnect replay. Expired sessions and queued data are removed on the next SSE connection.
- Pending results are delivered in sequence. If a result remains unresolved for two minutes, the client receives an inconclusive error and must inspect records before retrying a mutation. This does not roll back an operation already committed.
- Polling uses D1 every two seconds per active connection and periodically rechecks identity/revocation; hosting/database usage is not free. Disconnect stops polling. Host/proxy stream lifetime limits can still force reconnects.
- No sampling, resources, prompts, server-initiated elicitation or background accounting automation is advertised. MCP tool support is independent from optional protocol capabilities.

## Coverage
The catalog returned by `tools/list` is the authoritative typed tool inventory:
- Records: schemas, search/pagination, product/batch/device/event/service/corrective-action creation, permitted updates, exact-serial passport lookup. Event tools cover batch consumption and assembly/delivery stages.
- Batch numbering; serial reservation runs and printable labels; production/activation daily counts.
- Representative/customer distribution history, manual save, parsed Excel preview/import (25-row commit batches).
- Firmware metadata and Intel HEX file operations.
- Versioned QC templates, device QC reports and attachments.
- Daily/weekly financial report catalog, period files, results/questions/answers/closure.
- User administration and LLM profile administration.
- Batch, firmware, QC and finance uploads/downloads. Binary upload is base64; downloads are chunks up to 64 KiB. Existing file-size/type/checksum validators remain authoritative.

Browser-only actions (opening a tab, local window selection, downloading a file to a particular computer, physical printing) are not remote server functions. Print returns HTML. Excel import accepts parsed rows. Use paginated records for JSON export. Windows accounting bridge control and warranty-code generation are not implemented server functions and are not claimed as tools. Connection-token creation/revocation is intentionally in the authenticated admin UI, not a tool that could grant further credentials to an agent.

Tools enforce existing module/stage/admin permissions. Mutations require `confirmed: true` to express caller approval; MCP clients must actually obtain that approval. It is not a separate human-verification mechanism. Business audit entries are retained and MCP adds actor/tool/outcome metadata without arguments. Tool annotations flag writes as destructive. Stored file text and record notes are untrusted content, not instructions to follow.

## Validation / operation
`node tests/mcp-integration.cjs` exercises the real route/business handlers with SQLite and mock R2: protocol, auth, scope, encryption/redaction, concurrency, files, SSE message lifecycle/replay/idempotency and revocation. `tests/access-control.cjs` and `tests/finance-control.cjs` cover existing permission and financial behavior. These are local integration checks, not evidence of an actual Cursor connection across the private hosting boundary.
