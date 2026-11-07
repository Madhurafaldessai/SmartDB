-- =====================================================================
-- SmartDB: Smart Database Normalization and Migration System
-- System Metadata Catalog Schema (smartdb_system) - Normalized to 3NF
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `smartdb_system` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `smartdb_system`;

-- 1. Datasets Catalog: Master record of uploaded tabular files
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
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_datasets_status` (`status`),
    INDEX `idx_datasets_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Dataset Columns: Metadata & scalar profiling metrics per column
CREATE TABLE IF NOT EXISTS `dataset_columns` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `column_index` INT NOT NULL,
    `column_name` VARCHAR(100) NOT NULL,
    `sanitized_name` VARCHAR(100) NOT NULL,
    `detected_type` VARCHAR(50) NOT NULL,
    `null_count` INT DEFAULT 0,
    `unique_count` INT DEFAULT 0,
    `sample_values` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_dataset_col_index` (`dataset_id`, `column_index`),
    INDEX `idx_dataset_columns_sanitized` (`sanitized_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Candidate Keys: Discovered minimal superkeys (3NF Entity)
CREATE TABLE IF NOT EXISTS `candidate_keys` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `key_name` VARCHAR(100) NOT NULL,
    `is_selected_primary` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE,
    INDEX `idx_candidate_keys_dataset` (`dataset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Candidate Key Attributes: Junction table resolving composite candidate keys (1NF/3NF compliant)
CREATE TABLE IF NOT EXISTS `candidate_key_attributes` (
    `candidate_key_id` INT NOT NULL,
    `column_id` INT NOT NULL,
    PRIMARY KEY (`candidate_key_id`, `column_id`),
    FOREIGN KEY (`candidate_key_id`) REFERENCES `candidate_keys`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`column_id`) REFERENCES `dataset_columns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Functional Dependencies: Discovered & confirmed dependency business rules (3NF Entity)
CREATE TABLE IF NOT EXISTS `functional_dependencies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `determinism_ratio` DECIMAL(5, 4) DEFAULT 1.0000 COMMENT '1.0 indicates 100% confidence',
    `violation_count` INT DEFAULT 0,
    `violation_rate` DECIMAL(5, 2) DEFAULT 0.00,
    `is_confirmed` BOOLEAN DEFAULT FALSE,
    `dependency_type` ENUM('full', 'partial', 'transitive', 'candidate_key') DEFAULT 'full',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE,
    INDEX `idx_fd_dataset_confirmed` (`dataset_id`, `is_confirmed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. FD Determinants: Left-Hand Side (LHS) attributes of an FD (1NF/3NF junction table)
CREATE TABLE IF NOT EXISTS `fd_determinants` (
    `fd_id` INT NOT NULL,
    `column_id` INT NOT NULL,
    PRIMARY KEY (`fd_id`, `column_id`),
    FOREIGN KEY (`fd_id`) REFERENCES `functional_dependencies`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`column_id`) REFERENCES `dataset_columns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. FD Dependents: Right-Hand Side (RHS) attributes of an FD (1NF/3NF junction table)
CREATE TABLE IF NOT EXISTS `fd_dependents` (
    `fd_id` INT NOT NULL,
    `column_id` INT NOT NULL,
    PRIMARY KEY (`fd_id`, `column_id`),
    FOREIGN KEY (`fd_id`) REFERENCES `functional_dependencies`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`column_id`) REFERENCES `dataset_columns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Normalization Runs: Tracks user normalization sessions
CREATE TABLE IF NOT EXISTS `normalization_runs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `target_database_name` VARCHAR(100) NOT NULL,
    `normal_form_target` ENUM('1NF', '2NF', '3NF', 'BCNF') DEFAULT '3NF',
    `lossless_join_verified` BOOLEAN DEFAULT TRUE,
    `dependency_preservation_score` DECIMAL(5, 2) DEFAULT 100.00,
    `status` ENUM('draft', 'schema_generated', 'migrated', 'failed') DEFAULT 'draft',
    `table_count` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `completed_at` TIMESTAMP NULL,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE,
    INDEX `idx_norm_runs_dataset` (`dataset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Normalization Steps: Academic audit trail (1NF, 2NF, 3NF synthesis steps)
CREATE TABLE IF NOT EXISTS `normalization_steps` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `normalization_run_id` INT NOT NULL,
    `stage` VARCHAR(50) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `passed` BOOLEAN NOT NULL,
    `explanation` TEXT NOT NULL,
    FOREIGN KEY (`normalization_run_id`) REFERENCES `normalization_runs`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Generated Tables: Synthesized normalized tables
CREATE TABLE IF NOT EXISTS `generated_tables` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `normalization_run_id` INT NOT NULL,
    `table_name` VARCHAR(100) NOT NULL,
    `original_table_name` VARCHAR(100) NULL,
    `row_count` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`normalization_run_id`) REFERENCES `normalization_runs`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_norm_table_name` (`normalization_run_id`, `table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Generated Columns: Precise metadata per column in generated tables
CREATE TABLE IF NOT EXISTS `generated_columns` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `generated_table_id` INT NOT NULL,
    `column_name` VARCHAR(100) NOT NULL,
    `data_type` VARCHAR(50) NOT NULL,
    `is_primary_key` BOOLEAN DEFAULT FALSE,
    `is_foreign_key` BOOLEAN DEFAULT FALSE,
    `is_nullable` BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (`generated_table_id`) REFERENCES `generated_tables`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_table_column` (`generated_table_id`, `column_name`),
    INDEX `idx_gen_cols_pk` (`is_primary_key`),
    INDEX `idx_gen_cols_fk` (`is_foreign_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Relationships: Enforces referential integrity between generated tables
CREATE TABLE IF NOT EXISTS `relationships` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `normalization_run_id` INT NOT NULL,
    `parent_table_id` INT NOT NULL,
    `child_table_id` INT NOT NULL,
    `parent_column_name` VARCHAR(100) NOT NULL,
    `child_column_name` VARCHAR(100) NOT NULL,
    `relationship_type` ENUM('1:N', '1:1', 'N:M') DEFAULT '1:N',
    FOREIGN KEY (`normalization_run_id`) REFERENCES `normalization_runs`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`parent_table_id`) REFERENCES `generated_tables`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`child_table_id`) REFERENCES `generated_tables`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Migration Logs: Sequential audit trail of physical DDL & DML operations
CREATE TABLE IF NOT EXISTS `migration_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dataset_id` INT NOT NULL,
    `stage` VARCHAR(50) NOT NULL,
    `status` ENUM('pending', 'in_progress', 'completed', 'error') NOT NULL,
    `message` TEXT NOT NULL,
    `sql_executed` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON DELETE CASCADE,
    INDEX `idx_migration_logs_dataset` (`dataset_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
