-- FinCollect — chit group codes (series master) and full chit group details
-- (PSO / agreement, auction schedule, company ticket, commission...).
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/005_group_codes.sql
-- (A fresh install from schema.sql already includes these changes.)

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

ALTER TABLE chit_groups
  MODIFY COLUMN frequency ENUM('daily','weekly','monthly','bimonthly') NOT NULL DEFAULT 'monthly',
  ADD COLUMN group_code_id      INT UNSIGNED NULL AFTER group_code,
  ADD COLUMN pso_number         VARCHAR(40)  NOT NULL DEFAULT '' AFTER branch_id,
  ADD COLUMN pso_date           DATE NULL AFTER pso_number,
  ADD COLUMN agreement_no       VARCHAR(40)  NOT NULL DEFAULT '' AFTER pso_date,
  ADD COLUMN agreement_date     DATE NULL AFTER agreement_no,
  ADD COLUMN admission_fee      DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER number_of_members,
  ADD COLUMN service_tax        DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER admission_fee,
  ADD COLUMN auction_time_from  TIME NULL AFTER end_date,
  ADD COLUMN auction_time_to    TIME NULL AFTER auction_time_from,
  ADD COLUMN auction_by         ENUM('day','week') NOT NULL DEFAULT 'day' AFTER auction_time_to,
  ADD COLUMN auction_by_value   TINYINT UNSIGNED NULL AFTER auction_by,
  ADD COLUMN company_type       VARCHAR(40)  NOT NULL DEFAULT '' AFTER frequency,
  ADD COLUMN company_ticket_no  VARCHAR(20)  NOT NULL DEFAULT '' AFTER company_type,
  ADD COLUMN company_auction_no VARCHAR(20)  NOT NULL DEFAULT '' AFTER company_ticket_no,
  ADD COLUMN company_comm_pct   DECIMAL(5,2) NOT NULL DEFAULT 5 AFTER company_auction_no,
  ADD COLUMN authorized         TINYINT(1)   NOT NULL DEFAULT 1 AFTER company_comm_pct,
  ADD COLUMN fdr_details        TINYINT(1)   NOT NULL DEFAULT 0 AFTER authorized,
  ADD CONSTRAINT fk_groups_code FOREIGN KEY (group_code_id) REFERENCES chit_group_codes(id) ON DELETE SET NULL;

ALTER TABLE customers
  MODIFY COLUMN collection_type ENUM('monthly','bimonthly','weekly','daily') NOT NULL DEFAULT 'monthly';
