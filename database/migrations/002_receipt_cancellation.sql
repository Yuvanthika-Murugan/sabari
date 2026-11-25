-- FinCollect — records who cancelled a receipt, when and why.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/002_receipt_cancellation.sql
-- (A fresh install from schema.sql already includes these changes.)

ALTER TABLE collections
  ADD COLUMN cancel_reason VARCHAR(255) NOT NULL DEFAULT '' AFTER status,
  ADD COLUMN cancelled_by  INT UNSIGNED NULL AFTER cancel_reason,
  ADD COLUMN cancelled_at  DATETIME NULL AFTER cancelled_by,
  ADD CONSTRAINT fk_collections_canceller FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;
