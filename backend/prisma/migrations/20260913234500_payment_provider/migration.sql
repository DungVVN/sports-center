CREATE TYPE payment_provider AS ENUM ('vnpay', 'momo', 'zalopay', 'bank');
ALTER TABLE payments ADD COLUMN provider payment_provider;
