-- ============================================================
-- Church of God World Missions Philippines - Imus
-- Complete Production Database Schema & Initial Seeds
-- Auto-generated for Production Deployments & Migration
-- Run: mysql -u <user> -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `church_portal` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `church_portal`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `announcements`;
DROP TABLE IF EXISTS `attendance_tallies`;
DROP TABLE IF EXISTS `audit_trail`;
DROP TABLE IF EXISTS `banners`;
DROP TABLE IF EXISTS `c2s_group_members`;
DROP TABLE IF EXISTS `c2s_groups`;
DROP TABLE IF EXISTS `contact_messages`;
DROP TABLE IF EXISTS `content_pages`;
DROP TABLE IF EXISTS `department_heads`;
DROP TABLE IF EXISTS `email_logs`;
DROP TABLE IF EXISTS `event_enrollments`;
DROP TABLE IF EXISTS `events`;
DROP TABLE IF EXISTS `finance_categories`;
DROP TABLE IF EXISTS `finance_transactions`;
DROP TABLE IF EXISTS `gallery_albums`;
DROP TABLE IF EXISTS `gallery_images`;
DROP TABLE IF EXISTS `livestream_broadcast`;
DROP TABLE IF EXISTS `livestream_comment_logs`;
DROP TABLE IF EXISTS `livestream_comments`;
DROP TABLE IF EXISTS `livestream_daily_views`;
DROP TABLE IF EXISTS `livestream_viewer_sessions`;
DROP TABLE IF EXISTS `members`;
DROP TABLE IF EXISTS `mfa_login_challenges`;
DROP TABLE IF EXISTS `ministries`;
DROP TABLE IF EXISTS `ministry_attendance`;
DROP TABLE IF EXISTS `ministry_attendance_records`;
DROP TABLE IF EXISTS `ministry_members`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `schedules`;
DROP TABLE IF EXISTS `sermons`;
DROP TABLE IF EXISTS `sms_logs`;
DROP TABLE IF EXISTS `user_mfa_recovery_codes`;
DROP TABLE IF EXISTS `users`;

