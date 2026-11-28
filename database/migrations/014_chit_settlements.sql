-- FinCollect — chit settlement (payout) when a customer's chit is finishing.
-- Flow: the collection staff / agent requests it (from the day before the last
-- instalment) -> the Super Admin (MD) approves or rejects -> Admin pays it out.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/014_chit_settlements.sql
-- (A fresh install from schema.sql already includes this change.)

CREATE TABLE IF NOT EXISTS chit_settlements (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  settlement_no    VARCHAR(20)   NOT NULL UNIQUE,
  customer_id      INT UNSIGNED  NOT NULL,
  group_id         INT UNSIGNED  NOT NULL,
  amount           DECIMAL(14,2) NOT NULL,
  status           ENUM('requested','approved','rejected','paid') NOT NULL DEFAULT 'requested',
  request_note     VARCHAR(255)  NOT NULL DEFAULT '',
  requested_by     INT UNSIGNED  NULL,
  requested_at     DATETIME      NOT NULL,
  decision_note    VARCHAR(255)  NOT NULL DEFAULT '',
  decided_by       INT UNSIGNED  NULL,
  decided_at       DATETIME      NULL,
  payout_mode      ENUM('cash','bank_transfer','cheque') NULL,
  bank_account_id  INT UNSIGNED  NULL,
  payout_reference VARCHAR(60)   NOT NULL DEFAULT '',
  paid_date        DATE          NULL,
  paid_by          INT UNSIGNED  NULL,
  KEY idx_chit_settlements_customer (customer_id, group_id),
  KEY idx_chit_settlements_status (status),
  CONSTRAINT fk_settlements_customer  FOREIGN KEY (customer_id)     REFERENCES customers(id),
  CONSTRAINT fk_settlements_group     FOREIGN KEY (group_id)        REFERENCES chit_groups(id),
  CONSTRAINT fk_settlements_requester FOREIGN KEY (requested_by)    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_settlements_decider   FOREIGN KEY (decided_by)      REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_settlements_payer     FOREIGN KEY (paid_by)         REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_settlements_bank      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;
