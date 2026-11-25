-- FinCollect — nominee's mobile number on customers (Add / Edit Customer and Add Subscriber forms).
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p Sabari_Thendral < database/migrations/008_nominee_mobile.sql
-- (A fresh install from schema.sql already includes these changes.)

ALTER TABLE customers
  ADD COLUMN nominee_mobile VARCHAR(20) NOT NULL DEFAULT '' AFTER nominee_relation;
