-- FinCollect — adds agents, areas, arrear receipts, auctions and commission settings.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/001_masters_receipts_auctions.sql
-- (A fresh install from schema.sql already includes these changes.)

CREATE TABLE IF NOT EXISTS areas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  branch_id   INT UNSIGNED NOT NULL,
  staff_id    INT UNSIGNED NULL,
  pincode     VARCHAR(10)  NOT NULL DEFAULT '',
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_area_branch_name (branch_id, name),
  CONSTRAINT fk_areas_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_areas_staff  FOREIGN KEY (staff_id)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS agents (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  agent_code      VARCHAR(20)  NOT NULL UNIQUE,
  name            VARCHAR(120) NOT NULL,
  mobile          VARCHAR(20)  NOT NULL,
  address         VARCHAR(255) NOT NULL DEFAULT '',
  branch_id       INT UNSIGNED NOT NULL,
  commission_pct  DECIMAL(5,2) NOT NULL DEFAULT 0,
  joining_date    DATE NULL,
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_agents_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB;

ALTER TABLE customers
  ADD COLUMN agent_id INT UNSIGNED NULL AFTER staff_id,
  ADD CONSTRAINT fk_customers_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE collections
  ADD COLUMN receipt_type ENUM('chit','arrear') NOT NULL DEFAULT 'chit' AFTER receipt_no;

CREATE TABLE IF NOT EXISTS auctions (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  auction_code         VARCHAR(20) NOT NULL UNIQUE,
  group_id             INT UNSIGNED NOT NULL,
  auction_no           INT UNSIGNED NOT NULL,
  auction_date         DATE NOT NULL,
  customer_id          INT UNSIGNED NOT NULL,
  bid_amount           DECIMAL(14,2) NOT NULL,
  commission_amount    DECIMAL(14,2) NOT NULL,
  dividend_amount      DECIMAL(14,2) NOT NULL,
  dividend_per_member  DECIMAL(14,2) NOT NULL,
  prize_amount         DECIMAL(14,2) NOT NULL,
  payout_status        ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  payout_mode          ENUM('cash','bank_transfer','cheque') NULL,
  bank_account_id      INT UNSIGNED NULL,
  payout_reference     VARCHAR(60) NOT NULL DEFAULT '',
  paid_date            DATE NULL,
  remarks              VARCHAR(255) NOT NULL DEFAULT '',
  created_by           INT UNSIGNED NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auction_no (group_id, auction_no),
  UNIQUE KEY uq_auction_winner (group_id, customer_id),
  CONSTRAINT fk_auctions_group    FOREIGN KEY (group_id)        REFERENCES chit_groups(id),
  CONSTRAINT fk_auctions_customer FOREIGN KEY (customer_id)     REFERENCES customers(id),
  CONSTRAINT fk_auctions_bank     FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_auctions_user     FOREIGN KEY (created_by)      REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Turn the free-text areas customers already have into Area master records.
INSERT IGNORE INTO areas (code, name, branch_id)
SELECT CONCAT('AREA', LPAD(ROW_NUMBER() OVER (ORDER BY branch_id, area), 3, '0')), area, branch_id
FROM (SELECT DISTINCT branch_id, area FROM customers WHERE area <> '') a;

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('foreman_commission_pct', '5'),
  ('max_bid_pct', '40'),
  ('agent_commission_pct', '2');
