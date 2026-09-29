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
- 账号: `admin` （默认 **超级管理员**）
- 密码: `123456`

## 👥 多管理员与权限（RBAC）

| 能力 | 超级管理员 (super) | 普通管理员 (normal) |
|---|---|---|
| 维护授权记录（列表/新增/删除） | ✅ | ✅ |
| 新增普通管理员 | ✅ | ❌ |
| 重置管理员密码 | ✅ | ❌ |
| 停用 / 启用管理员账号 | ✅ | ❌ |
| 查看管理员列表、登录日志 | ✅ | ❌ |

- 新增的管理员一律为**普通管理员**（后端忽略前端传入的 role，无法越权提权）。
- 权限**不是只在前端隐藏菜单**：所有受保护 PHP 接口都会校验 `Authorization: Bearer <token>`，
  未登录返回 `401`，普通管理员访问超管接口返回 `403`。
- 每个受保护请求都会回查数据库，账号被**停用后其登录态立即失效**。
- 超级管理员不能停用自己，且系统至少保留一个启用中的超级管理员。

### 登录日志
登录（成功/失败）都会写入 `login_logs` 表，记录 **账号、时间、IP**（另含 UA、成功与否），
超级管理员可在「后台管理 → 登录日志」查看。真实 IP 取自反代下发的 `X-Real-IP`。

### Token 密钥
后端使用 HMAC-SHA256 签名 token（有效期 2 小时）。生产环境请在环境变量中设置
`AUTH_TOKEN_SECRET` 为随机长字符串（`docker-compose.yml` 已通过 `.env` / 默认值注入）。

### 存量数据库升级（重要）
`db/init.sql` 只在 MySQL 数据卷**首次初始化**时执行。若你之前已启动过旧版本，
现有库不会自动加字段，请执行一次幂等迁移脚本：

```bash
docker exec -i auth_db mysql -uroot -proot auth_system < db/migrations/2026_09_29_rbac_and_login_logs.sql
```

它会为 `admins` 增加 `role` / `is_active` 字段、把 `admin` 提升为超管，并创建 `login_logs` 表。

## 🔌 后台接口权限一览

| 接口 | 方法 | 权限 |
|---|---|---|
| `/api/auth/login` | POST | 公开 |
| `/api/auth/me` | GET | 登录 |
| `/api/license/query`、`/api/license/send-code`、`/api/license/update` | POST/GET | 公开 |
| `/api/license/list`、`/api/license/create`、`/api/license/delete` | GET/POST | 登录（普通+超管） |
| `/api/auth/list`、`/api/auth/create`、`/api/auth/reset-password`、`/api/auth/set-active`、`/api/auth/login-logs` | GET/POST | **仅超级管理员** |

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
