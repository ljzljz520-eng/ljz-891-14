<?php
namespace Controllers;

use PDO;
use Services\Auth;

class AuthController {
    private $db;
    private $auth;

    public function __construct($db) {
        $this->db = $db;
        $this->auth = new Auth($db);
    }

    /**
     * 登录：校验密码 + 账号状态，记录登录日志（账号 / 时间 / IP）。
     */
    public function login() {
        $data = json_decode(file_get_contents("php://input")) ?: new \stdClass();
        $username = trim($data->username ?? '');
        $password = $data->password ?? '';

        if ($username === '' || $password === '') {
            http_response_code(400);
            echo json_encode(["message" => "请输入账号和密码"]);
            return;
        }

        $stmt = $this->db->prepare(
            "SELECT id, username, password, role, is_active FROM admins WHERE username = :username LIMIT 1"
        );
        $stmt->bindParam(":username", $username);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        // 统一处理失败：用户不存在 / 密码错误 / 已停用，避免账号枚举差异
        if (!$row || !password_verify($password, $row['password'])) {
            $this->writeLog($username, 0);
            http_response_code(401);
            echo json_encode(["message" => "账号或密码错误"]);
            return;
        }

        if ((int)$row['is_active'] !== 1) {
            $this->writeLog($username, 0);
            http_response_code(403);
            echo json_encode(["message" => "该账号已被停用，请联系超级管理员"]);
            return;
        }

        $this->writeLog($username, 1);

        http_response_code(200);
        echo json_encode([
            "message" => "Login successful",
            "token"   => $this->auth->issueToken((int)$row['id']),
            "user"    => [
                "id"       => (int)$row['id'],
                "username" => $row['username'],
                "role"     => $row['role'],
            ],
        ]);
    }

    /**
     * 当前登录用户信息（前端用于决定界面）
     */
    public function me() {
        $admin = $this->auth->requireLogin();
        if ($admin === null) return;
        echo json_encode([
            "id"       => (int)$admin['id'],
            "username" => $admin['username'],
            "role"     => $admin['role'],
        ]);
    }

    /**
     * 管理员列表 —— 仅超级管理员
     */
    public function list() {
        if ($this->auth->requireSuper() === null) return;

        $stmt = $this->db->prepare(
            "SELECT id, username, role, is_active, created_at
             FROM admins ORDER BY id ASC"
        );
        $stmt->execute();
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * 新增普通管理员 —— 仅超级管理员
     * 注意：不接受前端传入 role，新账号一律为普通管理员，防止越权提权。
     */
    public function create() {
        $operator = $this->auth->requireSuper();
        if ($operator === null) return;

        $data = json_decode(file_get_contents("php://input")) ?: new \stdClass();
        $username = trim($data->username ?? '');
        $password = $data->password ?? '';

        if ($username === '' || $password === '') {
            http_response_code(400);
            echo json_encode(["message" => "账号和初始密码不能为空"]);
            return;
        }
        if (!preg_match('/^[A-Za-z0-9_\-]{3,50}$/', $username)) {
            http_response_code(400);
            echo json_encode(["message" => "账号需为3-50位字母、数字、下划线或中划线"]);
            return;
        }
        if (strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(["message" => "初始密码长度至少6位"]);
            return;
        }

        $check = $this->db->prepare("SELECT id FROM admins WHERE username = :u");
        $check->execute([':u' => $username]);
        if ($check->rowCount() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "该账号已存在"]);
            return;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $this->db->prepare(
            "INSERT INTO admins (username, password, role, is_active)
             VALUES (:u, :p, 'normal', 1)"
        );
        $stmt->execute([':u' => $username, ':p' => $hash]);

        echo json_encode(["message" => "管理员创建成功"]);
    }

    /**
     * 重置管理员密码 —— 仅超级管理员
     */
    public function resetPassword() {
        $operator = $this->auth->requireSuper();
        if ($operator === null) return;

        $data = json_decode(file_get_contents("php://input")) ?: new \stdClass();
        $id = (int)($data->id ?? 0);
        $password = $data->password ?? '';

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(["message" => "缺少管理员ID"]);
            return;
        }
        if (strlen($password) < 6) {
            http_response_code(400);
            echo json_encode(["message" => "新密码长度至少6位"]);
            return;
        }

        $target = $this->findAdmin($id);
        if ($target === null) {
            http_response_code(404);
            echo json_encode(["message" => "目标管理员不存在"]);
            return;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $this->db->prepare("UPDATE admins SET password = :p WHERE id = :id");
        $stmt->execute([':p' => $hash, ':id' => $id]);

        echo json_encode(["message" => "密码已重置"]);
    }

    /**
     * 启用 / 停用账号 —— 仅超级管理员
     * 超级管理员不能停用自己，避免把自己锁在门外。
     */
    public function setActive() {
        $operator = $this->auth->requireSuper();
        if ($operator === null) return;

        $data = json_decode(file_get_contents("php://input")) ?: new \stdClass();
        $id = (int)($data->id ?? 0);
        $active = (int)($data->is_active ?? -1);

        if ($id <= 0 || ($active !== 0 && $active !== 1)) {
            http_response_code(400);
            echo json_encode(["message" => "参数错误"]);
            return;
        }

        $target = $this->findAdmin($id);
        if ($target === null) {
            http_response_code(404);
            echo json_encode(["message" => "目标管理员不存在"]);
            return;
        }

        if ($active === 0 && (int)$target['id'] === (int)$operator['id']) {
            http_response_code(400);
            echo json_encode(["message" => "不能停用当前登录的超级管理员账号"]);
            return;
        }

        // 保险：系统中至少保留一个启用的超级管理员
        if ($active === 0 && $target['role'] === 'super' && !$this->anotherActiveSuperExists($id)) {
            http_response_code(400);
            echo json_encode(["message" => "至少需要保留一个启用的超级管理员"]);
            return;
        }

        $stmt = $this->db->prepare("UPDATE admins SET is_active = :a WHERE id = :id");
        $stmt->execute([':a' => $active, ':id' => $id]);

        echo json_encode(["message" => $active === 1 ? "账号已启用" : "账号已停用"]);
    }

    /**
     * 登录日志 —— 仅超级管理员
     * 返回账号、时间、IP、结果。
     */
    public function loginLogs() {
        if ($this->auth->requireSuper() === null) return;

        $limit = min(max((int)($_GET['limit'] ?? 100), 1), 500);
        $stmt = $this->db->prepare(
            "SELECT id, username, success, ip, user_agent, created_at
             FROM login_logs ORDER BY id DESC LIMIT :limit"
        );
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function findAdmin(int $id): ?array {
        $stmt = $this->db->prepare(
            "SELECT id, username, role, is_active FROM admins WHERE id = :id LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function anotherActiveSuperExists(int $excludeId): bool {
        $stmt = $this->db->prepare(
            "SELECT id FROM admins
             WHERE role = 'super' AND is_active = 1 AND id <> :id LIMIT 1"
        );
        $stmt->execute([':id' => $excludeId]);
        return $stmt->rowCount() > 0;
    }

    private function writeLog(string $username, int $success): void {
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO login_logs (username, success, ip, user_agent)
                 VALUES (:u, :s, :ip, :ua)"
            );
            $stmt->execute([
                ':u'  => mb_substr($username, 0, 50),
                ':s'  => $success,
                ':ip' => Auth::clientIp(),
                ':ua' => Auth::userAgent(),
            ]);
        } catch (\Throwable $e) {
            error_log('write login log failed: ' . $e->getMessage());
        }
    }
}
