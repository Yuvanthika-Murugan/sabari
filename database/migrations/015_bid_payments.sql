-- FinCollect — bid (prize) payment workflow for auction winners:
-- Apply -> Verify -> Approval (MD) -> Document -> Document Verify (MD) -> Payment Entry.
-- A Direct Payment skips the steps and is recorded as type 'direct'.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/015_bid_payments.sql
-- (A fresh install from schema.sql already includes this change.)

CREATE TABLE IF NOT EXISTS bid_payments (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_no        VARCHAR(20)   NOT NULL UNIQUE,
  auction_id        INT UNSIGNED  NOT NULL,
  type              ENUM('request','direct') NOT NULL DEFAULT 'request',
  status            ENUM('applied','verified','approved','documented','doc_verified','paid','rejected') NOT NULL DEFAULT 'applied',
  apply_note        VARCHAR(255)  NOT NULL DEFAULT '',
  applied_by        INT UNSIGNED  NULL,
  applied_at        DATETIME      NOT NULL,
  verified_by       INT UNSIGNED  NULL,
  verified_at       DATETIME      NULL,
  approved_by       INT UNSIGNED  NULL,
  approved_at       DATETIME      NULL,
  documents         VARCHAR(255)  NOT NULL DEFAULT '',
  document_note     VARCHAR(255)  NOT NULL DEFAULT '',
  documented_by     INT UNSIGNED  NULL,
  documented_at     DATETIME      NULL,
  doc_verified_by   INT UNSIGNED  NULL,
  doc_verified_at   DATETIME      NULL,
  reject_note       VARCHAR(255)  NOT NULL DEFAULT '',
  rejected_stage    VARCHAR(20)   NOT NULL DEFAULT '',
  rejected_by       INT UNSIGNED  NULL,
  rejected_at       DATETIME      NULL,
  payout_mode       ENUM('cash','bank_transfer','cheque') NULL,
  bank_account_id   INT UNSIGNED  NULL,
  payout_reference  VARCHAR(60)   NOT NULL DEFAULT '',
  paid_date         DATE          NULL,
  paid_by           INT UNSIGNED  NULL,
  KEY idx_bid_payments_auction (auction_id),
  KEY idx_bid_payments_status (status),
  CONSTRAINT fk_bid_payments_auction FOREIGN KEY (auction_id)      REFERENCES auctions(id),
  CONSTRAINT fk_bid_payments_bank    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;
