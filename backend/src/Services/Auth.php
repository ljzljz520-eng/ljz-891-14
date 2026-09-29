<?php
namespace Services;

use PDO;

/**
 * 鉴权服务
 * - 使用 HMAC-SHA256 签名的有状态 Token（base64url(header).base64url(payload).signature）
 * - 每次请求回查 admins 表，保证账号被停用 / 角色被修改后立即生效
 */
class Auth
{
    private $db;

    // Token 有效期 8 小时
    const TTL = 28800;

    public function __construct($db)
    {
        $this->db = $db;
    }

    /**
     * 生成签名 Token
     */
    public function issueToken(array $admin): string
    {
        $payload = [
            'sub' => (int)$admin['id'],
            'username' => $admin['username'],
            'role' => $admin['role'],
            'iat' => time(),
            'exp' => time() + self::TTL,
        ];
        return $this->encode($payload);
    }

    /**
     * 校验 Token 并返回当前管理员（含最新 role / is_active）。
     * 失败时直接输出 401 JSON 并退出。
     */
    public function authenticate(): array
    {
        $token = $this->bearerToken();
        if (!$token) {
            $this->deny(401, '未登录或登录已失效');
        }

        $payload = $this->decode($token);
        if (!$payload || !isset($payload['sub'], $payload['exp']) || $payload['exp'] < time()) {
            $this->deny(401, '登录已过期，请重新登录');
        }

        // 回查数据库：确保账号仍存在、未被停用、角色为最新
        $stmt = $this->db->prepare(
            "SELECT id, username, password, role, is_active, created_at
             FROM admins WHERE id = :id LIMIT 1"
        );
        $stmt->execute([':id' => $payload['sub']]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$admin) {
            $this->deny(401, '账号不存在');
        }
        if ((int)$admin['is_active'] !== 1) {
            $this->deny(403, '该账号已被停用，请联系超级管理员');
        }

        return $admin;
    }

    /**
     * 要求超级管理员，否则 403。
     */
    public function requireSuperAdmin(): array
    {
        $admin = $this->authenticate();
        if ($admin['role'] !== 'super_admin') {
            $this->deny(403, '权限不足：仅超级管理员可进行此操作');
        }
        return $admin;
    }

    /**
     * 获取客户端真实 IP（nginx 已透传 X-Real-IP / X-Forwarded-For）
     */
    public static function clientIp(): string
    {
        foreach (['HTTP_X_REAL_IP', 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
            if (!empty($_SERVER[$key])) {
                $ip = trim(explode(',', $_SERVER[$key])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        return '0.0.0.0';
    }

    private function bearerToken(): ?string
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($auth && preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
            return $m[1];
        }
        return null;
    }

    private function secret(): string
    {
        $secret = getenv('JWT_SECRET');
        if (!$secret) {
            // 部署时应通过环境变量覆盖；此值仅为兜底
            $secret = 'xingluo-license-admin-secret-2026';
        }
        return $secret;
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    private function encode(array $payload): string
    {
        $header = ['typ' => 'JWT', 'alg' => 'HS256'];
        $h = $this->base64UrlEncode(json_encode($header));
        $p = $this->base64UrlEncode(json_encode($payload));
        $sig = $this->base64UrlEncode(hash_hmac('sha256', "$h.$p", $this->secret(), true));
        return "$h.$p.$sig";
    }

    private function decode(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$h, $p, $sig] = $parts;
        $expected = $this->base64UrlEncode(hash_hmac('sha256', "$h.$p", $this->secret(), true));
        if (!hash_equals($expected, $sig)) {
            return null;
        }
        $payload = json_decode($this->base64UrlDecode($p), true);
        return is_array($payload) ? $payload : null;
    }

    private function deny(int $code, string $message): void
    {
        http_response_code($code);
        echo json_encode(["message" => $message]);
        exit;
    }
}
