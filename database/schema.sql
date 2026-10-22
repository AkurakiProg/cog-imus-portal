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

INSERT INTO `users` (`user_id`, `role_id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `full_name`, `is_active`, `is_verified`) VALUES
(1, 1, 'admin', 'admin@cogwmphimus.org', '$2b$12$1ZtYrUk9iEpWlWBbLiq9j.o8DE8H8BohInCTYA07QdX3Rcl2ddOSe', 'System', 'Administrator', 'System Administrator', 1, 1)
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

INSERT INTO `content_pages` (`page_key`, `title`, `body`, `is_published`, `updated_by`) VALUES
('church_history', 'Our Church History', '', 1, 1),
('mission_vision', 'Mission and Vision', '', 1, 1),
('contact_info', 'Contact Information', '', 1, 1)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`), `body` = VALUES(`body`);

INSERT INTO `finance_categories` (`category_id`, `category_name`, `category_type`, `description`) VALUES
(1, 'Tithes', 'Income', 'Regular tithes from members'),
(2, 'Offerings', 'Income', 'General church offerings'),
(3, 'Special Offering', 'Income', 'Special event offerings'),
(4, 'Donations', 'Income', 'External donations'),
(5, 'Missions Fund', 'Income', 'Fundraising for missions'),
(6, 'Utility Bills', 'Expense', 'Electricity, water, internet'),
(7, 'Salaries', 'Expense', 'Pastoral and staff salaries'),
(8, 'Maintenance', 'Expense', 'Building and equipment maintenance'),
(9, 'Office Supplies', 'Expense', 'Administrative supplies'),
(10, 'Events', 'Expense', 'Event and activity expenses'),
(11, 'Seminary Operations', 'Expense', 'Seminary and training expenses')
ON DUPLICATE KEY UPDATE `category_name` = VALUES(`category_name`);

INSERT INTO `livestream_broadcast` (`id`, `title`, `description`, `preacher`, `platform`, `stream_url`, `is_live`) VALUES
(1, 'Sunday Worship Service - Holy Communion', 'Live streaming worship service from COGWM Imus Sanctuary.', 'Bishop Juan Dela Cruz', 'Facebook Live', 'https://www.facebook.com/jairocardel/videos/1454315356844038/', 0)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

INSERT INTO `department_heads` (`department`) VALUES
('Worship'),
('Outreach'),
('Relationship'),
('Discipleship'),
('Administration')
ON DUPLICATE KEY UPDATE `department` = VALUES(`department`);

SET FOREIGN_KEY_CHECKS = 1;
