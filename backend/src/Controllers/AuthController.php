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
     * 登录：校验密码、校验账号状态，并写入登录日志（账号 / 时间 / IP）
     */
    public function login() {
        $data = json_decode(file_get_contents("php://input"));

        if (!isset($data->username) || !isset($data->password)) {
            http_response_code(400);
            echo json_encode(["message" => "请输入账号和密码"]);
            return;
        }

        $username = trim($data->username);
        $ip = Auth::clientIp();

        $query = "SELECT id, username, password, role, is_active FROM admins WHERE username = :username LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(":username", $username);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row || !password_verify($data->password, $row['password'])) {
            $this->writeLog($username, $ip, false, '账号或密码错误');
            http_response_code(401);
            echo json_encode(["message" => "账号或密码错误"]);
            return;
        }

        if ((int)$row['is_active'] !== 1) {
            $this->writeLog($username, $ip, false, '账号已停用');
            http_response_code(403);
            echo json_encode(["message" => "该账号已被停用，请联系超级管理员"]);
            return;
        }

        $this->writeLog($username, $ip, true, null);

        http_response_code(200);
        echo json_encode([
            "message" => "Login successful",
            "user" => $row['username'],
            "role" => $row['role'],
            "token" => $this->auth->issueToken($row),
        ]);
    }

    /**
     * 当前登录用户信息（任意已登录管理员）
     */
    public function me() {
        $admin = $this->auth->authenticate();
        echo json_encode([
            "id" => (int)$admin['id'],
            "username" => $admin['username'],
            "role" => $admin['role'],
            "is_active" => (int)$admin['is_active'],
            "created_at" => $admin['created_at'],
        ]);
    }

    /**
     * 管理员列表（仅超级管理员）
     */
    public function list() {
        $this->auth->requireSuperAdmin();

        $query = "SELECT id, username, role, is_active, created_at FROM admins ORDER BY id ASC";
        $stmt = $this->db->prepare($query);
        $stmt->execute();
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * 新增普通管理员（仅超级管理员；角色固定为普通管理员）
     */
    public function create() {
        $this->auth->requireSuperAdmin();

        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->username) || !isset($data->password)
            || trim($data->username) === '' || trim($data->password) === '') {
            http_response_code(400);
            echo json_encode(["message" => "用户名和密码不能为空"]);
            return;
        }

        $username = trim($data->username);
        if (mb_strlen($username) < 3 || mb_strlen($username) > 50) {
            http_response_code(400);
            echo json_encode(["message" => "用户名长度需在 3-50 个字符之间"]);
            return;
        }
        if (strlen($data->password) < 6) {
            http_response_code(400);
            echo json_encode(["message" => "密码长度不能少于 6 位"]);
            return;
        }

        $check = $this->db->prepare("SELECT id FROM admins WHERE username = :u");
        $check->execute([':u' => $username]);
        if ($check->rowCount() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "用户名已存在"]);
            return;
        }

        $hash = password_hash($data->password, PASSWORD_BCRYPT);
        // 即使前端伪造 role 参数也忽略，始终创建普通管理员
        $query = "INSERT INTO admins (username, password, role, is_active) VALUES (:u, :p, 'admin', 1)";
        $stmt = $this->db->prepare($query);
        $stmt->execute([':u' => $username, ':p' => $hash]);

        http_response_code(201);
        echo json_encode(["message" => "管理员创建成功"]);
    }

    /**
     * 重置管理员密码（仅超级管理员，且不能操作其他超级管理员）
     */
    public function resetPassword() {
        $operator = $this->auth->requireSuperAdmin();

        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->id) || !isset($data->password) || trim($data->password) === '') {
            http_response_code(400);
            echo json_encode(["message" => "参数不完整"]);
            return;
        }
        if (strlen($data->password) < 6) {
            http_response_code(400);
            echo json_encode(["message" => "新密码长度不能少于 6 位"]);
            return;
        }

        $target = $this->findAdmin($data->id);
        if (!$target) {
            http_response_code(404);
            echo json_encode(["message" => "账号不存在"]);
            return;
        }
        if ($target['role'] === 'super_admin' && (int)$target['id'] !== (int)$operator['id']) {
            http_response_code(403);
            echo json_encode(["message" => "不能重置其他超级管理员的密码"]);
            return;
        }

        $hash = password_hash($data->password, PASSWORD_BCRYPT);
        $stmt = $this->db->prepare("UPDATE admins SET password = :p WHERE id = :id");
        $stmt->execute([':p' => $hash, ':id' => $data->id]);

        echo json_encode(["message" => "密码已重置"]);
    }

    /**
     * 启用 / 停用账号（仅超级管理员；不能停用自己，也不能停用其他超级管理员）
     */
    public function setActive() {
        $operator = $this->auth->requireSuperAdmin();

        $data = json_decode(file_get_contents("php://input"));
        if (!isset($data->id) || !isset($data->is_active)) {
            http_response_code(400);
            echo json_encode(["message" => "参数不完整"]);
            return;
        }

        $id = (int)$data->id;
        $active = $data->is_active ? 1 : 0;

        if ($id === (int)$operator['id']) {
            http_response_code(400);
            echo json_encode(["message" => "不能停用当前登录账号"]);
            return;
        }

        $target = $this->findAdmin($id);
        if (!$target) {
            http_response_code(404);
            echo json_encode(["message" => "账号不存在"]);
            return;
        }
        if ($target['role'] === 'super_admin') {
            http_response_code(403);
            echo json_encode(["message" => "超级管理员账号不可被停用"]);
            return;
        }

        $stmt = $this->db->prepare("UPDATE admins SET is_active = :active WHERE id = :id");
        $stmt->execute([':active' => $active, ':id' => $id]);

        echo json_encode(["message" => $active ? '账号已启用' : '账号已停用']);
    }

    /**
     * 登录日志（仅超级管理员）：账号、时间、IP、结果
     */
    public function logs() {
        $this->auth->requireSuperAdmin();

        $limit = isset($_GET['limit']) ? min(500, max(1, (int)$_GET['limit'])) : 100;

        $stmt = $this->db->prepare(
            "SELECT id, username, ip, success, fail_reason, created_at
             FROM login_logs ORDER BY id DESC LIMIT :limit"
        );
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function findAdmin($id): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, username, role, is_active FROM admins WHERE id = :id LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function writeLog(string $username, string $ip, bool $success, ?string $reason): void
    {
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO login_logs (username, ip, success, fail_reason) VALUES (:u, :ip, :s, :r)"
            );
            $stmt->execute([
                ':u' => $username,
                ':ip' => $ip,
                ':s' => $success ? 1 : 0,
                ':r' => $reason,
            ]);
        } catch (\Throwable $e) {
            error_log('write login_log failed: ' . $e->getMessage());
        }
    }
}
