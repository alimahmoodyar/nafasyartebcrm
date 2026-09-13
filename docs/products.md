# Product catalog

Products use the existing records store (`kind=product`) and audited create / optimistic update API. No migration or automatic relinking of existing devices is performed.

Codes are unique, normalized to uppercase ASCII digits and immutable. Names, groups, models, whole nonnegative warranty months, notes and active/stopped status can be edited. There is no delete operation.

New devices require an active product reference and product read permission. Server copies product code, name, model and warranty months into the immutable device record. Conditional insert checks that the product payload has not changed since validation; device and audit are written in one transaction. Later catalog edits do not rewrite prior device snapshots. Old unlinked device passports remain readable.

Production preset includes product read permission. Existing accounts keep their permissions; an administrator must explicitly grant product read to existing device writers. Granting device write in the account editor also selects product read. Catalog management is independently assignable.

Warranty months do not start a warranty. The established first successful activation-code issuance event remains the only source of warranty start date.

Run `node tests/products.cjs` for validation, identity, snapshots, concurrent changes, backward compatibility and authorization coverage.
