-- Annual stocktake applies to every API/MCP path, including historical writers.
-- Only the stocktake finance handler may adjust stock; frozen delivery needs
-- an exact, revision-guarded authorization from the count workflow.
CREATE TRIGGER annual_count_stock_lock BEFORE INSERT ON inventory_entries
WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)<>1 AND EXISTS (
 SELECT 1 FROM flow_entities c, json_each(c.data,'$.items') i
 WHERE c.type='inventory_count'
 AND json_extract(c.data,'$.kind')='annual'
 AND json_extract(c.data,'$.state') IN ('counting','review','awaiting_reopen')
 AND json_extract(i.value,'$.itemId')=NEW.item_id
 AND json_extract(i.value,'$.stage')=NEW.warehouse
 AND NOT EXISTS(SELECT 1 FROM inventory_operations o WHERE o.id=NEW.operation_id AND o.kind='inventory_count_adjust')
 AND NOT (
  NEW.delta<0 AND EXISTS (
   SELECT 1 FROM flow_entities a
   WHERE a.type='stocktake_authorization'
   AND json_extract(a.data,'$.operationId')=NEW.operation_id
   AND json_extract(a.data,'$.caseId')=c.id
   AND json_extract(a.data,'$.itemId')=NEW.item_id
   AND json_extract(a.data,'$.stage')=NEW.warehouse
   AND json_extract(a.data,'$.quantity')>=-NEW.delta+COALESCE((
    SELECT SUM(-e.delta) FROM inventory_entries e WHERE e.operation_id=NEW.operation_id
    AND e.item_id=NEW.item_id AND e.warehouse=NEW.warehouse AND e.delta<0
   ),0)
  )
 )
)
BEGIN SELECT RAISE(ABORT,'ANNUAL_STOCKTAKE_LOCK'); END;
--> statement-breakpoint
CREATE TRIGGER unresolved_count_shortage_lock BEFORE INSERT ON inventory_entries
WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)<>1 AND NEW.delta<0
AND NOT EXISTS(SELECT 1 FROM inventory_operations o WHERE o.id=NEW.operation_id AND o.kind='inventory_count_adjust')
AND COALESCE((SELECT quantity FROM inventory_balances b WHERE b.item_id=NEW.item_id AND b.warehouse=NEW.warehouse),0)
 < COALESCE((SELECT SUM(MAX(0,CAST(json_extract(i.value,'$.expected') AS INTEGER)-CAST(json_extract(i.value,'$.actual') AS INTEGER)))
 FROM flow_entities c,json_each(c.data,'$.items') i
 WHERE c.type='inventory_count' AND json_extract(c.data,'$.state')='review'
 AND json_extract(i.value,'$.itemId')=NEW.item_id AND json_extract(i.value,'$.stage')=NEW.warehouse
 AND json_type(i.value,'$.actual')='integer'),0)
BEGIN SELECT RAISE(ABORT,'UNRESOLVED_COUNT_SHORTAGE'); END;
--> statement-breakpoint
-- Preserve the uncertain quantity at its counted location, not merely across
-- the batch aggregate. Otherwise another bin could mask a missing physical bin.
CREATE TRIGGER unresolved_count_location_lock BEFORE UPDATE OF quantity,batch_id ON flow_slots
WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)<>1 AND NEW.quantity<OLD.quantity
AND EXISTS (
 SELECT 1 FROM flow_entities c,json_each(c.data,'$.items') i
 WHERE c.type='inventory_count' AND json_extract(c.data,'$.state')='review'
 AND json_extract(i.value,'$.location')=OLD.location
 AND json_extract(i.value,'$.itemId')=OLD.batch_id
 AND CAST(json_extract(i.value,'$.expected') AS INTEGER)>CAST(json_extract(i.value,'$.actual') AS INTEGER)
 AND NEW.quantity<CAST(json_extract(i.value,'$.expected') AS INTEGER)-CAST(json_extract(i.value,'$.actual') AS INTEGER)
)
BEGIN SELECT RAISE(ABORT,'UNRESOLVED_LOCATION_SHORTAGE'); END;
--> statement-breakpoint
CREATE TRIGGER unresolved_count_location_delete_lock BEFORE DELETE ON flow_slots
WHEN COALESCE((SELECT internal FROM reset_control WHERE id=1),0)<>1 AND EXISTS (
 SELECT 1 FROM flow_entities c,json_each(c.data,'$.items') i
 WHERE c.type='inventory_count' AND json_extract(c.data,'$.state')='review'
 AND json_extract(i.value,'$.location')=OLD.location
 AND json_extract(i.value,'$.itemId')=OLD.batch_id
 AND CAST(json_extract(i.value,'$.expected') AS INTEGER)>CAST(json_extract(i.value,'$.actual') AS INTEGER)
)
BEGIN SELECT RAISE(ABORT,'UNRESOLVED_LOCATION_SHORTAGE'); END;
