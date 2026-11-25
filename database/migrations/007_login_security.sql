-- FinCollect — sign-in attempt log used to block password guessing (brute force).
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/007_login_security.sql
-- (A fresh install from schema.sql already includes these changes.)

CREATE TABLE login_attempts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip            VARCHAR(45)  NOT NULL,
  email         VARCHAR(160) NOT NULL,
  attempted_at  DATETIME     NOT NULL,
  KEY idx_attempt_ip (ip, attempted_at),
  KEY idx_attempt_email (email, attempted_at)
) ENGINE=InnoDB;
