BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE payments ADD COLUMN provider_checkout_url text;
COMMIT;
