-- FinCollect — collection staff features: staff on expenses (debits), cash denominations and
-- GPS position on receipts, and each staff member's latest live location.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/010_staff_debit_denomination_location.sql
-- (A fresh install from schema.sql already includes these changes.)

-- Which collection staff member the expense / debit belongs to (Today Collection's Cash/Bank Debit).
ALTER TABLE expenses
  ADD COLUMN staff_id INT UNSIGNED NULL AFTER agent_id,
  ADD CONSTRAINT fk_expenses_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL;

-- Notes counted for a cash receipt, e.g. "500x2,100x3", and where the receipt was made.
ALTER TABLE collections
  ADD COLUMN denominations VARCHAR(255) NOT NULL DEFAULT '' AFTER account_holder,
  ADD COLUMN latitude  DECIMAL(10,7) NULL AFTER denominations,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude;

-- Latest position reported by each collection staff member's phone (one row per user).
CREATE TABLE IF NOT EXISTS staff_locations (
  user_id     INT UNSIGNED PRIMARY KEY,
  latitude    DECIMAL(10,7) NOT NULL,
  longitude   DECIMAL(10,7) NOT NULL,
  accuracy    INT UNSIGNED NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_locations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
