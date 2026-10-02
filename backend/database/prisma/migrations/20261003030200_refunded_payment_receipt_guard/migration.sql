BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE payments DROP CONSTRAINT payments_check;
ALTER TABLE payments ADD CONSTRAINT payments_receipt_timestamp CHECK ((status IN ('paid','refunded')) = (paid_at IS NOT NULL));
COMMIT;
