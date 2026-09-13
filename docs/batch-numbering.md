# Internal receipt batch numbering — proposed policy v1

Status: proposed, reviewable in the batch creation form. Existing identifiers remain unchanged.

## Identity and scope

`PART-JALALIDATE-SEQUENCE`, e.g. `1023-14050622-001`.

- PART is the existing stable inventory item identifier, 2–12 decimal digits. Preserve leading zeros. Persian and Arabic digits are normalized to ASCII. Do not invent item codes from names. If the ERP has alphanumeric codes, agree a compatible policy before using this numeric helper.
- JALALIDATE is the receipt date, full Persian year/month/day. The date field stores ISO Gregorian dates; conversion uses an explicit Persian calendar and UTC date-only interpretation.
- SEQUENCE is the next registered receipt batch for that part on that day, padded to at least three digits. It resets for each part/day. Values above 999 expand rather than wrap.
- One internal batch represents one item/specification, supplier, manufacturer lot, and receipt occurrence. Different manufacturer lots in one shipment need separate internal batches. A later receipt of the same manufacturer lot gets its own internal batch; manufacturerLot links their upstream provenance.
- Manufacturer lot is a distinct, verbatim field, not reconstructed from the internal number. Do not fabricate missing manufacturer lots. Supplier, purchase reference, QC status, quantity and price are separate data; they do not alter identity.
- This is a receipt-lot identifier, not an individual component serial number. Individual serialized parts keep their serials in consumption events.

## Behavior and integrity

`GET /api/batch-suggestion` is read-only, checks registered batch numbers and returns a non-reserved candidate. It never consumes a number. Legacy/manual codes matching the prefix also count when computing the maximum.

The helper presents its components and applies a candidate only on an explicit click. Manual edits are preserved and leave generated-scheme mode. After applying a generated candidate, changing the part/date requires a matching new candidate; server validation rejects mismatches. The form retains data on error.

On creation the server normalizes internal batch digits. The database primary key enforces uniqueness. Two callers may see the same suggestion; only one insert can succeed. The other receives HTTP 409 and must refresh and apply a new suggestion. No silent renumbering occurs, since a user may already have copied the displayed number.

Code, part, receipt date and manufacturer lot remain immutable after registration under current update permissions. New fields are additive JSON payload keys; no schema migration or historical rewrite is necessary. Existing manual and legacy records remain valid.

## Verification and limitations

Run `node tests/batch-number.cjs` (Node 22.13+ with node:sqlite; tested on Node 24). Tests cover Persian year/leap-day boundaries, invalid dates, digit normalization, zero preservation, independent sequences, overflow to four digits, read-only suggestions, SQL-backed saves, duplicate conflicts, stale generated codes, manual/legacy compatibility and immutable identifiers. Run the project TypeScript check and Sites build before publishing.

The item master is not yet connected to ERP: entry of the correct stable inventory code remains the operator's responsibility. Supplier/lot homogeneity is an explicit process rule, not verified against physical incoming goods by the software. There is no automatic lot allocation or reservation. Browser interaction QA was not requested for this increment; the existing WebMCP tool was not changed.
