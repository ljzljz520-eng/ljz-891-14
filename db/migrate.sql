-- 幂等迁移：用于已存在数据卷的旧库升级（新库由 init.sql 直接建表，无需执行）
USE auth_system;

-- 普通管理员缺少 role / is_active 列时补齐
SET @s := (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='auth_system' AND TABLE_NAME='admins' AND COLUMN_NAME='role') = 0,
    "ALTER TABLE admins ADD COLUMN role ENUM('super_admin','admin') NOT NULL DEFAULT 'admin' AFTER password",
    'SELECT 1'));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s := (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='auth_system' AND TABLE_NAME='admins' AND COLUMN_NAME='is_active') = 0,
    "ALTER TABLE admins ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER role",
    'SELECT 1'));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 旧账号提升为超级管理员（仅当还没有任何超级管理员时）
UPDATE admins SET role = 'super_admin' WHERE id = (SELECT min_id FROM (SELECT MIN(id) AS min_id FROM admins) t)
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM admins WHERE role = 'super_admin') x);

-- 登录日志表（已存在则跳过）
CREATE TABLE IF NOT EXISTS login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL COMMENT '登录账号',
    ip VARCHAR(45) DEFAULT NULL COMMENT '登录IP(兼容IPv6)',
    success BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否登录成功',
    fail_reason VARCHAR(100) DEFAULT NULL COMMENT '失败原因',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
    INDEX idx_username (username),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
