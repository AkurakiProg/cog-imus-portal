-- ============================================================
-- Migration: Add Multi-Factor Authentication (MFA) Support
-- Compatible with MySQL 5.7+ / MariaDB 10.3+
-- ============================================================

USE `church_portal`;

-- 1. Add MFA columns to `users` table if not exists
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `mfa_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_verified`,
  ADD COLUMN IF NOT EXISTS `mfa_secret` TEXT DEFAULT NULL AFTER `mfa_enabled`,
  ADD COLUMN IF NOT EXISTS `mfa_temp_secret` TEXT DEFAULT NULL AFTER `mfa_secret`,
  ADD COLUMN IF NOT EXISTS `mfa_enrolled_at` DATETIME DEFAULT NULL AFTER `mfa_temp_secret`,
  ADD COLUMN IF NOT EXISTS `mfa_last_timestep` BIGINT DEFAULT NULL AFTER `mfa_enrolled_at`;

-- 2. Create `user_mfa_recovery_codes` table for hashed single-use recovery codes
CREATE TABLE IF NOT EXISTS `user_mfa_recovery_codes` (
  `code_id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `is_used` TINYINT(1) NOT NULL DEFAULT 0,
  `used_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`code_id`),
  KEY `idx_recovery_user` (`user_id`, `is_used`),
  CONSTRAINT `fk_recovery_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create `mfa_login_challenges` table for short-lived 2FA challenges
CREATE TABLE IF NOT EXISTS `mfa_login_challenges` (
  `challenge_id` VARCHAR(64) NOT NULL,
  `user_id` INT(11) NOT NULL,
  `attempts` INT(11) NOT NULL DEFAULT 0,
  `max_attempts` INT(11) NOT NULL DEFAULT 5,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`challenge_id`),
  KEY `idx_challenge_user` (`user_id`),
  KEY `idx_challenge_expires` (`expires_at`),
  CONSTRAINT `fk_challenge_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
