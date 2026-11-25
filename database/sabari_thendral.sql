-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: fincollect
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `agents`
--

DROP TABLE IF EXISTS `agents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agents` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `agent_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mobile` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `branch_id` int unsigned NOT NULL,
  `commission_pct` decimal(5,2) NOT NULL DEFAULT '0.00',
  `joining_date` date DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_code` (`agent_code`),
  KEY `fk_agents_branch` (`branch_id`),
  CONSTRAINT `fk_agents_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agents`
--

LOCK TABLES `agents` WRITE;
/*!40000 ALTER TABLE `agents` DISABLE KEYS */;
INSERT INTO `agents` VALUES (2,'AGT001','Ganesh','9865320147','Tuticorin',5,1.00,'2026-11-03','active','2026-11-03 14:51:58','2026-11-03 14:51:58');
/*!40000 ALTER TABLE `agents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_tokens`
--

DROP TABLE IF EXISTS `api_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_tokens` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `fk_tokens_user` (`user_id`),
  CONSTRAINT `fk_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_tokens`
--

LOCK TABLES `api_tokens` WRITE;
/*!40000 ALTER TABLE `api_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `areas`
--

DROP TABLE IF EXISTS `areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `areas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` int unsigned NOT NULL,
  `staff_id` int unsigned DEFAULT NULL,
  `pincode` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_area_branch_name` (`branch_id`,`name`),
  KEY `fk_areas_staff` (`staff_id`),
  CONSTRAINT `fk_areas_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_areas_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `areas`
--

LOCK TABLES `areas` WRITE;
/*!40000 ALTER TABLE `areas` DISABLE KEYS */;
INSERT INTO `areas` VALUES (33,'AREA021','Anna Nagar Tuty',5,NULL,'628008','active','2026-11-03 14:49:03','2026-11-03 14:49:03');
/*!40000 ALTER TABLE `areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auctions`
--

DROP TABLE IF EXISTS `auctions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auctions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `auction_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_id` int unsigned NOT NULL,
  `auction_no` int unsigned NOT NULL,
  `auction_date` date NOT NULL,
  `customer_id` int unsigned NOT NULL,
  `bid_amount` decimal(14,2) NOT NULL,
  `commission_amount` decimal(14,2) NOT NULL,
  `dividend_amount` decimal(14,2) NOT NULL,
  `dividend_per_member` decimal(14,2) NOT NULL,
  `prize_amount` decimal(14,2) NOT NULL,
  `payout_status` enum('pending','paid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payout_mode` enum('cash','bank_transfer','cheque') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_account_id` int unsigned DEFAULT NULL,
  `payout_reference` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `paid_date` date DEFAULT NULL,
  `remarks` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auction_code` (`auction_code`),
  UNIQUE KEY `uq_auction_no` (`group_id`,`auction_no`),
  UNIQUE KEY `uq_auction_winner` (`group_id`,`customer_id`),
  KEY `fk_auctions_customer` (`customer_id`),
  KEY `fk_auctions_bank` (`bank_account_id`),
  KEY `fk_auctions_user` (`created_by`),
  CONSTRAINT `fk_auctions_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_auctions_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_auctions_group` FOREIGN KEY (`group_id`) REFERENCES `chit_groups` (`id`),
  CONSTRAINT `fk_auctions_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auctions`
--

LOCK TABLES `auctions` WRITE;
/*!40000 ALTER TABLE `auctions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auctions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned DEFAULT NULL,
  `user_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `old_value` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
  `new_value` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=126 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (32,1,'Rajesh Kumar','MD','Branch Created','Branches','BR005','-','Tuticorin','2026-11-03 20:17:38'),(33,1,'Rajesh Kumar','MD','Branch Updated','Branches','BR005','Tuticorin','Tuticorin','2026-11-03 20:18:10'),(34,1,'Rajesh Kumar','MD','Commission Updated','Settings','commission','Foreman 5%, Max bid 40%, Agent 2%','Foreman 5%, Max bid 40%, Agent 2%','2026-11-03 20:18:22'),(35,1,'Rajesh Kumar','MD','Area Created','Areas','AREA021','-','Anna Nagar Tuty','2026-11-03 20:19:03'),(36,1,'Rajesh Kumar','MD','Agent Created','Agents','AGT001','-','Ganesh','2026-11-03 20:21:58'),(53,1,'Rajesh Kumar','MD','Settings Updated','Settings','company','-','-','2026-11-04 10:14:12'),(54,1,'Rajesh Kumar','MD','Settings Updated','Settings','company','-','-','2026-11-04 10:14:19'),(58,1,'Rajesh Kumar','MD','Area Updated','Areas','AREA021','Anna Nagar Tuty','Anna Nagar Tuty','2026-11-04 10:42:40'),(59,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-04 10:43:15'),(60,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-04 10:44:18'),(73,1,'Rajesh Kumar','MD','Profile Photo Updated','Users','EMP001','-','-','2026-11-04 17:12:58'),(74,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-04 17:19:51'),(75,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-04 17:19:54'),(87,1,'Rajesh Kumar','MD','Settings Updated','Settings','company_name','Finance Collection Pvt Ltd','SABARI THENDRAL CHITS PVT LTD','2026-11-04 17:26:13'),(88,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-05 12:31:11'),(89,1,'Rajesh Kumar','MD','Group Code Created','Group Codes','Chit01','-','10 members','2026-11-05 12:42:01'),(90,1,'Rajesh Kumar','MD','Group Created','Groups','GRP001','-','Gold Scheme','2026-11-05 12:44:39'),(91,1,'Rajesh Kumar','MD','User Created','Users','EMP002','-','Vinayaga (staff)','2026-11-05 13:38:15'),(92,1,'Rajesh Kumar','MD','User Updated','Users','EMP002','active','inactive','2026-11-05 13:40:30'),(93,1,'Rajesh Kumar','MD','User Updated','Users','EMP002','inactive','active','2026-11-05 13:40:33'),(94,1,'Rajesh Kumar','MD','Profile Photo Updated','Users','EMP002','-','-','2026-11-05 13:41:06'),(95,1,'Rajesh Kumar','MD','User Updated','Users','EMP002','active','active','2026-11-05 13:41:06'),(96,1,'Rajesh Kumar','MD','Customer Created','Customers','CUST00001','-','Murugan','2026-11-05 13:49:59'),(97,1,'Rajesh Kumar','MD','Customer Photo Updated','Customers','CUST00001','-','-','2026-11-05 13:52:57'),(98,1,'Rajesh Kumar','MD','Customer Updated','Customers','CUST00001','active','active','2026-11-05 13:52:57'),(99,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-05 13:59:18'),(100,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-05 14:02:50'),(101,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-05 15:18:32'),(102,2,'Vinayaga','Staff','Login','Login','vinayaga@gmail.com','-','127.0.0.1','2026-11-05 15:18:49'),(103,2,'Vinayaga','Staff','Collection Entered','Collections','RCP000001','-','₹1,000','2026-11-05 15:20:06'),(104,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-05 15:26:45'),(105,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-05 15:27:04'),(106,2,'Vinayaga','Staff','Logout','Login','Vinayaga','-','-','2026-11-05 15:29:38'),(107,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-05 15:29:45'),(108,1,'Rajesh Kumar','MD','Group Code Created','Group Codes','Chit02','-','1000 members','2026-11-05 15:31:15'),(109,1,'Rajesh Kumar','MD','Group Created','Groups','GRP002','-','Silver Scheme','2026-11-05 15:32:38'),(110,1,'Rajesh Kumar','MD','Customer Transferred','Customer Transfer','CUST00001','GRP001','GRP002','2026-11-05 15:33:06'),(111,1,'Rajesh Kumar','MD','Customer Transferred','Customer Transfer','CUST00001','GRP002','GRP001','2026-11-05 15:34:14'),(112,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-05 15:39:11'),(113,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-05 15:39:25'),(114,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-05 15:41:36'),(115,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-05 15:41:46'),(116,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-05 15:43:01'),(117,1,'Rajesh Kumar','MD','Bank Account Added','Bank Accounts','5020006030078952','-','State Bank Of India','2026-11-05 15:50:17'),(118,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-05 15:52:06'),(119,1,'Rajesh Kumar','MD','User Updated','Users','EMP002','active','inactive','2026-11-05 15:52:15'),(120,1,'Rajesh Kumar','MD','User Updated','Users','EMP002','inactive','active','2026-11-05 15:52:19'),(121,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-05 17:00:50'),(122,1,'Rajesh Kumar','MD','Login','Login','rajesh@fincol.in','-','127.0.0.1','2026-11-05 17:10:24'),(123,1,'Rajesh Kumar','MD','Logout','Login','Rajesh Kumar','-','-','2026-11-05 17:10:35'),(124,2,'Vinayaga','Staff','Login','Login','vinayaga@gmail.com','-','127.0.0.1','2026-11-05 17:18:44'),(125,2,'Vinayaga','Staff','Logout','Login','Vinayaga','-','-','2026-11-05 17:18:57');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bank_accounts`
--

DROP TABLE IF EXISTS `bank_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `bank_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `ifsc` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `opening_balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `current_balance` decimal(14,2) NOT NULL DEFAULT '0.00',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_number` (`account_number`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bank_accounts`
--

LOCK TABLES `bank_accounts` WRITE;
/*!40000 ALTER TABLE `bank_accounts` DISABLE KEYS */;
INSERT INTO `bank_accounts` VALUES (1,'State Bank Of India','ST','5020006030078952','Anna Nagar','SBIN0005646',50000000.00,50000000.00,'active','2026-11-05 10:20:17');
/*!40000 ALTER TABLE `bank_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bank_transactions`
--

DROP TABLE IF EXISTS `bank_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_transactions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `account_id` int unsigned NOT NULL,
  `txn_date` date NOT NULL,
  `transaction_ref` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `credit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `debit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `balance` decimal(14,2) NOT NULL,
  `type` enum('deposit','withdrawal','transfer','collection') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_ref` (`transaction_ref`),
  KEY `fk_banktx_account` (`account_id`),
  CONSTRAINT `fk_banktx_account` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bank_transactions`
--

LOCK TABLES `bank_transactions` WRITE;
/*!40000 ALTER TABLE `bank_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `bank_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `manager_id` int unsigned DEFAULT NULL,
  `opening_date` date DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `fk_branches_manager` (`manager_id`),
  CONSTRAINT `fk_branches_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES (5,'BR005','Tuticorin','VVD Main Road, Tuticorin','9876543210',NULL,'2026-01-01','active','2026-11-03 14:47:38','2026-11-04 05:06:48');
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_transactions`
--

DROP TABLE IF EXISTS `cash_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_transactions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `txn_date` date NOT NULL,
  `voucher_receipt` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `debit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `credit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `balance` decimal(14,2) NOT NULL,
  `type` enum('opening','collection','receipt','payment','expense','withdrawal') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cash_date` (`txn_date`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_transactions`
--

LOCK TABLES `cash_transactions` WRITE;
/*!40000 ALTER TABLE `cash_transactions` DISABLE KEYS */;
INSERT INTO `cash_transactions` VALUES (1,'2026-11-05','RCP000001','Collection - Murugan',0.00,1000.00,1000.00,'collection','2026-11-05 09:50:06');
/*!40000 ALTER TABLE `cash_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chit_group_codes`
--

DROP TABLE IF EXISTS `chit_group_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chit_group_codes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `series` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_value` decimal(14,2) NOT NULL,
  `members` int unsigned NOT NULL,
  `admission_fee` decimal(12,2) NOT NULL DEFAULT '0.00',
  `auction_day` tinyint unsigned DEFAULT NULL,
  `company_comm_pct` decimal(5,2) NOT NULL DEFAULT '5.00',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `series` (`series`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chit_group_codes`
--

LOCK TABLES `chit_group_codes` WRITE;
/*!40000 ALTER TABLE `chit_group_codes` DISABLE KEYS */;
INSERT INTO `chit_group_codes` VALUES (1,'Chit01',10000.00,10,0.00,15,2.00,'active','2026-11-05 07:12:01','2026-11-05 07:12:01'),(2,'Chit02',400000.00,1000,0.00,10,3.00,'active','2026-11-05 10:01:15','2026-11-05 10:01:15');
/*!40000 ALTER TABLE `chit_group_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chit_groups`
--

DROP TABLE IF EXISTS `chit_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chit_groups` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `group_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_code_id` int unsigned DEFAULT NULL,
  `group_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` int unsigned NOT NULL,
  `pso_number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pso_date` date DEFAULT NULL,
  `agreement_no` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `agreement_date` date DEFAULT NULL,
  `duration` int unsigned NOT NULL,
  `group_value` decimal(14,2) NOT NULL,
  `number_of_members` int unsigned NOT NULL,
  `admission_fee` decimal(12,2) NOT NULL DEFAULT '0.00',
  `service_tax` decimal(12,2) NOT NULL DEFAULT '0.00',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `auction_time_from` time DEFAULT NULL,
  `auction_time_to` time DEFAULT NULL,
  `auction_by` enum('day','week') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'day',
  `auction_by_value` tinyint unsigned DEFAULT NULL,
  `frequency` enum('daily','weekly','monthly','bimonthly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `company_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `company_ticket_no` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `company_auction_no` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `company_comm_pct` decimal(5,2) NOT NULL DEFAULT '5.00',
  `authorized` tinyint(1) NOT NULL DEFAULT '1',
  `fdr_details` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','inactive','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_code` (`group_code`),
  KEY `fk_groups_branch` (`branch_id`),
  KEY `fk_groups_code` (`group_code_id`),
  CONSTRAINT `fk_groups_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_groups_code` FOREIGN KEY (`group_code_id`) REFERENCES `chit_group_codes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chit_groups`
--

LOCK TABLES `chit_groups` WRITE;
/*!40000 ALTER TABLE `chit_groups` DISABLE KEYS */;
INSERT INTO `chit_groups` VALUES (1,'GRP001',1,'Gold Scheme',5,'PSO/2026/001','2026-11-30','',NULL,10,10000.00,10,0.00,0.00,'2026-11-05','2027-08-05',NULL,NULL,'day',15,'monthly','','','',2.00,1,0,'active','2026-11-05 07:14:39','2026-11-05 07:14:39'),(2,'GRP002',2,'Silver Scheme',5,'PSO/2026/002','2026-11-30','',NULL,1000,400000.00,1000,0.00,0.00,'2026-11-05','2110-02-05',NULL,NULL,'day',10,'monthly','','','',3.00,1,0,'active','2026-11-05 10:02:38','2026-11-05 10:02:38');
/*!40000 ALTER TABLE `chit_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `collections`
--

DROP TABLE IF EXISTS `collections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `collections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `receipt_no` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receipt_type` enum('chit','arrear') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'chit',
  `customer_id` int unsigned NOT NULL,
  `group_id` int unsigned DEFAULT NULL,
  `branch_id` int unsigned NOT NULL,
  `staff_id` int unsigned DEFAULT NULL,
  `due_number` int unsigned NOT NULL,
  `due_amount` decimal(14,2) NOT NULL,
  `collected_amount` decimal(14,2) NOT NULL,
  `pending_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payment_mode` enum('cash','upi','bank_transfer','cheque') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `collection_date` date NOT NULL,
  `collection_time` time NOT NULL,
  `remarks` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` enum('completed','pending','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'completed',
  `cancel_reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cancelled_by` int unsigned DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `receipt_no` (`receipt_no`),
  KEY `idx_collection_date` (`collection_date`),
  KEY `fk_collections_customer` (`customer_id`),
  KEY `fk_collections_group` (`group_id`),
  KEY `fk_collections_branch` (`branch_id`),
  KEY `fk_collections_staff` (`staff_id`),
  KEY `fk_collections_canceller` (`cancelled_by`),
  CONSTRAINT `fk_collections_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_collections_canceller` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_collections_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_collections_group` FOREIGN KEY (`group_id`) REFERENCES `chit_groups` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_collections_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collections`
--

LOCK TABLES `collections` WRITE;
/*!40000 ALTER TABLE `collections` DISABLE KEYS */;
INSERT INTO `collections` VALUES (1,'RCP000001','chit',1,1,5,2,1,1000.00,1000.00,0.00,'cash','','2026-11-05','15:19:00','','completed','',NULL,NULL,2,'2026-11-05 09:50:06');
/*!40000 ALTER TABLE `collections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_transfers`
--

DROP TABLE IF EXISTS `customer_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_transfers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` int unsigned NOT NULL,
  `from_group_id` int unsigned DEFAULT NULL,
  `to_group_id` int unsigned DEFAULT NULL,
  `from_staff_id` int unsigned DEFAULT NULL,
  `to_staff_id` int unsigned DEFAULT NULL,
  `from_branch_id` int unsigned DEFAULT NULL,
  `to_branch_id` int unsigned DEFAULT NULL,
  `transfer_date` date NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_transfers_customer` (`customer_id`),
  CONSTRAINT `fk_transfers_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_transfers`
--

LOCK TABLES `customer_transfers` WRITE;
/*!40000 ALTER TABLE `customer_transfers` DISABLE KEYS */;
INSERT INTO `customer_transfers` VALUES (1,1,1,2,2,2,5,5,'2026-11-05','transfer',1,'2026-11-05 10:03:06'),(2,1,2,1,2,2,5,5,'2026-11-05','transfer',1,'2026-11-05 10:04:14');
/*!40000 ALTER TABLE `customer_transfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `customer_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `father_spouse_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `rep_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pan_no` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `dob` date DEFAULT NULL,
  `mobile` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alt_mobile` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `district` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pincode` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `permanent_address` tinyint(1) NOT NULL DEFAULT '0',
  `area` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `branch_id` int unsigned NOT NULL,
  `staff_id` int unsigned DEFAULT NULL,
  `agent_id` int unsigned DEFAULT NULL,
  `agent_type` enum('single','multi') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'single',
  `group_id` int unsigned DEFAULT NULL,
  `joining_date` date NOT NULL,
  `nominee_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `nominee_relation` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `nominee_age` tinyint unsigned DEFAULT NULL,
  `intimation_type` enum('post','hand','courier') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'post',
  `intimation_card` tinyint(1) NOT NULL DEFAULT '1',
  `collection_type` enum('monthly','bimonthly','weekly','daily') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `status` enum('active','inactive','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `photo_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_code` (`customer_code`),
  KEY `fk_customers_branch` (`branch_id`),
  KEY `fk_customers_staff` (`staff_id`),
  KEY `fk_customers_group` (`group_id`),
  KEY `fk_customers_agent` (`agent_id`),
  CONSTRAINT `fk_customers_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customers_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  CONSTRAINT `fk_customers_group` FOREIGN KEY (`group_id`) REFERENCES `chit_groups` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customers_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'CUST00001','Murugan','Valli Murugan','Shiva','LKMJI8563W','1980-01-01','7865123069','','9865320741','murugan@gmail.com','2/986, Rajivee Nagar, Main Road','Tuticorin','628002',1,'Anna Nagar Tuty',5,2,2,'single',1,'2026-11-05','Paravathi','Mother',50,'post',1,'monthly','active','uploads/customers/f679333c35d3afe8edf657db97067cff.jpg','2026-11-05 08:19:58','2026-11-05 10:04:14');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `day_end_closings`
--

DROP TABLE IF EXISTS `day_end_closings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `day_end_closings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `closing_date` date NOT NULL,
  `opening_cash` decimal(14,2) NOT NULL DEFAULT '0.00',
  `cash_collection` decimal(14,2) NOT NULL DEFAULT '0.00',
  `other_cash_receipt` decimal(14,2) NOT NULL DEFAULT '0.00',
  `expenses` decimal(14,2) NOT NULL DEFAULT '0.00',
  `withdrawals` decimal(14,2) NOT NULL DEFAULT '0.00',
  `expected_closing_cash` decimal(14,2) NOT NULL DEFAULT '0.00',
  `physical_cash` decimal(14,2) NOT NULL DEFAULT '0.00',
  `difference` decimal(14,2) NOT NULL DEFAULT '0.00',
  `bank_credits` decimal(14,2) NOT NULL DEFAULT '0.00',
  `bank_debits` decimal(14,2) NOT NULL DEFAULT '0.00',
  `upi_collection` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_collection` decimal(14,2) NOT NULL DEFAULT '0.00',
  `pending_approvals` int unsigned NOT NULL DEFAULT '0',
  `rejected_transactions` int unsigned NOT NULL DEFAULT '0',
  `status` enum('open','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `closed_by` int unsigned DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `remarks` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `closing_date` (`closing_date`),
  KEY `fk_dayend_user` (`closed_by`),
  CONSTRAINT `fk_dayend_user` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `day_end_closings`
--

LOCK TABLES `day_end_closings` WRITE;
/*!40000 ALTER TABLE `day_end_closings` DISABLE KEYS */;
INSERT INTO `day_end_closings` VALUES (1,'2026-11-02',0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0,0,'open',NULL,NULL,''),(2,'2026-11-03',0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0,0,'open',NULL,NULL,''),(3,'2026-11-04',0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0,0,'open',NULL,NULL,''),(4,'2026-11-05',0.00,1000.00,0.00,0.00,0.00,1000.00,0.00,0.00,0.00,0.00,0.00,1000.00,0,0,'open',NULL,NULL,'');
/*!40000 ALTER TABLE `day_end_closings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `due_schedules`
--

DROP TABLE IF EXISTS `due_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `due_schedules` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` int unsigned NOT NULL,
  `group_id` int unsigned DEFAULT NULL,
  `due_number` int unsigned NOT NULL,
  `due_date` date NOT NULL,
  `due_amount` decimal(14,2) NOT NULL,
  `paid_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `payment_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_due` (`customer_id`,`due_number`),
  KEY `idx_due_date` (`due_date`),
  KEY `fk_dues_group` (`group_id`),
  CONSTRAINT `fk_dues_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dues_group` FOREIGN KEY (`group_id`) REFERENCES `chit_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `due_schedules`
--

LOCK TABLES `due_schedules` WRITE;
/*!40000 ALTER TABLE `due_schedules` DISABLE KEYS */;
INSERT INTO `due_schedules` VALUES (1,1,1,1,'2026-12-05',1000.00,1000.00,'2026-11-05'),(2,1,1,2,'2027-01-05',1000.00,0.00,NULL),(3,1,1,3,'2027-02-05',1000.00,0.00,NULL),(4,1,1,4,'2027-03-05',1000.00,0.00,NULL),(5,1,1,5,'2027-04-05',1000.00,0.00,NULL),(6,1,1,6,'2027-05-05',1000.00,0.00,NULL),(7,1,1,7,'2027-06-05',1000.00,0.00,NULL),(8,1,1,8,'2027-07-05',1000.00,0.00,NULL),(9,1,1,9,'2027-08-05',1000.00,0.00,NULL),(10,1,1,10,'2027-09-05',1000.00,0.00,NULL);
/*!40000 ALTER TABLE `due_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_attempts`
--

DROP TABLE IF EXISTS `login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_attempts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempted_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_attempt_ip` (`ip`,`attempted_at`),
  KEY `idx_attempt_email` (`email`,`attempted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_attempts`
--

LOCK TABLES `login_attempts` WRITE;
/*!40000 ALTER TABLE `login_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `login_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `type` enum('due_today','overdue','payment_submitted','manager_approval','md_approval','payment_approved','payment_rejected','transfer','day_end') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,'transfer','Customer Transfer','Murugan transferred from GRP001 to GRP002',1,'2026-11-05 15:33:06'),(2,'transfer','Customer Transfer','Murugan transferred from GRP002 to GRP001',1,'2026-11-05 15:34:14');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_approvals`
--

DROP TABLE IF EXISTS `payment_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_approvals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payment_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_type` enum('customer','expense','salary') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer',
  `customer_id` int unsigned DEFAULT NULL,
  `employee_id` int unsigned DEFAULT NULL,
  `salary_month` char(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `payment_mode` enum('cash','upi','bank_transfer','cheque') COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_account_id` int unsigned DEFAULT NULL,
  `reference_no` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `remarks` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `submitted_by` int unsigned NOT NULL,
  `branch_id` int unsigned DEFAULT NULL,
  `submitted_at` datetime NOT NULL,
  `current_stage` enum('payment_informed','manager_accepted','md_approved','completed','rejected','sent_back') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'payment_informed',
  `manager_id` int unsigned DEFAULT NULL,
  `manager_action_at` datetime DEFAULT NULL,
  `md_id` int unsigned DEFAULT NULL,
  `md_action_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_code` (`payment_code`),
  KEY `fk_payments_customer` (`customer_id`),
  KEY `fk_payments_bank` (`bank_account_id`),
  KEY `fk_payments_submitter` (`submitted_by`),
  KEY `fk_payments_branch` (`branch_id`),
  KEY `fk_payments_manager` (`manager_id`),
  KEY `fk_payments_md` (`md_id`),
  KEY `idx_payment_salary` (`employee_id`,`salary_month`),
  CONSTRAINT `fk_payments_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_employee` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_md` FOREIGN KEY (`md_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_approvals`
--

LOCK TABLES `payment_approvals` WRITE;
/*!40000 ALTER TABLE `payment_approvals` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `setting_key` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES ('agent_commission_pct','2'),('company_address',''),('company_name','SABARI THENDRAL CHITS PVT LTD'),('currency','inr'),('foreman_commission_pct','5'),('fy_start','apr'),('gst_number',''),('max_bid_pct','40');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `emp_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('md','admin','manager','staff') COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` int unsigned DEFAULT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `joining_date` date DEFAULT NULL,
  `monthly_target` decimal(14,2) NOT NULL DEFAULT '0.00',
  `monthly_salary` decimal(14,2) NOT NULL DEFAULT '0.00',
  `photo_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `emp_id` (`emp_id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_branch` (`branch_id`),
  CONSTRAINT `fk_users_branch` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'EMP001','Rajesh Kumar','9876543210','rajesh@fincol.in','$2y$10$eGD7zD4TkKQf1.veT7IXQOdNSAcZlBlvwGgHqGF/IuwULG/0evMLm','md',5,'T Nagar, Chennai','active','2023-04-01',0.00,0.00,'uploads/users/97917de10306a2f0213ef3a11995d181.jpg','2026-10-29 09:53:15','2026-11-04 11:42:58'),(2,'EMP002','Vinayaga','9865741230','vinayaga@gmail.com','$2y$10$TiNEBdH6gXu2kxEgGSNZSe9ufvkpZ.6LquKbeiFuh2IA9qSvLU/0S','staff',5,'Tuticorin','active','2020-04-01',350000.00,25000.00,'uploads/users/817230af93ac2defededc65b8b85af7e.jpg','2026-11-05 08:08:15','2026-11-05 10:22:19');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vouchers`
--

DROP TABLE IF EXISTS `vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vouchers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `voucher_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `voucher_date` date NOT NULL,
  `voucher_type` enum('payment','receipt','expense','contra') COLLATE utf8mb4_unicode_ci NOT NULL,
  `account` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `payment_mode` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `narration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `created_by` int unsigned DEFAULT NULL,
  `approval_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `voucher_number` (`voucher_number`),
  KEY `fk_vouchers_user` (`created_by`),
  CONSTRAINT `fk_vouchers_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vouchers`
--

LOCK TABLES `vouchers` WRITE;
/*!40000 ALTER TABLE `vouchers` DISABLE KEYS */;
/*!40000 ALTER TABLE `vouchers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `withdrawals`
--

DROP TABLE IF EXISTS `withdrawals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withdrawals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `withdrawal_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `withdrawal_date` date NOT NULL,
  `bank_account_id` int unsigned DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `mode` enum('bank_transfer','cheque','cash') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `requested_by` int unsigned DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `withdrawal_code` (`withdrawal_code`),
  KEY `fk_withdrawals_account` (`bank_account_id`),
  KEY `fk_withdrawals_requester` (`requested_by`),
  KEY `fk_withdrawals_approver` (`approved_by`),
  CONSTRAINT `fk_withdrawals_account` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_withdrawals_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_withdrawals_requester` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `withdrawals`
--

LOCK TABLES `withdrawals` WRITE;
/*!40000 ALTER TABLE `withdrawals` DISABLE KEYS */;
/*!40000 ALTER TABLE `withdrawals` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-05 17:34:26
