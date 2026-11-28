-- FinCollect — each customer's map location (their house / shop), for the route map.
-- Set automatically from the first receipt made with the phone's GPS, or by the
-- collection staff / agent with "Save customer location" while standing there.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/013_customer_location.sql
-- (A fresh install from schema.sql already includes this change.)

ALTER TABLE customers
  ADD COLUMN latitude  DECIMAL(10,7) NULL AFTER area,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude;
