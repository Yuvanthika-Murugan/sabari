-- FinCollect ERP — database schema
-- Compatible with MySQL 5.7+ / MariaDB 10.4+
--
-- Usage:
--   mysql -u root -p < database/schema.sql
--   mysql -u root -p fincollect < database/seed.sql   (optional demo data)

CREATE DATABASE IF NOT EXISTS fincollect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fincollect;
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS settings, auctions, cash_transactions, customer_transfers, day_end_closings, audit_logs,
  notifications, withdrawals, vouchers, bank_transactions, bank_accounts, payment_approvals,
  collections, due_schedules, customers, agents, areas, chit_groups, chit_group_codes, login_attempts, api_tokens, users, branches;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------

CREATE TABLE branches (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  address       VARCHAR(255) NOT NULL DEFAULT '',
  phone         VARCHAR(30)  NOT NULL DEFAULT '',
  manager_id    INT UNSIGNED NULL,
  opening_date  DATE NULL,
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  emp_id         VARCHAR(20)  NOT NULL UNIQUE,
  name           VARCHAR(120) NOT NULL,
  phone          VARCHAR(20)  NOT NULL DEFAULT '',
  email          VARCHAR(160) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('md','admin','manager','staff') NOT NULL,
  branch_id      INT UNSIGNED NULL,
  address        VARCHAR(255) NOT NULL DEFAULT '',
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  joining_date   DATE NULL,
  monthly_target DECIMAL(14,2) NOT NULL DEFAULT 0,
  monthly_salary DECIMAL(14,2) NOT NULL DEFAULT 0,
  photo_path     VARCHAR(255) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE branches
  ADD CONSTRAINT fk_branches_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- Failed sign-ins, used to block password guessing (see Services/LoginThrottle.php).
CREATE TABLE login_attempts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip            VARCHAR(45)  NOT NULL,
  email         VARCHAR(160) NOT NULL,
  attempted_at  DATETIME     NOT NULL,
  KEY idx_attempt_ip (ip, attempted_at),
  KEY idx_attempt_email (email, attempted_at)
) ENGINE=InnoDB;

