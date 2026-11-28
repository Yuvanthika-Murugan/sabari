-- FinCollect — cash handed over to the office by collection staff and agents.
-- A handover only moves money that was already received (the receipts are in the books),
-- so it does not touch the cash book; it shows how much each person still holds.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/012_cash_handovers.sql
-- (A fresh install from schema.sql already includes this change.)

CREATE TABLE IF NOT EXISTS cash_handovers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  handover_no   VARCHAR(20)  NOT NULL UNIQUE,
  handover_date DATE         NOT NULL,
  user_id       INT UNSIGNED NOT NULL,
  amount        DECIMAL(14,2) NOT NULL,
  remarks       VARCHAR(255) NOT NULL DEFAULT '',
  created_by    INT UNSIGNED NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cash_handovers_user_date (user_id, handover_date),
  CONSTRAINT fk_cash_handovers_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  CONSTRAINT fk_cash_handovers_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
