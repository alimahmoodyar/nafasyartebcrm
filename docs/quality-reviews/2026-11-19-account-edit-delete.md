# Delete account from editing — 2026-11-19

Owner requested an administrator delete action inside account editing and push. This is individual access deletion, separate from the pending clean-start factory-reset request. No live user was deleted.

## Implementation

Reuse the existing administrator-only DELETE /api/users and delete_user MCP handler. Add the delete button to the editing form with the server-provided canDelete protection; current/primary administrator remains protected by the existing server identity checks. Confirmation temporarily hides the editor without discarding edits. Cancelling restores unsaved form state; successful deletion closes and clears the deleted editor and password state and removes its list row. A stale revision marks the editor conflicted and requires refresh before reconfirmation. Submit the original account identity/revision/name, not unsaved renamed values. Correct the confirmation explanation: historical identifiers/records stay; old username handling follows the existing server, which releases the login identity.

Backend semantics remain unchanged: require admin, explicit confirmation, origin and account binding, revision/name validation, transactional audit/gate; mark deleted while preserving historical FK references, revoke password credential/session and MCP access. Repeated deletion is idempotent. This does not erase personnel/business records, reset the installation, delete file storage, or remove every physical member row.

## Validation and limits

Targeted tests: users-delete-ui (opening has no DELETE, explicit confirm, cancel retains draft, account/revision/name payload, success closes both dialogs, protected admin/current account, stale conflict reload); password-accounts (real shared HTTP/MCP deletion, revocation, owner protection, audit/rollback, history and FK preservation); passkeys (existing credential authentication); form-presentation-ui (labels/controls). Type check and build results plus exact source provenance are recorded in the external release audit. No browser, personal server or real business/account mutation was used. Publication is separately verified, never inferred from the GitHub push.