-- Table structure for table `announcements`
CREATE TABLE `announcements` (
  `announcement_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `category` enum('General','Event','Urgent','Ministry','Finance','Youth') DEFAULT 'General',
  `department` varchar(100) DEFAULT NULL,
  `ministry_id` int(11) DEFAULT NULL,
  `target_audience` enum('All','Members','Leaders','Public') DEFAULT 'All',
  `sms_triggered` tinyint(1) DEFAULT 0,
  `sms_triggered_at` datetime DEFAULT NULL,
  `email_triggered` tinyint(1) DEFAULT 0,
  `email_triggered_at` datetime DEFAULT NULL,
  `is_pinned` tinyint(1) DEFAULT 0,
  `is_published` tinyint(1) DEFAULT 1,
  `publish_date` datetime NOT NULL DEFAULT current_timestamp(),
  `expiry_date` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`announcement_id`),
  KEY `fk_ann_user` (`created_by`),
  KEY `idx_announcements_published` (`is_published`,`publish_date`),
  CONSTRAINT `fk_ann_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `attendance_tallies`
CREATE TABLE `attendance_tallies` (
  `tally_id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) DEFAULT NULL,
  `service_type` varchar(100) NOT NULL,
  `service_date` date NOT NULL,
  `adult_count` int(11) DEFAULT 0,
  `youth_count` int(11) DEFAULT 0,
  `children_count` int(11) DEFAULT 0,
  `visitor_count` int(11) DEFAULT 0,
  `total_count` int(11) DEFAULT 0,
  `recorded_by` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tally_id`),
  KEY `fk_tally_event` (`event_id`),
  KEY `fk_tally_user` (`recorded_by`),
  KEY `idx_attendance_date` (`service_date`),
  CONSTRAINT `fk_tally_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tally_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `audit_trail`
CREATE TABLE `audit_trail` (
  `audit_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `module` varchar(100) NOT NULL,
  `record_id` int(11) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `performed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`audit_id`),
  KEY `idx_audit_user_date` (`user_id`,`performed_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1278 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `banners`
CREATE TABLE `banners` (
  `banner_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `image_path` varchar(255) NOT NULL,
  `link_url` varchar(255) DEFAULT NULL,
  `position` enum('Homepage Hero','Sidebar','Event Banner','Footer') DEFAULT 'Homepage Hero',
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`banner_id`),
  KEY `fk_banners_user` (`created_by`),
  CONSTRAINT `fk_banners_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `c2s_group_members`
CREATE TABLE `c2s_group_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `member_id` int(11) NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `joined_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_c2s_group_member` (`group_id`,`member_id`),
  KEY `idx_c2s_group` (`group_id`),
  KEY `idx_c2s_member` (`member_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `c2s_groups`
CREATE TABLE `c2s_groups` (
  `group_id` int(11) NOT NULL AUTO_INCREMENT,
  `group_name` varchar(150) NOT NULL,
  `leader_id` int(11) DEFAULT NULL,
  `meeting_day` varchar(50) DEFAULT 'Wednesday',
  `meeting_time` varchar(50) DEFAULT '7:00 PM',
  `meeting_location` varchar(255) DEFAULT 'Main Church Hall',
  `description` text DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`group_id`),
  KEY `idx_c2s_leader` (`leader_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `contact_messages`
CREATE TABLE `contact_messages` (
  `message_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `is_replied` tinyint(1) DEFAULT 0,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `replied_at` datetime DEFAULT NULL,
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `content_pages`
CREATE TABLE `content_pages` (
  `page_id` int(11) NOT NULL AUTO_INCREMENT,
  `page_key` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text DEFAULT NULL,
  `featured_image` varchar(255) DEFAULT NULL,
  `is_published` tinyint(1) DEFAULT 1,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`page_id`),
  UNIQUE KEY `page_key` (`page_key`),
  KEY `fk_pages_user` (`updated_by`),
  CONSTRAINT `fk_pages_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `department_heads`
CREATE TABLE `department_heads` (
  `department_head_id` int(11) NOT NULL AUTO_INCREMENT,
  `department` enum('Worship','Outreach','Relationship','Discipleship','Administration') NOT NULL,
  `head_member_id` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`department_head_id`),
  UNIQUE KEY `department` (`department`),
  KEY `head_member_id` (`head_member_id`),
  CONSTRAINT `department_heads_ibfk_1` FOREIGN KEY (`head_member_id`) REFERENCES `members` (`member_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1175 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `email_logs`
CREATE TABLE `email_logs` (
  `email_id` int(11) NOT NULL AUTO_INCREMENT,
  `announcement_id` int(11) DEFAULT NULL,
  `recipient_email` varchar(150) NOT NULL,
  `recipient_name` varchar(150) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `status` varchar(50) DEFAULT 'Sent',
  `error_message` text DEFAULT NULL,
  `triggered_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`email_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `event_enrollments`
CREATE TABLE `event_enrollments` (
  `enrollment_id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NOT NULL,
  `member_id` int(11) NOT NULL,
  `enrollment_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('Pending','Confirmed','Attended','Cancelled','No-show') DEFAULT 'Pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`enrollment_id`),
  UNIQUE KEY `uk_event_member` (`event_id`,`member_id`),
  KEY `fk_ee_member` (`member_id`),
  CONSTRAINT `fk_ee_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ee_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`member_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `events`
CREATE TABLE `events` (
  `event_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `event_type` enum('Worship','Seminary','Seminar','Outreach','Fellowship','Conference','Other') DEFAULT 'Other',
  `start_datetime` datetime NOT NULL,
  `end_datetime` datetime NOT NULL,
  `venue` varchar(255) DEFAULT NULL,
  `organizer` varchar(500) DEFAULT NULL,
  `ministry_id` int(11) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `banner_image` varchar(255) DEFAULT NULL,
  `capacity` int(11) DEFAULT NULL,
  `is_enrollment_open` tinyint(1) DEFAULT 0,
  `is_public` tinyint(1) DEFAULT 1,
  `is_featured` tinyint(1) DEFAULT 0,
  `status` enum('Upcoming','Ongoing','Completed','Cancelled') DEFAULT 'Upcoming',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `fk_events_ministry` (`ministry_id`),
  KEY `idx_events_dates` (`start_datetime`,`end_datetime`),
  KEY `idx_events_status` (`status`),
  CONSTRAINT `fk_events_ministry` FOREIGN KEY (`ministry_id`) REFERENCES `ministries` (`ministry_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `finance_categories`
CREATE TABLE `finance_categories` (
  `category_id` int(11) NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  `category_type` enum('Income','Expense') NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `finance_transactions`
CREATE TABLE `finance_transactions` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `category_id` int(11) NOT NULL,
  `ministry_id` int(11) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `branch_id` int(11) DEFAULT NULL,
  `transaction_type` enum('Income','Expense') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `transaction_date` date NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `recorded_by` int(11) NOT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`transaction_id`),
  KEY `fk_ft_category` (`category_id`),
  KEY `fk_ft_user` (`recorded_by`),
  KEY `idx_finance_type_date` (`transaction_type`,`transaction_date`),
  KEY `ministry_id` (`ministry_id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `finance_transactions_ibfk_1` FOREIGN KEY (`ministry_id`) REFERENCES `ministries` (`ministry_id`) ON DELETE SET NULL,
  CONSTRAINT `finance_transactions_ibfk_2` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`branch_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ft_category` FOREIGN KEY (`category_id`) REFERENCES `finance_categories` (`category_id`),
  CONSTRAINT `fk_ft_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `gallery_albums`
CREATE TABLE `gallery_albums` (
  `album_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `event_id` int(11) DEFAULT NULL,
  `ministry_id` int(11) DEFAULT NULL,
  `theme` varchar(100) DEFAULT NULL,
  `album_date` date NOT NULL,
  `cover_image` varchar(255) DEFAULT NULL,
  `is_published` tinyint(1) DEFAULT 1,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`album_id`),
  KEY `fk_album_event` (`event_id`),
  KEY `fk_album_ministry` (`ministry_id`),
  KEY `fk_album_user` (`created_by`),
  KEY `idx_gallery_albums_date` (`album_date`),
  CONSTRAINT `fk_album_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_album_ministry` FOREIGN KEY (`ministry_id`) REFERENCES `ministries` (`ministry_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_album_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `gallery_images`
CREATE TABLE `gallery_images` (
  `image_id` int(11) NOT NULL AUTO_INCREMENT,
  `album_id` int(11) NOT NULL,
  `image_path` varchar(255) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `display_order` int(11) DEFAULT 0,
  `uploaded_by` int(11) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`image_id`),
  KEY `fk_images_album` (`album_id`),
  KEY `fk_images_user` (`uploaded_by`),
  CONSTRAINT `fk_images_album` FOREIGN KEY (`album_id`) REFERENCES `gallery_albums` (`album_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_images_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `livestream_broadcast`
CREATE TABLE `livestream_broadcast` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL DEFAULT 'Sunday Celebration Service - Live Broadcast',
  `description` text DEFAULT NULL,
  `preacher` varchar(150) DEFAULT 'Pastor Juan Dela Cruz',
  `platform` varchar(50) NOT NULL DEFAULT 'facebook',
  `stream_url` text DEFAULT NULL,
  `stream_key` varchar(255) DEFAULT NULL,
  `is_live` tinyint(1) NOT NULL DEFAULT 0,
  `updated_by` int(11) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fb_live_views` int(11) DEFAULT 0,
  `fb_total_views` int(11) DEFAULT 0,
  `fb_synced_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `livestream_comment_logs`
CREATE TABLE `livestream_comment_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `broadcast_id` int(11) DEFAULT NULL,
  `broadcast_title` varchar(255) DEFAULT NULL,
  `author_name` varchar(150) NOT NULL,
  `comment_text` text NOT NULL,
  `author_badge` varchar(50) DEFAULT 'Viewer',
  `is_admin` tinyint(1) DEFAULT 0,
  `comment_created_at` datetime DEFAULT NULL,
  `archived_at` datetime DEFAULT current_timestamp(),
  `session_started_at` datetime DEFAULT NULL,
  `session_ended_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_broadcast_title` (`broadcast_title`),
  KEY `idx_archived_at` (`archived_at`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `livestream_comments`
CREATE TABLE `livestream_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `author_name` varchar(100) NOT NULL,
  `comment_text` text NOT NULL,
  `author_badge` varchar(50) DEFAULT 'Viewer',
  `is_admin` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `livestream_daily_views`
CREATE TABLE `livestream_daily_views` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `view_date` date NOT NULL,
  `views_count` int(11) DEFAULT 0,
  `peak_viewers` int(11) DEFAULT 0,
  `stream_title` varchar(255) DEFAULT 'Sunday Celebration Service - Live Broadcast',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fb_views_count` int(11) DEFAULT 0,
  `fb_peak_viewers` int(11) DEFAULT 0,
  `fb_synced_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `view_date` (`view_date`)
) ENGINE=InnoDB AUTO_INCREMENT=2716 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `livestream_viewer_sessions`
CREATE TABLE `livestream_viewer_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `broadcast_id` int(11) DEFAULT 1,
  `view_date` date NOT NULL,
  `viewer_id` varchar(100) NOT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `first_watched_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_broadcast_viewer` (`view_date`,`viewer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for table `members`
CREATE TABLE `members` (
  `member_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) NOT NULL,
  `suffix` varchar(10) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `gender` enum('Male','Female','Other') DEFAULT NULL,
  `civil_status` enum('Single','Married','Widowed','Separated','Divorced') DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `church_role` enum('Member','Leader','Admin') DEFAULT 'Member',
  `address` text DEFAULT NULL,
  `occupation` varchar(150) DEFAULT NULL,
  `baptized` tinyint(1) DEFAULT 0,
  `baptism_date` date DEFAULT NULL,
  `membership_date` date DEFAULT NULL,
  `emergency_contact_name` varchar(150) DEFAULT NULL,
  `emergency_contact_number` varchar(20) DEFAULT NULL,
  `status` enum('Active','Inactive','Transferred','Deceased') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `sms_notifications_enabled` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`member_id`),
  KEY `fk_members_user` (`user_id`),
  KEY `idx_members_status` (`status`),
  KEY `idx_members_name` (`last_name`,`first_name`),
  CONSTRAINT `fk_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `mfa_login_challenges`
CREATE TABLE `mfa_login_challenges` (
  `challenge_id` varchar(64) NOT NULL,
  `user_id` int(11) NOT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `max_attempts` int(11) NOT NULL DEFAULT 5,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`challenge_id`),
  KEY `idx_challenge_user` (`user_id`),
  KEY `idx_challenge_expires` (`expires_at`),
  CONSTRAINT `fk_challenge_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `ministries`
CREATE TABLE `ministries` (
  `ministry_id` int(11) NOT NULL AUTO_INCREMENT,
  `ministry_name` varchar(150) NOT NULL,
  `ministry_code` varchar(20) NOT NULL,
  `department` enum('Worship','Outreach','Relationship','Discipleship','Administration') DEFAULT 'Worship',
  `description` text DEFAULT NULL,
  `leader_member_id` int(11) DEFAULT NULL,
  `meeting_schedule` varchar(150) DEFAULT NULL,
  `color_code` varchar(20) DEFAULT '#3498db',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ministry_id`),
  UNIQUE KEY `ministry_code` (`ministry_code`),
  KEY `fk_ministries_leader` (`leader_member_id`),
  KEY `idx_ministries_dept` (`department`),
  CONSTRAINT `fk_ministries_leader` FOREIGN KEY (`leader_member_id`) REFERENCES `members` (`member_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `ministry_attendance`
CREATE TABLE `ministry_attendance` (
  `attendance_id` int(11) NOT NULL AUTO_INCREMENT,
  `ministry_id` int(11) NOT NULL,
  `session_title` varchar(150) NOT NULL,
  `session_date` date NOT NULL,
  `session_type` enum('Meeting','Rehearsal','Service Duty','Training','Special') NOT NULL DEFAULT 'Meeting',
  `recorded_by` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`attendance_id`),
  KEY `fk_min_att_ministry` (`ministry_id`),
  KEY `fk_min_att_user` (`recorded_by`),
  KEY `idx_min_att_date` (`session_date`),
  CONSTRAINT `fk_min_att_ministry` FOREIGN KEY (`ministry_id`) REFERENCES `ministries` (`ministry_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_min_att_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `ministry_attendance_records`
CREATE TABLE `ministry_attendance_records` (
  `record_id` int(11) NOT NULL AUTO_INCREMENT,
  `attendance_id` int(11) NOT NULL,
  `member_id` int(11) NOT NULL,
  `status` enum('Present','Late','Excused','Absent') NOT NULL DEFAULT 'Present',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`record_id`),
  UNIQUE KEY `uk_session_member` (`attendance_id`,`member_id`),
  KEY `fk_min_att_rec_att` (`attendance_id`),
  KEY `fk_min_att_rec_mem` (`member_id`),
  CONSTRAINT `fk_min_att_rec_att` FOREIGN KEY (`attendance_id`) REFERENCES `ministry_attendance` (`attendance_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_min_att_rec_mem` FOREIGN KEY (`member_id`) REFERENCES `members` (`member_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `ministry_members`
CREATE TABLE `ministry_members` (
  `ministry_member_id` int(11) NOT NULL AUTO_INCREMENT,
  `ministry_id` int(11) NOT NULL,
  `member_id` int(11) NOT NULL,
  `role_in_ministry` varchar(100) DEFAULT 'Member',
  `joined_date` date NOT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ministry_member_id`),
  UNIQUE KEY `uk_ministry_member` (`ministry_id`,`member_id`),
  KEY `idx_ministry_members_member` (`member_id`),
  CONSTRAINT `fk_mm_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`member_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mm_ministry` FOREIGN KEY (`ministry_id`) REFERENCES `ministries` (`ministry_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=611 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `roles`
CREATE TABLE `roles` (
  `role_id` int(11) NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `role_description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `schedules`
CREATE TABLE `schedules` (
  `schedule_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `day_of_week` enum('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `venue` varchar(255) DEFAULT NULL,
  `ministry_id` int(11) DEFAULT NULL,
  `is_recurring` tinyint(1) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`schedule_id`),
  KEY `fk_sched_ministry` (`ministry_id`),
  CONSTRAINT `fk_sched_ministry` FOREIGN KEY (`ministry_id`) REFERENCES `ministries` (`ministry_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `sermons`
CREATE TABLE `sermons` (
  `sermon_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `youtube_video_id` varchar(50) NOT NULL,
  `video_url` varchar(255) DEFAULT NULL,
  `preacher` varchar(150) NOT NULL,
  `sermon_date` date NOT NULL,
  `scripture_reference` varchar(150) DEFAULT NULL,
  `series_name` varchar(150) DEFAULT NULL,
  `thumbnail_url` varchar(255) DEFAULT NULL,
  `is_live` tinyint(1) DEFAULT 0,
  `is_featured` tinyint(1) DEFAULT 0,
  `is_published` tinyint(1) DEFAULT 1,
  `tags` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`sermon_id`),
  KEY `idx_sermons_date` (`sermon_date`,`is_published`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `sms_logs`
CREATE TABLE `sms_logs` (
  `sms_id` int(11) NOT NULL AUTO_INCREMENT,
  `announcement_id` int(11) DEFAULT NULL,
  `recipient_number` varchar(20) NOT NULL,
  `recipient_name` varchar(150) DEFAULT NULL,
  `message_content` text NOT NULL,
  `status` varchar(50) DEFAULT 'Queued',
  `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `triggered_by` int(11) NOT NULL,
  `gateway_response` text DEFAULT NULL,
  PRIMARY KEY (`sms_id`),
  KEY `fk_sms_announcement` (`announcement_id`),
  KEY `fk_sms_user` (`triggered_by`),
  CONSTRAINT `fk_sms_announcement` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`announcement_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sms_user` FOREIGN KEY (`triggered_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `user_mfa_recovery_codes`
CREATE TABLE `user_mfa_recovery_codes` (
  `code_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT 0,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`code_id`),
  KEY `idx_recovery_user` (`user_id`,`is_used`),
  CONSTRAINT `fk_recovery_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for table `users`
CREATE TABLE `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `middle_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `suffix` varchar(10) DEFAULT NULL,
  `full_name` varchar(150) NOT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_verified` tinyint(1) DEFAULT 0,
  `activation_token` varchar(255) DEFAULT NULL,
  `activation_token_expires` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `current_session_token` varchar(255) DEFAULT NULL,
  `mfa_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `mfa_secret` text DEFAULT NULL,
  `mfa_temp_secret` text DEFAULT NULL,
  `mfa_enrolled_at` datetime DEFAULT NULL,
  `mfa_last_timestep` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Essential System Seeds
-- ============================================================

INSERT INTO `roles` (`role_id`, `role_name`, `role_description`) VALUES
(1, 'Admin', 'Full administrative access across all modules'),
(2, 'Church Leader', 'Access to ministry management, events, and rosters'),
(3, 'Church Member', 'Member portal access, personal events, and announcements')
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);

-- 1. Account Management: Users (Pre-deployment accounts)
INSERT INTO `users` (`user_id`, `role_id`, `username`, `email`, `password_hash`, `first_name`, `middle_name`, `last_name`, `suffix`, `full_name`, `profile_image`, `is_active`, `is_verified`, `activation_token`, `activation_token_expires`, `last_login`, `created_at`, `updated_at`, `current_session_token`, `mfa_enabled`, `mfa_secret`, `mfa_temp_secret`, `mfa_enrolled_at`, `mfa_last_timestep`) VALUES
(1,1,'admin','admin@cogwmphimus.org','$2b$10$xQ8LyaakYhbOz3O1SA0fYeDu1N5Ku1dg/HItlc1YxuW252IeosIwu','System',NULL,'Administrator',NULL,'System Administrator','/uploads/profiles/profile-1788716627804-920063387.jpg',1,1,NULL,NULL,'2026-10-21 21:40:30','2026-08-22 23:48:05','2026-10-21 13:40:30','14495e65-f153-43c9-b31b-24b5495e308c',0,NULL,NULL,NULL,NULL),(4,3,'Akuraki','jairoandreicardel54@gmail.com','$2b$10$TrjCm8pX2171MgqXnuenH.Ks9HqeMBAXIK75/s.6RLxh8WU4ZX2AO','Jairo Andrei','Ong','Cardel',NULL,'Jairo Andrei Ong Cardel','/uploads/profiles/profile-1787494078418-913876120.jpg',1,1,NULL,NULL,'2026-10-21 21:41:33','2026-08-23 14:07:58','2026-10-21 13:41:34','268b1964-d011-4780-b31c-7391df56cefc',0,NULL,'0d1bca7c29364f4680a9151d:6bdb99f643cd33b33c4e576e52d546a4:591575d5bf51b5791ad09963e097b3e040b007bff949a082c492e6948d6e44a4',NULL,NULL),(5,2,'Cedrix','nabong123@gmail.com','$2b$10$rxpyL2aIt7yjZIt7O/Y.NuQyT4Oks4f4W5wx1VCCisvMqPYjWYzJC','Cedric',NULL,'Nabong',NULL,'Cedric Nabong',NULL,1,1,NULL,NULL,'2026-10-19 00:28:01','2026-08-28 05:17:25','2026-10-21 13:39:01','ec4b0f5e-47cf-4435-a300-ef13d69fd4ba',0,NULL,NULL,NULL,NULL),(18,2,'Joane','aqt37fgpbgidltof@multitempmail.com','$2b$10$wBn5QZkLYYF0LD9bJtyVc.inQ3mzpDOfHtzI.P0QWoeg2bYoXGzHq','Joane',NULL,'Bote',NULL,'Joane Bote',NULL,1,1,NULL,NULL,'2026-10-21 21:40:42','2026-10-21 04:53:44','2026-10-21 13:40:42','13571033-3af4-44b5-b478-3dc50d5c37d1',0,NULL,NULL,NULL,NULL),(19,2,'Ronnie','pm4jjremxl@kuromee.com','$2b$10$Wmiu3aHJQqX73Ee3shMz.uZzIn/5P.U1cMVVuC8g1EE8wHO3qL/xq','Ronnie',NULL,'Alterado',NULL,'Ronnie Alterado',NULL,1,1,NULL,NULL,NULL,'2026-10-21 04:54:47','2026-10-21 10:51:31','48444991701bd4c60ee33b1717d4eb8c65f67a9a8741ec8b6bfff04512ef7dd5',0,NULL,NULL,NULL,NULL),(20,2,'James','ub5mztfeglnd3df@kuromee.com','$2b$10$uaJq7u2vbRxPPpJrSMzrC.EGvg/4HAQZp3hrEG1H5hF1myiNYhY.W','James',NULL,'Manuel',NULL,'James Manuel',NULL,1,0,NULL,NULL,NULL,'2026-10-21 05:13:26','2026-10-21 05:13:26',NULL,0,NULL,NULL,NULL,NULL),(21,2,'Michelle','k6cycf1vy@kuromee.com','$2b$10$BUbLTL/ARLkjwsZPGw.2x.kswIw.VpSoqhwLkeqJho96biCubFPtq','Michelle',NULL,'Piedad',NULL,'Michelle Piedad',NULL,1,0,NULL,NULL,NULL,'2026-10-21 05:56:37','2026-10-21 05:56:37',NULL,0,NULL,NULL,NULL,NULL),(22,2,'Clyde','du9pnbzse99nlup@kuromee.com','$2b$10$wxza/mGMImrLDkAsn6NlAuKlQwjjKwiYwKjoYckIxSsR0O7M6n452','Clyde',NULL,'Manuel',NULL,'Clyde Manuel',NULL,1,0,NULL,NULL,NULL,'2026-10-21 05:57:27','2026-10-21 05:57:27',NULL,0,NULL,NULL,NULL,NULL),(23,2,'Amore','wkbeyfj89v2bu@kuromee.com','$2b$10$dbIG8y68ig1FXHnsbV13q.WRVEhg9e4KKXKeyJhr9qQjxAvrh1Hva','Amore',NULL,'Delmar',NULL,'Amore Delmar',NULL,1,0,NULL,NULL,NULL,'2026-10-21 05:59:12','2026-10-21 06:09:22',NULL,0,NULL,NULL,NULL,NULL),(24,2,'Jemimah','a5wej73eht4@kuromee.com','$2b$10$TE37MV4hrAnMaVMVedcLxes2gnCQYv93nluuseqP.YLER1/TKr/Sm','Jemimah',NULL,'Johnson',NULL,'Jemimah Johnson',NULL,1,0,NULL,NULL,NULL,'2026-10-21 06:10:18','2026-10-21 06:10:35',NULL,0,NULL,NULL,NULL,NULL),(25,2,'Melannie','zgnrq2lfyr5e@kuromee.com','$2b$10$8BQ.2uvlECetZtdOGtSMdO2YwfP896uGCdjNznBAIaUbSIPgRKt3e','Melannie',NULL,'Dayao',NULL,'Melannie Dayao',NULL,1,0,NULL,NULL,NULL,'2026-10-21 06:11:37','2026-10-21 06:11:37',NULL,0,NULL,NULL,NULL,NULL),(26,2,'Cedric','odvc1efpa7c@kuromee.com','$2b$10$.0DRDDXV9Udm7lrNjFYTYu.ZPZw6fvhUDYHHerYT4FMCDZu/.7QWu','Cedric',NULL,'Cedeño',NULL,'Cedric Cedeño',NULL,1,0,NULL,NULL,NULL,'2026-10-21 06:12:34','2026-10-21 06:12:34',NULL,0,NULL,NULL,NULL,NULL),(27,2,'Ghie','satkgvzewxjiw2@kuromee.com','$2b$10$3b8gJyv1EJNIPvuR1rxS2.uVCLijVRStJBzb1m3ZIHpK0vvWT/ODu','Ghie',NULL,'Abergos',NULL,'Ghie Abergos',NULL,1,0,NULL,NULL,NULL,'2026-10-21 06:13:34','2026-10-21 06:13:34',NULL,0,NULL,NULL,NULL,NULL),(28,2,'Valentino','pz6fcsfsk@kuromee.com','$2b$10$s4BTtlnwWBPs1/unmoo.puwxv1HpoTG3ENACLLpyfH4yEJBNjgvb2','Valentino',NULL,'Flores',NULL,'Valentino Flores',NULL,1,0,NULL,NULL,NULL,'2026-10-21 06:14:36','2026-10-21 06:14:36',NULL,0,NULL,NULL,NULL,NULL),(29,2,'Mark','jfyyjhm4p@kuromee.com','$2b$10$LzRL/bVARm4AGARGBLfR/O98j.HeZZTJLQrs2pHkTjXA7a/UlAZkC','Mark',NULL,'San Juan',NULL,'Mark San Juan',NULL,1,1,NULL,NULL,'2026-10-21 19:00:11','2026-10-21 06:16:42','2026-10-21 11:00:35',NULL,0,NULL,NULL,NULL,NULL),(30,2,'Homer','jnrvshgvb@kuromee.com','$2b$10$WwXHmjDeGpvVZFnpQfqeaOT/0F0S1ZW9.Wehn2WQjIFVnjYHx8Gku','Homer',NULL,'Delgado',NULL,'Homer Delgado',NULL,1,0,NULL,NULL,NULL,'2026-10-21 08:40:38','2026-10-21 10:51:31','0ccc7b8132cf9722ad3e5965fe69d08717e71f5f385b15985f7a04b2ff70a84f',0,NULL,NULL,NULL,NULL),(31,2,'Ralph','foqp4fdhfzlb5@kuromee.com','$2b$10$OO1I6NMysgSPVSZtR08MsudAhoHbcCcsfJR54TV/k9beNYFnkqKou','Ralph',NULL,'Francisco',NULL,'Ralph Francisco',NULL,1,0,NULL,NULL,NULL,'2026-10-21 08:42:21','2026-10-21 08:42:21',NULL,0,NULL,NULL,NULL,NULL),(32,2,'Jeff','aekgjvft1@kuromee.com','$2b$10$.PHAIEGIvVPxyWPupwbANu0n6VCwT7ea2jHT/Alu4P52fwAFg1ROm','Jeff',NULL,'Campos',NULL,'Jeff Campos',NULL,1,0,NULL,NULL,NULL,'2026-10-21 08:44:15','2026-10-21 08:44:15',NULL,0,NULL,NULL,NULL,NULL),(33,2,'Wyncherly','imii5p4zrbg6o0@kuromee.com','$2b$10$LWP1HxVMPei.VycsnG22I.hkmraiGft0xSnI5JAumow68MKQ5ixO2','Wyncherly',NULL,'Delgado',NULL,'Wyncherly Delgado',NULL,1,0,NULL,NULL,NULL,'2026-10-21 08:45:47','2026-10-21 08:45:47',NULL,0,NULL,NULL,NULL,NULL),(34,1,'Arlene','cfcvlqf4f9@kuromee.com','$2b$10$ybLvtBVGOpG8A/nZ7eyW2.PdfO3nUE161xVantGlbE1N.R6sQMxw2','Arlene',NULL,'Jimenez',NULL,'Arlene Jimenez',NULL,1,0,NULL,NULL,NULL,'2026-10-21 08:47:38','2026-10-21 08:47:38',NULL,0,NULL,NULL,NULL,NULL),(37,2,'Jan Faith','fnwfm9b1@kuromee.com','$2b$10$/N9AkxyvfSkI/NTVC2bilebB.XsQQX5sMyADqFXthtPbmRZU8/53G','Jan Faith',NULL,'Mercado',NULL,'Jan Faith Mercado',NULL,1,0,NULL,NULL,NULL,'2026-10-21 08:49:22','2026-10-21 08:49:22',NULL,0,NULL,NULL,NULL,NULL),(38,2,'Nicole','w75idyykzjxg@kuromee.com','$2b$10$tKlKCwpa8Zx8fOu5oaEFR.6Kr2zGEfdhfej5y.aSmAnMrx3n6j3eS','Nicole',NULL,'Cruto',NULL,'Nicole Cruto',NULL,1,0,NULL,NULL,NULL,'2026-10-21 08:50:24','2026-10-21 08:50:24',NULL,0,NULL,NULL,NULL,NULL)
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

-- Keep admin's active email verified
UPDATE `users` SET `email` = 'jairoandreiongcardel@gmail.com' WHERE `user_id` = 1;
UPDATE `members` SET `email` = 'jairoandreiongcardel@gmail.com' WHERE `member_id` = 17;


-- 2. Member Records (Pre-deployment members)
INSERT INTO `members` VALUES (4,4,'Jairo Andrei','Ong','Cardel',NULL,'2005-03-26','Male','Single','+639763256103','jairoandreicardel54@gmail.com','Member',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-08-23 09:35:11','2026-10-21 05:59:30',1),(5,5,'Cedric',NULL,'Nabong',NULL,'2005-04-23','Male','Single',NULL,'nabong123@gmail.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-09-05 11:43:59','2026-10-21 04:46:51',1),(17,1,'System',NULL,'Administrator',NULL,'2005-03-26','Male','Single',NULL,'admin@cogwmphimus.org','Admin',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-20 20:14:49','2026-10-21 04:41:19',1),(18,18,'Joane',NULL,'Bote',NULL,'2000-01-01','Female','Single',NULL,'aqt37fgpbgidltof@multitempmail.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 04:53:44','2026-10-21 09:34:49',1),(19,19,'Ronnie',NULL,'Alterado',NULL,'2002-01-01','Male','Single',NULL,'pm4jjremxl@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 04:54:47','2026-10-21 09:35:17',1),(20,20,'James',NULL,'Manuel',NULL,'2004-01-01','Male','Single',NULL,'ub5mztfeglnd3df@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 05:13:26','2026-10-21 09:35:30',1),(21,21,'Michelle',NULL,'Piedad',NULL,'1981-01-01','Female','Single',NULL,'k6cycf1vy@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 05:56:37','2026-10-21 09:35:57',1),(22,22,'Clyde',NULL,'Manuel',NULL,'2004-01-01','Male','Single',NULL,'du9pnbzse99nlup@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 05:57:27','2026-10-21 09:37:59',1),(23,23,'Amore',NULL,'Delmar',NULL,'2003-01-01','Female','Single',NULL,'wkbeyfj89v2bu@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 05:59:12','2026-10-21 08:58:02',1),(24,24,'Jemimah',NULL,'Johnson',NULL,'2007-01-01','Male','Single',NULL,'a5wej73eht4@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 06:10:18','2026-10-21 09:38:20',1),(25,25,'Melannie',NULL,'Dayao',NULL,'2000-01-01','Female','Single',NULL,'zgnrq2lfyr5e@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 06:11:37','2026-10-21 09:38:30',1),(26,26,'Cedric',NULL,'Cedeño',NULL,'1997-01-01','Male','Single',NULL,'odvc1efpa7c@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 06:12:34','2026-10-21 09:38:53',1),(27,27,'Ghie',NULL,'Abergos',NULL,'1993-01-01','Female','Single',NULL,'satkgvzewxjiw2@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 06:13:34','2026-10-21 11:42:17',1),(28,28,'Valentino',NULL,'Flores',NULL,'2021-01-01','Male','Married',NULL,'pz6fcsfsk@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 06:14:36','2026-10-21 09:02:53',1),(29,29,'Mark',NULL,'San Juan',NULL,'2002-01-01','Male','Single',NULL,'jfyyjhm4p@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 06:16:42','2026-10-21 09:39:07',1),(30,30,'Homer',NULL,'Delgado',NULL,'1981-01-01','Male','Married',NULL,'jnrvshgvb@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 08:40:38','2026-10-21 09:39:28',1),(31,31,'Ralph',NULL,'Francisco',NULL,'2004-01-01','Male','Single',NULL,'foqp4fdhfzlb5@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 08:42:21','2026-10-21 09:39:17',1),(32,32,'Jeff',NULL,'Campos',NULL,'2007-01-01','Male','Single',NULL,'aekgjvft1@kuromee.com','Leader',NULL,NULL,0,NULL,NULL,NULL,NULL,'Active','2026-10-21 08:44:15','2026-10-21 09:39:44',1),(33,33,'Wyncherly',NULL,'Delgado',NULL,'1981-01-01','Female','Married',NULL,'imii5p4zrbg6o0@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 08:45:47','2026-10-21 09:39:55',1),(34,34,'Arlene',NULL,'Jimenez',NULL,'1977-01-01','Female','Married',NULL,'cfcvlqf4f9@kuromee.com','Admin',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 08:47:38','2026-10-21 09:40:05',1),(35,37,'Jan Faith',NULL,'Mercado',NULL,'1998-01-01','Male','Married',NULL,'fnwfm9b1@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 08:49:22','2026-10-21 09:40:21',1),(36,38,'Nicole',NULL,'Cruto',NULL,'2004-01-01','Female','Single',NULL,'w75idyykzjxg@kuromee.com','Leader',NULL,NULL,0,NULL,'2026-10-21',NULL,NULL,'Active','2026-10-21 08:50:24','2026-10-21 09:40:29',1);
ON DUPLICATE KEY UPDATE `first_name` = VALUES(`first_name`), `last_name` = VALUES(`last_name`);

-- 3. WORDA Departments & Ministries
INSERT INTO `ministries` VALUES (5,'Musicians','WORSHIP - MUSIC','Worship',NULL,19,'Mondays, 1:00 pm','#3b82f6',1,'2026-09-03 15:44:05','2026-10-21 10:13:47'),(10,'Youth','RELATIONSHIP - YOUTH','Relationship',NULL,29,'Mondays 6:03 AM','#f59e0b',1,'2026-10-01 15:38:06','2026-10-21 10:58:28'),(11,'Dancers','WORSHIP - DANCE','Worship',NULL,22,'Mondays 6:00 AM','#3b82f6',1,'2026-10-21 10:17:44','2026-10-21 10:17:44'),(12,'Singers','WORSHIP - SING','Worship',NULL,25,'Mondays 6:00 PM','#3b82f6',1,'2026-10-21 10:21:46','2026-10-21 10:21:46'),(13,'Kabataan Iwas Droga (KID)','OUTREACH - KID','Outreach',NULL,29,'Sundays 6:00 AM','#10b981',1,'2026-10-21 10:24:58','2026-10-21 10:25:35'),(14,'Arts & Technology','ADMIN - ARTS AND TEC','Administration',NULL,35,'Sundays 6:00 PM','#64748b',1,'2026-10-21 10:33:16','2026-10-21 10:33:16');
ON DUPLICATE KEY UPDATE `ministry_name` = VALUES(`ministry_name`);

INSERT INTO `department_heads` VALUES (1,'Worship',18,'2026-10-21 10:13:02'),(2,'Outreach',28,'2026-10-21 10:23:46'),(3,'Relationship',30,'2026-10-21 10:27:16'),(4,'Discipleship',33,'2026-10-21 10:30:44'),(5,'Administration',34,'2026-10-21 10:11:18');
ON DUPLICATE KEY UPDATE `department` = VALUES(`department`);

INSERT INTO `ministry_members` VALUES (275,10,4,'Member','2026-10-21','Active','2026-10-21 09:50:06','2026-10-21 09:51:01'),(295,5,19,'Musicians Ministry Head','2026-10-21','Active','2026-10-21 10:13:47','2026-10-21 10:14:22'),(300,5,20,'Musicians Asst. Ministry Head','2026-10-21','Active','2026-10-21 10:14:31','2026-10-21 10:14:45'),(304,5,21,'Musicians Core Leader','2026-10-21','Active','2026-10-21 10:15:01','2026-10-21 10:15:01'),(311,11,22,'Dancers Ministry Head','2026-10-21','Active','2026-10-21 10:17:51','2026-10-21 10:18:09'),(315,11,23,'Dancers Asst. Ministry Head','2026-10-21','Active','2026-10-21 10:19:48','2026-10-21 10:19:48'),(318,11,24,'Dancers Core Leader','2026-10-21','Active','2026-10-21 10:20:17','2026-10-21 10:20:17'),(322,12,25,'Singers Ministry Head','2026-10-21','Active','2026-10-21 10:21:49','2026-10-21 13:52:44'),(323,12,26,'Singers Asst. Ministry Head','2026-10-21','Active','2026-10-21 10:22:05','2026-10-21 10:22:05'),(325,12,27,'Core Leader','2026-10-21','Active','2026-10-21 10:22:21','2026-10-21 10:22:21'),(330,13,29,'Kabataan Iwas Droga (KID) Ministry Head','2026-10-21','Active','2026-10-21 10:25:28','2026-10-21 10:25:58'),(335,13,31,'Kabataan Iwas Droga (KID) Asst. Ministry Head','2026-10-21','Active','2026-10-21 10:26:15','2026-10-21 10:26:15'),(338,10,29,'Youth Ministry Head','2026-10-21','Active','2026-10-21 10:28:21','2026-10-21 10:58:52'),(342,10,31,'Youth Asst. Ministry Head','2026-10-21','Active','2026-10-21 10:29:31','2026-10-21 10:29:31'),(344,10,32,'Youth Core Leader','2026-10-21','Active','2026-10-21 10:29:48','2026-10-21 10:29:48'),(350,14,35,'Arts & Technology Ministry Head','2026-10-21','Active','2026-10-21 10:33:17','2026-10-21 10:33:20'),(353,14,36,'Arts & Technology Core Leader','2026-10-21','Active','2026-10-21 10:33:31','2026-10-21 10:33:31'),(391,12,4,'Singer','2026-10-21','Active','2026-10-21 11:02:14','2026-10-21 11:04:08');
ON DUPLICATE KEY UPDATE `role_in_ministry` = VALUES(`role_in_ministry`);

-- C2S Cell Groups & Members
INSERT INTO `c2s_groups` VALUES (1,'C2S Grace & Truth Discipleship',5,'Wednesday','7:00 ','Sanctuary Room 101','Faith Foundation and Discipleship Cell Group','Active','2026-10-15 15:37:02','2026-10-16 16:09:27'),(2,'C2S Youth Alive Impact',19,'Friday','7:30 ','Fellowship Hall - West Wing','Youth & Young Professionals C2S Group','Active','2026-10-15 15:37:02','2026-10-16 14:46:58');
ON DUPLICATE KEY UPDATE `group_name` = VALUES(`group_name`), `leader_id` = VALUES(`leader_id`);

INSERT INTO `c2s_group_members` VALUES (3,1,19,'Mentee in training','2026-10-15','2026-10-15 15:37:02');
ON DUPLICATE KEY UPDATE `notes` = VALUES(`notes`), `member_id` = VALUES(`member_id`);

-- Ministry Attendance Sessions & Records
INSERT INTO `ministry_attendance` VALUES (1,5,'Sunday Worship Rehearsal','2026-09-27','Rehearsal',5,'Soundcheck and praise lineup practice','2026-10-18 14:35:04','2026-10-18 14:35:04'),(2,5,'Midweek Team Fellowship','2026-10-04','Meeting',5,'Devotion and music ministry planning','2026-10-18 14:35:04','2026-10-18 14:35:04'),(3,5,'Sunday Service Music Duty','2026-10-11','Service Duty',5,'Main sanctuary worship service','2026-10-18 14:35:04','2026-10-18 14:35:04'),(4,5,'Vocals & Band Tech Rehearsal','2026-10-17','Rehearsal',5,'Acoustic and monitor setup','2026-10-18 14:35:04','2026-10-18 14:35:04'),(5,10,'Sunday School Teachers Prep','2026-09-27','Training',4,'Curriculum review for Sunday classes','2026-10-18 14:35:04','2026-10-18 14:35:04'),(6,10,'Children Ministry Sunday Service','2026-10-04','Service Duty',4,'Kids church classes and worship','2026-10-18 14:35:04','2026-10-18 14:35:04'),(7,10,'Department Coordination Meeting','2026-10-11','Meeting',4,'Relationship department updates','2026-10-18 14:35:04','2026-10-18 14:35:04');
ON DUPLICATE KEY UPDATE `session_title` = VALUES(`session_title`);

INSERT INTO `ministry_attendance_records` VALUES (1,1,5,'Present','On time','2026-10-18 14:35:04','2026-10-18 14:35:04'),(3,2,5,'Present','On time','2026-10-18 14:35:04','2026-10-18 14:35:04'),(5,3,5,'Present','On time','2026-10-18 14:35:04','2026-10-18 14:35:04'),(7,4,5,'Present','On time','2026-10-18 14:35:04','2026-10-18 14:35:04'),(9,5,4,'Present','Led session','2026-10-18 14:35:04','2026-10-18 14:35:04'),(12,6,4,'Present','Led session','2026-10-18 14:35:04','2026-10-18 14:35:04'),(15,7,4,'Present','Led session','2026-10-18 14:35:04','2026-10-18 14:35:04');
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 4. Finance Modules: Categories & Transactions
INSERT INTO `finance_categories` VALUES (1,'Tithes','Income','Regular tithes from members','2026-08-22 23:48:05'),(2,'Offerings','Income','General church offerings','2026-08-22 23:48:05'),(3,'Special Offering','Income','Special event offerings','2026-08-22 23:48:05'),(4,'Donations','Income','External donations','2026-08-22 23:48:05'),(5,'Missions Fund','Income','Fundraising for missions','2026-08-22 23:48:05'),(6,'Utility Bills','Expense','Electricity, water, internet','2026-08-22 23:48:05'),(7,'Salaries','Expense','Pastoral and staff salaries','2026-08-22 23:48:05'),(8,'Maintenance','Expense','Building and equipment maintenance','2026-08-22 23:48:05'),(9,'Office Supplies','Expense','Administrative supplies','2026-08-22 23:48:05'),(10,'Events','Expense','Event and activity expenses','2026-08-22 23:48:05'),(11,'Seminary Operations','Expense','Seminary and training expenses','2026-08-22 23:48:05');
ON DUPLICATE KEY UPDATE `category_name` = VALUES(`category_name`);

INSERT INTO `finance_transactions` VALUES (2,4,NULL,NULL,NULL,'Income',1000000.00,'2026-08-23',NULL,'21221',1,NULL,'2026-08-23 09:31:30','2026-08-23 09:31:30'),(3,10,NULL,NULL,NULL,'Expense',10000000.00,'2026-08-23',NULL,'21221',1,NULL,'2026-08-23 09:32:01','2026-08-23 09:32:29'),(4,4,NULL,NULL,NULL,'Income',111100000.00,'2026-08-24',NULL,'21221',1,NULL,'2026-08-23 09:32:49','2026-09-25 00:18:37'),(5,7,NULL,NULL,NULL,'Expense',2950000.00,'2026-08-24','hhh',NULL,1,NULL,'2026-08-24 01:53:33','2026-09-07 03:09:05'),(6,4,NULL,'Administration',NULL,'Income',10000.00,'2026-09-24',NULL,NULL,1,NULL,'2026-09-24 21:04:22','2026-10-09 02:48:32'),(7,10,NULL,NULL,NULL,'Expense',20000.00,'2026-09-24',NULL,NULL,1,NULL,'2026-09-24 21:04:41','2026-09-24 21:05:30');
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`);

-- 5. Content Management & Live Broadcast
INSERT INTO `content_pages` (`page_key`, `title`, `body`, `is_published`, `updated_by`) VALUES
('church_history', 'Our Church History', '', 1, 1),
('mission_vision', 'Mission and Vision', '', 1, 1),
('contact_info', 'Contact Information', '', 1, 1),
('auth_page', 'Login & Authentication Page Content', '{"inspiration":{"kicker":"Church of God World Missions","title_line1":"A Place to Belong,","title_line2":"A Faith to Believe.","title":"A Place to Belong, <em>A Faith to Believe.</em>","description":"Welcome to the COG Imus Ministry Portal. Secure, unified access for our church administrators, ministry leaders, and faithful congregation.","scripture_verse":"For where two or three gather in My name, there am I with them.","scripture_reference":"Matthew 18:20 • Fellowship in Christ","trust_pillar_1":"End-to-End Secure SSL Session","trust_pillar_2":"Dedicated Admin, Leader & Member Portals"}}', 1, 1)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `body` = VALUES(`body`);

INSERT INTO `livestream_broadcast` (`id`, `title`, `description`, `preacher`, `platform`, `stream_url`, `is_live`) VALUES
(1, 'Sunday Worship Service - Holy Communion', 'Live streaming worship service from COGWM Imus Sanctuary.', 'Bishop Juan Dela Cruz', 'Facebook Live', 'https://www.facebook.com/jairocardel/videos/1454315356844038/', 0)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

SET FOREIGN_KEY_CHECKS = 1;
