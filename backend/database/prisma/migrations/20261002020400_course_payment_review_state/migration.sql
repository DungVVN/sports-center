BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE payments ADD COLUMN fulfillment_error text;
COMMIT;
