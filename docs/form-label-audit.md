# Form presentation audit — 2026-10-09

Scope: native controls in every `components/trace` component, model-backed forms, assistant tool schemas and confirmation cards. The baseline catalog contains 277 tools; schema coverage enumerates each operation mode, nested object and array item. It is a code and local-render audit, not a production account/data migration.

## Changes

- `form-vocabulary.ts` holds field captions and operation-specific vocabulary. Domain context disambiguates orders, invoice lines, employee requests and currency amounts. Basis-point inputs explicitly state that 100 units equal 1 percent; payload units are unchanged.
- `form-options.ts` maps enumerated wire values by tool and complete field path. Role names and similarly coded business values retain their domain meaning. Free text is never translated by matching words.
- Services and transport use their existing form contracts, including nested rows. `operation-form-fields.ts` describes open-object operations from the documented API contracts; it supplies no business defaults and does not replace server validation.
- Assistant form and confirmation renderers share the presentation layer. Technical request metadata is hidden while the target ID of edits/deletes stays visible. Original arguments and source schemas are unchanged; execution still requires the existing confirmation and authorization.
- Search/filter and row controls that only had an accessible name now also have a persistent visible caption in seven panels.

## Verification

`tests/assistant-workspace.cjs` checks every current tool schema/mode for unnamed fields and untranslated enumerations, schema/argument immutability, contextual role/option meanings, retained delete targets and existing permission/idempotency/confirmation cases. `tests/form-presentation-ui.cjs` renders empty and filled forms, nested service rows and final confirmation; it also audits native control names across all trace components.

User-defined product forms retain their saved field captions. Unknown future keys are explicitly marked as undefined instead of silently called “additional information”; adding a fixed schema field or enum requires a caption to pass coverage. This release does not rename stored custom forms, change authorization or deploy the application.