CREATE TABLE api_tokens (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  expires_at  DATETIME NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Masters: areas and agents
-- ---------------------------------------------------------------------------

CREATE TABLE areas (
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

-- Agents introduce customers and earn commission_pct of what those customers pay.
CREATE TABLE agents (
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

-- ---------------------------------------------------------------------------
-- Groups, customers and dues
-- ---------------------------------------------------------------------------

-- Group series master ("Chit Group Code"): the value, members and fees a group is created from.
CREATE TABLE chit_group_codes (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  series            VARCHAR(30)  NOT NULL UNIQUE,
  group_value       DECIMAL(14,2) NOT NULL,
  members           INT UNSIGNED NOT NULL,
  admission_fee     DECIMAL(12,2) NOT NULL DEFAULT 0,
  auction_day       TINYINT UNSIGNED NULL,
  company_comm_pct  DECIMAL(5,2) NOT NULL DEFAULT 5,
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- start_date is the first auction date; end_date the closing date (last installment).
CREATE TABLE chit_groups (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_code         VARCHAR(20)  NOT NULL UNIQUE,
  group_code_id      INT UNSIGNED NULL,
  group_name         VARCHAR(120) NOT NULL,
  branch_id          INT UNSIGNED NOT NULL,
  pso_number         VARCHAR(40)  NOT NULL DEFAULT '',
  pso_date           DATE NULL,
  agreement_no       VARCHAR(40)  NOT NULL DEFAULT '',
  agreement_date     DATE NULL,
  duration           INT UNSIGNED NOT NULL,
  group_value        DECIMAL(14,2) NOT NULL,
  number_of_members  INT UNSIGNED NOT NULL,
  admission_fee      DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_tax        DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  auction_time_from  TIME NULL,
  auction_time_to    TIME NULL,
  auction_by         ENUM('day','week') NOT NULL DEFAULT 'day',
  auction_by_value   TINYINT UNSIGNED NULL,
  frequency          ENUM('daily','weekly','monthly','bimonthly') NOT NULL DEFAULT 'monthly',
  company_type       VARCHAR(40)  NOT NULL DEFAULT '',
  company_ticket_no  VARCHAR(20)  NOT NULL DEFAULT '',
  company_auction_no VARCHAR(20)  NOT NULL DEFAULT '',
  company_comm_pct   DECIMAL(5,2) NOT NULL DEFAULT 5,
  authorized         TINYINT(1)   NOT NULL DEFAULT 1,
  fdr_details        TINYINT(1)   NOT NULL DEFAULT 0,
  status             ENUM('active','inactive','completed') NOT NULL DEFAULT 'active',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_groups_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_groups_code   FOREIGN KEY (group_code_id) REFERENCES chit_group_codes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE customers (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_code       VARCHAR(20)  NOT NULL UNIQUE,
  name                VARCHAR(120) NOT NULL,
  father_spouse_name  VARCHAR(120) NOT NULL DEFAULT '',
  rep_name            VARCHAR(120) NOT NULL DEFAULT '',
  pan_no              VARCHAR(10)  NOT NULL DEFAULT '',
  dob                 DATE NULL,
  mobile              VARCHAR(20)  NOT NULL,
  alt_mobile          VARCHAR(20)  NOT NULL DEFAULT '',
  phone               VARCHAR(20)  NOT NULL DEFAULT '',
  email               VARCHAR(160) NOT NULL DEFAULT '',
  address             VARCHAR(255) NOT NULL DEFAULT '',
  district            VARCHAR(80)  NOT NULL DEFAULT '',
  pincode             VARCHAR(10)  NOT NULL DEFAULT '',
  permanent_address   TINYINT(1)   NOT NULL DEFAULT 0,
  area                VARCHAR(120) NOT NULL DEFAULT '',
  branch_id           INT UNSIGNED NOT NULL,
  staff_id            INT UNSIGNED NULL,
  agent_id            INT UNSIGNED NULL,
  agent_type          ENUM('single','multi') NOT NULL DEFAULT 'single',
  group_id            INT UNSIGNED NULL,
  joining_date        DATE NOT NULL,
  nominee_name        VARCHAR(120) NOT NULL DEFAULT '',
  nominee_relation    VARCHAR(60)  NOT NULL DEFAULT '',
  nominee_mobile      VARCHAR(20)  NOT NULL DEFAULT '',
  nominee_age         TINYINT UNSIGNED NULL,
  intimation_type     ENUM('post','hand','courier') NOT NULL DEFAULT 'post',
  intimation_card     TINYINT(1)   NOT NULL DEFAULT 1,
  collection_type     ENUM('monthly','bimonthly','weekly','daily') NOT NULL DEFAULT 'monthly',
  status              ENUM('active','inactive','closed') NOT NULL DEFAULT 'active',
  photo_path          VARCHAR(255) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_customers_staff  FOREIGN KEY (staff_id)  REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_agent  FOREIGN KEY (agent_id)  REFERENCES agents(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_group  FOREIGN KEY (group_id)  REFERENCES chit_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Status (paid / partially_paid / overdue / due_today / upcoming) is derived from
-- the amounts and due_date at query time, so it never goes stale.
CREATE TABLE due_schedules (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT UNSIGNED NOT NULL,
  group_id      INT UNSIGNED NULL,
  due_number    INT UNSIGNED NOT NULL,
  due_date      DATE NOT NULL,
  due_amount    DECIMAL(14,2) NOT NULL,
  paid_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_date  DATE NULL,
  UNIQUE KEY uq_due (customer_id, due_number),
  KEY idx_due_date (due_date),
  CONSTRAINT fk_dues_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_dues_group    FOREIGN KEY (group_id)    REFERENCES chit_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE customer_transfers (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT UNSIGNED NOT NULL,
  from_group_id   INT UNSIGNED NULL,
  to_group_id     INT UNSIGNED NULL,
  from_staff_id   INT UNSIGNED NULL,
  to_staff_id     INT UNSIGNED NULL,
  from_branch_id  INT UNSIGNED NULL,
  to_branch_id    INT UNSIGNED NULL,
  transfer_date   DATE NOT NULL,
  reason          VARCHAR(255) NOT NULL DEFAULT '',
  created_by      INT UNSIGNED NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transfers_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Collections and payments
-- ---------------------------------------------------------------------------

CREATE TABLE collections (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_no        VARCHAR(20) NOT NULL UNIQUE,
  receipt_type      ENUM('chit','arrear') NOT NULL DEFAULT 'chit',
  customer_id       INT UNSIGNED NOT NULL,
  group_id          INT UNSIGNED NULL,
  branch_id         INT UNSIGNED NOT NULL,
  staff_id          INT UNSIGNED NULL,
  due_number        INT UNSIGNED NOT NULL,
  due_amount        DECIMAL(14,2) NOT NULL,
  collected_amount  DECIMAL(14,2) NOT NULL,
  pending_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_mode      ENUM('cash','upi','bank_transfer','cheque') NOT NULL,
  reference_no      VARCHAR(60) NOT NULL DEFAULT '',
  collection_date   DATE NOT NULL,
  collection_time   TIME NOT NULL,
  remarks           VARCHAR(255) NOT NULL DEFAULT '',
  status            ENUM('completed','pending','rejected') NOT NULL DEFAULT 'completed',
  cancel_reason     VARCHAR(255) NOT NULL DEFAULT '',
  cancelled_by      INT UNSIGNED NULL,
  cancelled_at      DATETIME NULL,
  created_by        INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_collection_date (collection_date),
  CONSTRAINT fk_collections_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_collections_group    FOREIGN KEY (group_id)    REFERENCES chit_groups(id) ON DELETE SET NULL,
  CONSTRAINT fk_collections_branch   FOREIGN KEY (branch_id)   REFERENCES branches(id),
  CONSTRAINT fk_collections_staff    FOREIGN KEY (staff_id)    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_collections_canceller FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE bank_accounts (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bank_name        VARCHAR(120) NOT NULL,
  account_name     VARCHAR(160) NOT NULL,
  account_number   VARCHAR(40)  NOT NULL UNIQUE,
  branch           VARCHAR(120) NOT NULL DEFAULT '',
  ifsc             VARCHAR(20)  NOT NULL DEFAULT '',
  opening_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,
  current_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Three-step workflow: payment_informed -> manager_accepted -> completed (MD approval)
CREATE TABLE payment_approvals (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_code       VARCHAR(20) NOT NULL UNIQUE,
  payment_type       ENUM('customer','expense','salary') NOT NULL DEFAULT 'customer',
  customer_id        INT UNSIGNED NULL,
  employee_id        INT UNSIGNED NULL,
  salary_month       CHAR(7) NULL,
  amount             DECIMAL(14,2) NOT NULL,
  payment_mode       ENUM('cash','upi','bank_transfer','cheque') NOT NULL,
  bank_account_id    INT UNSIGNED NULL,
  reference_no       VARCHAR(60) NOT NULL DEFAULT '',
  remarks            VARCHAR(255) NOT NULL DEFAULT '',
  submitted_by       INT UNSIGNED NOT NULL,
  branch_id          INT UNSIGNED NULL,
  submitted_at       DATETIME NOT NULL,
  current_stage      ENUM('payment_informed','manager_accepted','md_approved','completed','rejected','sent_back') NOT NULL DEFAULT 'payment_informed',
  manager_id         INT UNSIGNED NULL,
  manager_action_at  DATETIME NULL,
  md_id              INT UNSIGNED NULL,
  md_action_at       DATETIME NULL,
  KEY idx_payment_salary (employee_id, salary_month),
  CONSTRAINT fk_payments_customer  FOREIGN KEY (customer_id)     REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_employee  FOREIGN KEY (employee_id)     REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_bank      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_submitter FOREIGN KEY (submitted_by)    REFERENCES users(id),
  CONSTRAINT fk_payments_branch    FOREIGN KEY (branch_id)       REFERENCES branches(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_manager   FOREIGN KEY (manager_id)      REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_md        FOREIGN KEY (md_id)           REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Auctions
-- ---------------------------------------------------------------------------

-- One auction per installment. The winner forgoes bid_amount; the foreman keeps
-- commission_amount of it and the rest (dividend_amount) is split across the
-- group's members as a reduction of their dues. The winner is paid prize_amount.
CREATE TABLE auctions (
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

-- ---------------------------------------------------------------------------
-- Cash & bank
-- ---------------------------------------------------------------------------

CREATE TABLE bank_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id       INT UNSIGNED NOT NULL,
  txn_date         DATE NOT NULL,
  transaction_ref  VARCHAR(40) NOT NULL UNIQUE,
  description      VARCHAR(255) NOT NULL DEFAULT '',
  credit           DECIMAL(14,2) NOT NULL DEFAULT 0,
  debit            DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance          DECIMAL(14,2) NOT NULL,
  type             ENUM('deposit','withdrawal','transfer','collection') NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_banktx_account FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cash_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  txn_date         DATE NOT NULL,
  voucher_receipt  VARCHAR(40) NOT NULL DEFAULT '',
  description      VARCHAR(255) NOT NULL DEFAULT '',
  debit            DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit           DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance          DECIMAL(14,2) NOT NULL,
  type             ENUM('opening','collection','receipt','payment','expense','withdrawal') NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cash_date (txn_date)
) ENGINE=InnoDB;

CREATE TABLE vouchers (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  voucher_number   VARCHAR(20) NOT NULL UNIQUE,
  voucher_date     DATE NOT NULL,
  voucher_type     ENUM('payment','receipt','expense','contra') NOT NULL,
  account          VARCHAR(120) NOT NULL,
  amount           DECIMAL(14,2) NOT NULL,
  payment_mode     VARCHAR(20) NOT NULL,
  narration        VARCHAR(255) NOT NULL DEFAULT '',
  created_by       INT UNSIGNED NULL,
  approval_status  ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vouchers_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE withdrawals (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  withdrawal_code  VARCHAR(20) NOT NULL UNIQUE,
  withdrawal_date  DATE NOT NULL,
  bank_account_id  INT UNSIGNED NULL,
  amount           DECIMAL(14,2) NOT NULL,
  mode             ENUM('bank_transfer','cheque','cash') NOT NULL,
  reference        VARCHAR(60) NOT NULL DEFAULT '',
  reason           VARCHAR(255) NOT NULL DEFAULT '',
  requested_by     INT UNSIGNED NULL,
  approved_by      INT UNSIGNED NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_withdrawals_account   FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_withdrawals_requester FOREIGN KEY (requested_by)    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_withdrawals_approver  FOREIGN KEY (approved_by)     REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE day_end_closings (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  closing_date           DATE NOT NULL UNIQUE,
  opening_cash           DECIMAL(14,2) NOT NULL DEFAULT 0,
  cash_collection        DECIMAL(14,2) NOT NULL DEFAULT 0,
  other_cash_receipt     DECIMAL(14,2) NOT NULL DEFAULT 0,
  expenses               DECIMAL(14,2) NOT NULL DEFAULT 0,
  withdrawals            DECIMAL(14,2) NOT NULL DEFAULT 0,
  expected_closing_cash  DECIMAL(14,2) NOT NULL DEFAULT 0,
  physical_cash          DECIMAL(14,2) NOT NULL DEFAULT 0,
  difference             DECIMAL(14,2) NOT NULL DEFAULT 0,
  bank_credits           DECIMAL(14,2) NOT NULL DEFAULT 0,
  bank_debits            DECIMAL(14,2) NOT NULL DEFAULT 0,
  upi_collection         DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_collection       DECIMAL(14,2) NOT NULL DEFAULT 0,
  pending_approvals      INT UNSIGNED NOT NULL DEFAULT 0,
  rejected_transactions  INT UNSIGNED NOT NULL DEFAULT 0,
  status                 ENUM('open','closed') NOT NULL DEFAULT 'open',
  closed_by              INT UNSIGNED NULL,
  closed_at              DATETIME NULL,
  remarks                VARCHAR(255) NOT NULL DEFAULT '',
  CONSTRAINT fk_dayend_user FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- System
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type        ENUM('due_today','overdue','payment_submitted','manager_approval','md_approval','payment_approved','payment_rejected','transfer','day_end') NOT NULL,
  title       VARCHAR(120) NOT NULL,
  message     VARCHAR(255) NOT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Append-only: the API never updates or deletes audit rows.
CREATE TABLE audit_logs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,
  user_name   VARCHAR(120) NOT NULL,
  role        VARCHAR(20)  NOT NULL,
  action      VARCHAR(120) NOT NULL,
  module      VARCHAR(60)  NOT NULL,
  record_id   VARCHAR(60)  NOT NULL DEFAULT '',
  old_value   VARCHAR(255) NOT NULL DEFAULT '-',
  new_value   VARCHAR(255) NOT NULL DEFAULT '-',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE settings (
  setting_key    VARCHAR(60) PRIMARY KEY,
  setting_value  TEXT NOT NULL
) ENGINE=InnoDB;
