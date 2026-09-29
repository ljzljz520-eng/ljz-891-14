SET NAMES utf8mb4;
SET TIME_ZONE = '+08:00';

CREATE DATABASE IF NOT EXISTS auth_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auth_system;

-- Admins Table
-- role: 'super' = 超级管理员(可管理管理员账号), 'normal' = 普通管理员(只能维护授权记录)
-- is_active: 1 = 启用, 0 = 停用
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('super', 'normal') NOT NULL DEFAULT 'normal',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Login Logs Table (登录日志: 账号 / 时间 / IP)
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

-- Licenses Table
CREATE TABLE IF NOT EXISTS licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    qq VARCHAR(20) NOT NULL,
    owner_name VARCHAR(50) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    upline VARCHAR(50) NOT NULL COMMENT '上级代理',
    expiration_date DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_qq (qq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification Codes (for updates)
CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'update_license'
    identifier VARCHAR(100) NOT NULL, -- QQ email
    code VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Data (Test Accounts)
-- Password is '123456' hashed with BCRYPT (Cost 10)
-- 默认 admin 为超级管理员；新增加的管理员默认为普通管理员
INSERT INTO admins (username, password, role, is_active) VALUES
('admin', '$2y$10$eLYd0HGc9JM0qxzPkpLtDuL1UZRAS6XAwgVNO7oL9R0M/f/6bkEcW', 'super', 1);

-- Seed Data (Sample Licenses)
INSERT INTO licenses (qq, owner_name, product_name, upline, expiration_date) VALUES 
('123456789', '张三', '超级授权系统VIP版', '总代理', '2026-12-31 23:59:59'),
('987654321', '李四', '企业级管理后台', '核心代理', '2025-06-30 23:59:59'),
('11111', '王五', '测试过期产品', '测试员', '2023-01-01 00:00:00'); -- Expired
