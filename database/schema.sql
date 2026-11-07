-- =====================================================================
-- SmartDB: Smart Database Normalization and Migration System
-- System Metadata Catalog Schema (smartdb_system)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `smartdb_system` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `smartdb_system`;

-- 1. Datasets Catalog: Tracks every uploaded CSV or Excel file
CREATE TABLE IF NOT EXISTS `datasets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_code` VARCHAR(50) NOT NULL UNIQUE,
    `original_name` VARCHAR(255) NOT NULL,
    `stored_filename` VARCHAR(255) NOT NULL,
    `file_type` ENUM('csv', 'xlsx', 'xls') NOT NULL,
    `file_size_bytes` BIGINT NOT NULL,
    `row_count` INT DEFAULT 0,
    `column_count` INT DEFAULT 0,
    `status` ENUM('uploaded', 'analyzed', 'normalized', 'migrated', 'error') DEFAULT 'uploaded',
    `target_database` VARCHAR(100) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Dataset Columns: Stores column-level profile metrics
CREATE TABLE IF NOT EXISTS `dataset_columns` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `column_index` INT NOT NULL,
    `column_name` VARCHAR(100) NOT NULL,
    `sanitized_name` VARCHAR(100) NOT NULL,
    `detected_type` VARCHAR(50) NOT NULL,
    `null_count` INT DEFAULT 0,
    `unique_count` INT DEFAULT 0,
    `is_candidate_key` BOOLEAN DEFAULT FALSE,
    `sample_values` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Functional Dependencies: Stores detected and user-confirmed dependencies
CREATE TABLE IF NOT EXISTS `functional_dependencies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `determinant` JSON NOT NULL COMMENT 'Array of determinant column names, e.g. ["student_id"]',
    `dependent` JSON NOT NULL COMMENT 'Array of dependent column names, e.g. ["student_name", "department_id"]',
    `determinism_ratio` DECIMAL(5, 4) DEFAULT 1.0000 COMMENT '1.0 indicates perfect functional dependency in sample',
    `is_confirmed` BOOLEAN DEFAULT FALSE,
    `dependency_type` ENUM('full', 'partial', 'transitive', 'candidate_key') DEFAULT 'full',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Normalization Runs: Tracks user normalization operations
CREATE TABLE IF NOT EXISTS `normalization_runs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `target_database_name` VARCHAR(100) NOT NULL,
    `normal_form_target` ENUM('1NF', '2NF', '3NF') DEFAULT '3NF',
    `status` ENUM('draft', 'schema_generated', 'migrated', 'failed') DEFAULT 'draft',
    `table_count` INT DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `completed_at` TIMESTAMP NULL,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Generated Tables: Metadata for normalized tables
CREATE TABLE IF NOT EXISTS `generated_tables` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `normalization_run_id` INT NOT NULL,
    `table_name` VARCHAR(100) NOT NULL,
    `original_table_name` VARCHAR(100) NULL,
    `primary_keys` JSON NOT NULL COMMENT 'Array of primary key column names',
    `row_count` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`normalization_run_id`) REFERENCES `normalization_runs`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Generated Columns: Detailed metadata per column in generated tables
CREATE TABLE IF NOT EXISTS `generated_columns` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `generated_table_id` INT NOT NULL,
    `column_name` VARCHAR(100) NOT NULL,
    `data_type` VARCHAR(50) NOT NULL,
    `is_primary_key` BOOLEAN DEFAULT FALSE,
    `is_foreign_key` BOOLEAN DEFAULT FALSE,
    `foreign_table` VARCHAR(100) NULL,
    `foreign_column` VARCHAR(100) NULL,
    `is_nullable` BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (`generated_table_id`) REFERENCES `generated_tables`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Relationships: Explicit foreign key associations between generated tables
CREATE TABLE IF NOT EXISTS `relationships` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `normalization_run_id` INT NOT NULL,
    `parent_table` VARCHAR(100) NOT NULL,
    `child_table` VARCHAR(100) NOT NULL,
    `parent_column` VARCHAR(100) NOT NULL,
    `child_column` VARCHAR(100) NOT NULL,
    `relationship_type` ENUM('1:N', '1:1', 'N:M') DEFAULT '1:N',
    FOREIGN KEY (`normalization_run_id`) REFERENCES `normalization_runs`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Migration Logs: Audit trail for physical database and table creation
CREATE TABLE IF NOT EXISTS `migration_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `normalization_run_id` INT NULL,
    `stage` VARCHAR(50) NOT NULL,
    `status` ENUM('pending', 'in_progress', 'completed', 'error') NOT NULL,
    `message` TEXT NOT NULL,
    `sql_executed` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

