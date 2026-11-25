-- FinCollect — extra subscriber details (subscriber entry form: PAN, DOB, nominee, intimation...).
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/004_subscriber_details.sql
-- (A fresh install from schema.sql already includes these changes.)

ALTER TABLE customers
  ADD COLUMN rep_name          VARCHAR(120) NOT NULL DEFAULT '' AFTER father_spouse_name,
  ADD COLUMN pan_no            VARCHAR(10)  NOT NULL DEFAULT '' AFTER rep_name,
  ADD COLUMN dob               DATE NULL AFTER pan_no,
  ADD COLUMN phone             VARCHAR(20)  NOT NULL DEFAULT '' AFTER alt_mobile,
  ADD COLUMN email             VARCHAR(160) NOT NULL DEFAULT '' AFTER phone,
  ADD COLUMN district          VARCHAR(80)  NOT NULL DEFAULT '' AFTER address,
  ADD COLUMN pincode           VARCHAR(10)  NOT NULL DEFAULT '' AFTER district,
  ADD COLUMN permanent_address TINYINT(1)   NOT NULL DEFAULT 0 AFTER pincode,
  ADD COLUMN agent_type        ENUM('single','multi') NOT NULL DEFAULT 'single' AFTER agent_id,
  ADD COLUMN nominee_name      VARCHAR(120) NOT NULL DEFAULT '' AFTER joining_date,
  ADD COLUMN nominee_relation  VARCHAR(60)  NOT NULL DEFAULT '' AFTER nominee_name,
  ADD COLUMN nominee_age       TINYINT UNSIGNED NULL AFTER nominee_relation,
  ADD COLUMN intimation_type   ENUM('post','hand','courier') NOT NULL DEFAULT 'post' AFTER nominee_age,
  ADD COLUMN intimation_card   TINYINT(1)   NOT NULL DEFAULT 1 AFTER intimation_type,
  ADD COLUMN collection_type   ENUM('monthly','weekly','daily') NOT NULL DEFAULT 'monthly' AFTER intimation_card;
