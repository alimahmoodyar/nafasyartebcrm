CREATE INDEX IF NOT EXISTS idx_sourcing_list ON flow_entities(type, created, id) WHERE type='foreign_selection' OR type='foreign_statement';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sourcing_route_list ON flow_entities(type, json_extract(data,'$.route'), created, id) WHERE type='supplier' OR type='purchase_shipment';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sourcing_supplier_items ON flow_entities(type, json_extract(data,'$.supplierId'), json_extract(data,'$.materialId')) WHERE json_extract(data,'$.supplierId') IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sourcing_material_suppliers ON flow_entities(json_extract(data,'$.materialId')) WHERE type='supplier_material';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sourcing_link_children ON flow_entities(type, json_extract(data,'$.linkId')) WHERE json_extract(data,'$.linkId') IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sourcing_link_orders ON flow_entities(type, json_extract(data,'$.supplierLinkId')) WHERE json_extract(data,'$.supplierLinkId') IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sourcing_order_receipts ON flow_entities(type, json_extract(data,'$.purchaseOrderId')) WHERE json_extract(data,'$.purchaseOrderId') IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_foreign_case_files ON flow_entities(type, coalesce(json_extract(data,'$.caseId'),json_extract(data,'$.shipmentId'))) WHERE coalesce(json_extract(data,'$.caseId'),json_extract(data,'$.shipmentId')) IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_foreign_statement_match ON flow_entities(json_extract(data,'$.account'),json_extract(data,'$.currency'),json_extract(data,'$.day')) WHERE type='foreign_statement_row';
