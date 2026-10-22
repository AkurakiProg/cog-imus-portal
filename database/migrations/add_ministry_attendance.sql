-- ============================================================
-- Migration: Add Ministry Attendance Support
-- Supports tracking attendance of members in the ministry roster.
-- ============================================================

CREATE TABLE IF NOT EXISTS `ministry_attendance` (
  `attendance_id` INT(11) NOT NULL AUTO_INCREMENT,
  `ministry_id` INT(11) NOT NULL,
  `session_title` VARCHAR(150) NOT NULL,
  `session_date` DATE NOT NULL,
  `session_type` ENUM('Meeting', 'Rehearsal', 'Service Duty', 'Training', 'Special') NOT NULL DEFAULT 'Meeting',
  `recorded_by` INT(11) NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_id`),
  KEY `fk_min_att_ministry` (`ministry_id`),
  KEY `fk_min_att_user` (`recorded_by`),
  KEY `idx_min_att_date` (`session_date`),
  CONSTRAINT `fk_min_att_ministry` FOREIGN KEY (`ministry_id`) REFERENCES `ministries` (`ministry_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_min_att_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ministry_attendance_records` (
  `record_id` INT(11) NOT NULL AUTO_INCREMENT,
  `attendance_id` INT(11) NOT NULL,
  `member_id` INT(11) NOT NULL,
  `status` ENUM('Present', 'Late', 'Excused', 'Absent') NOT NULL DEFAULT 'Present',
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`record_id`),
  UNIQUE KEY `uk_session_member` (`attendance_id`, `member_id`),
  KEY `fk_min_att_rec_att` (`attendance_id`),
  KEY `fk_min_att_rec_mem` (`member_id`),
  CONSTRAINT `fk_min_att_rec_att` FOREIGN KEY (`attendance_id`) REFERENCES `ministry_attendance` (`attendance_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_min_att_rec_mem` FOREIGN KEY (`member_id`) REFERENCES `members` (`member_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
