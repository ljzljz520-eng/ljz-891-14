-- ============================================================================
-- 迁移: 多管理员角色权限 + 登录日志
-- 适用于已存在的 auth_system 数据库（全新部署会自动执行 db/init.sql，无需此脚本）
--
-- 执行方式:
--   docker exec -i auth_db mysql -uroot -proot auth_system < db/migrations/2026_09_29_rbac_and_login_logs.sql
-- ============================================================================

USE auth_system;

-- 1) admins 增加角色与状态字段（幂等：已存在则跳过）
SET @s := (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'auth_system' AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'role') = 0,
    'ALTER TABLE admins ADD COLUMN role ENUM(''super'',''normal'') NOT NULL DEFAULT ''normal'' AFTER password',
    'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s := (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'auth_system' AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'is_active') = 0,
    'ALTER TABLE admins ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role',
    'SELECT 1'
));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) 现有 admin 账号提升为超级管理员
UPDATE admins SET role = 'super' WHERE username = 'admin' AND role = 'normal';

-- 3) 登录日志表
CREATE TABLE IF NOT EXISTS login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL COMMENT '登录账号(登录失败时记录尝试的账号)',
    success TINYINT(1) NOT NULL COMMENT '1=成功 0=失败',
    ip VARCHAR(45) NOT NULL COMMENT 'IPv4/IPv6',
    user_agent VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
