-- FinCollect — Expense module, and bank details on receipts (UPI ID, account holder name).
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/009_expenses_receipt_bank.sql
-- (A fresh install from schema.sql already includes these changes.)

ALTER TABLE collections
  ADD COLUMN upi_id         VARCHAR(60)  NOT NULL DEFAULT '' AFTER reference_no,
  ADD COLUMN account_holder VARCHAR(120) NOT NULL DEFAULT '' AFTER upi_id;

-- Office expenses. Cash expenses are also posted to the cash book; the dashboard's
-- Total Cash / Total Bank are reduced by cash / bank expenses respectively.
-- agent_id records who received the money when it is an agent handover.
CREATE TABLE IF NOT EXISTS expenses (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expense_no    VARCHAR(20) NOT NULL UNIQUE,
  expense_date  DATE NOT NULL,
  category      VARCHAR(60) NOT NULL,
  amount        DECIMAL(14,2) NOT NULL,
  payment_mode  ENUM('cash','bank') NOT NULL,
  agent_id      INT UNSIGNED NULL,
  remarks       VARCHAR(255) NOT NULL DEFAULT '',
  created_by    INT UNSIGNED NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_expense_date (expense_date),
  CONSTRAINT fk_expenses_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
