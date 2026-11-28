-- FinCollect — scanned documents uploaded at the Document step of a bid payment.
-- Files are kept in backend/storage/bid-documents (not web-reachable) and served to
-- signed-in office users through the API.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/016_bid_payment_files.sql
-- (A fresh install from schema.sql already includes this change.)

CREATE TABLE IF NOT EXISTS bid_payment_files (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bid_payment_id  INT UNSIGNED  NOT NULL,
  document        VARCHAR(60)   NOT NULL,
  file_name       VARCHAR(160)  NOT NULL,
  stored_name     VARCHAR(60)   NOT NULL,
  mime            VARCHAR(40)   NOT NULL,
  size_bytes      INT UNSIGNED  NOT NULL,
  uploaded_by     INT UNSIGNED  NULL,
  uploaded_at     DATETIME      NOT NULL,
  KEY idx_bid_payment_files_payment (bid_payment_id),
  CONSTRAINT fk_bid_files_payment FOREIGN KEY (bid_payment_id) REFERENCES bid_payments(id) ON DELETE CASCADE
) ENGINE=InnoDB;
