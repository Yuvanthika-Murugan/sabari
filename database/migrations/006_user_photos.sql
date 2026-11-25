-- FinCollect — profile photos for users (staff, managers, admins, MD).
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/006_user_photos.sql
-- (A fresh install from schema.sql already includes these changes.)

ALTER TABLE users
  ADD COLUMN photo_path VARCHAR(255) NULL AFTER monthly_salary;
