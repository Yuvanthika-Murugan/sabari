-- FinCollect — employee salaries and salary payments.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/003_salary_payments.sql
-- (A fresh install from schema.sql already includes these changes.)

ALTER TABLE users
  ADD COLUMN monthly_salary DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER monthly_target;

ALTER TABLE payment_approvals
  ADD COLUMN employee_id  INT UNSIGNED NULL AFTER customer_id,
  ADD COLUMN salary_month CHAR(7) NULL AFTER employee_id,
  ADD KEY idx_payment_salary (employee_id, salary_month),
  ADD CONSTRAINT fk_payments_employee FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL;
