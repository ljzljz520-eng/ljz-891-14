# 星罗授权管理系统 (AuthQuery System)

## 🛠 技术栈
- Frontend: React + Vite + Tailwind CSS (Glassmorphism / Tech Blue)
- Backend: PHP 8.2 + Apache (MVC + PHPMailer)
- Database: MySQL 8.0

## 🚀 启动指南
1. 确保 Docker Desktop 已启动。
2. 在根目录执行：`docker compose up --build`
3. 访问: http://localhost:3891

## 🔗 服务说明
- **前端页面**: http://localhost:3891
- **API 接口**: http://localhost:8891
- **Mysql**: localhost:18891 (root/root)

## 🧪 管理员账号
- 登录地址: `/admin`
- 超级管理员: `admin` / `123456`（可新增管理员、重置密码、停用账号、查看登录日志）
- 普通管理员: `operator` / `123456`（仅可维护授权记录）

## 🔐 多管理员与权限
- **角色**：`super_admin`（超级管理员）/ `admin`（普通管理员），存于 `admins.role`；`admins.is_active` 控制启用/停用。
- **鉴权**：登录返回 HMAC-SHA256 签名的 Token（8 小时有效）。前端通过 `Authorization: Bearer <token>` 携带；后端每个受保护接口都在 PHP 侧强制校验（不只靠前端隐藏按钮），每次请求回查账号状态，停用即时生效。
- **权限矩阵**：
  - 授权记录的增/删/列表：任意已登录管理员
  - 新增管理员 / 重置密码 / 启停账号 / 查看登录日志 / 管理员列表：仅超级管理员
  - 新增账号固定为普通管理员（忽略前端传入的 role）；不可停用自己或其他超级管理员
- **登录日志**：`login_logs` 表记录账号、登录时间、IP（另含成功与否/失败原因），成功与失败尝试都会记录。
- 生产环境请通过环境变量 `JWT_SECRET` 覆盖默认签名密钥。

## ✨ 核心功能
1. **正版查询**: 动态极光背景，支持 QQ/主人 双重验证。
2. **自助更绑**: 集成 PHPMailer 发送真实 QQ 邮件验证码 (SMTP: yuwangifeng@163.com)。
   - 若发送失败，请在 `docker logs auth_backend` 查看 SMTP 错误日志。
3. **后台管理**: 
   - 现代化表格设计 (头像/状态徽章)。
   - 自定义玻璃拟态弹窗 (Modal) 代替原生 Alert。
   - 完备的 CRUD 功能。

## 📝 交付文档
- `SELF_TEST.md`: 完整的自测报告与架构说明。
