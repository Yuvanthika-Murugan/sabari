-- FinCollect — agents can sign in. An agent added with an email and password gets a
-- login account (role "staff", the collection app) linked here.
-- Run once on a database created from an older schema.sql:
--   mysql -u root -p fincollect < database/migrations/011_agent_login.sql
-- (A fresh install from schema.sql already includes this change.)

ALTER TABLE agents
  ADD COLUMN user_id INT UNSIGNED NULL UNIQUE AFTER status,
  ADD CONSTRAINT fk_agents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
