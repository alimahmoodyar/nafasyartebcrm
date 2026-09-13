# Daily serial allocation and printing

Production users with device write and product read access can reserve 1–100 device serials per request. Device readers can inspect and reprint runs. Existing production presets already meet the access requirements; existing accounts may require explicit product-read grants.

Serial format is `PRODUCT-JALALIYYYYMMDD-NNNN`, using the server's current day in Asia/Tehran. The suffix starts at 0001 and expands beyond four digits. Product codes remain immutable. Each allocation scans the indexed serial range in reservations and existing device IDs, so legacy/manual device serials matching the format are skipped.

`serial_runs` stores the request ID, product, actor, day and product-label snapshot. `serial_reservations` permanently reserves each serial with a primary key and foreign keys. Allocation inserts the run, all serials and one audit entry in one D1 batch. It checks the unchanged active product, rejects an already existing device at insertion, and retries bounded uniqueness races. A reused request UUID returns the same run for the same actor/product/count; it cannot allocate again. A network retry with unchanged form inputs keeps that UUID until success; after reloading the page, inspect daily history before generating again.

Reservation does not create a device, record manufacture, or activate warranty. The pending serial list opens the existing device form prefilled with product and serial, where production supplies design revision and actual production date. The device API normalizes serial digits/case and checks the reserved product both before validation and inside the conditional insert to cover concurrent allocation. Catalog deactivation follows the existing no-new-devices rule.

Authenticated print output uses stored product-label snapshots and escaped HTML. It supports A4 (62×30 mm labels with 2 mm gaps, 8 mm page margins) and single 60×30 mm thermal labels. The browser print dialog can also save PDF. Print at 100% with browser headers/footers off and confirm actual printer media alignment with one test page. Printing performs no writes and does not claim that a physical printer finished. Labels show company logo, product/model, plain-text serial and allocation date, not a manufacturing or warranty date. No barcode is implied.

Run `node tests/serials.cjs` for atomic allocation, concurrent requests, idempotency, permissions, legacy collisions, reserved-product matching, calendar boundaries and print escaping. Migration 0003 is additive and schema-only.
