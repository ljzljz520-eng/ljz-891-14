<?php
namespace Services;

use PDO;

/**
 * 后台鉴权服务
 *
 * - 颁发/校验自研的 HMAC 签名 token（无状态，携带 admin id）
 * - 每次受保护请求都回查数据库，保证账号停用 / 角色变更即时生效
 * - 角色: super(超级管理员) / normal(普通管理员)
 */
class Auth {
    // token 有效期 2 小时
    private const TTL = 7200;

    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * 登录成功后颁发 token
     * payload: base64url({"id":1,"exp":...}) . "." . hmac_sha256
     */
    public function issueToken(int $adminId): string {
        $payload = ['id' => $adminId, 'exp' => time() + self::TTL];
        $body = $this->base64UrlEncode(json_encode($payload));
        return $body . '.' . hash_hmac('sha256', $body, $this->secret());
    }

    /**
     * 解析并校验 token，再回查数据库。
     * 返回管理员数组（含 id/username/role/is_active），失败返回 null。
     */
    public function currentAdmin(): ?array {
        $token = $this->bearerToken();
        if ($token === null) return null;

        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;
        [$body, $sig] = $parts;

        // 签名校验（防伪造 / 防篡改）
        $expected = hash_hmac('sha256', $body, $this->secret());
        if (!hash_equals($expected, $sig)) return null;

        $payload = json_decode($this->base64UrlDecode($body), true);
        if (!is_array($payload) || empty($payload['id']) || empty($payload['exp'])) return null;
        if (!is_int($payload['exp']) || $payload['exp'] < time()) return null;

        // 回查数据库：账号被停用 / 删除后 token 立即失效
        $stmt = $this->db->prepare(
            "SELECT id, username, role, is_active FROM admins WHERE id = :id LIMIT 1"
        );
        $stmt->execute([':id' => (int)$payload['id']]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$admin || (int)$admin['is_active'] !== 1) return null;

        return $admin;
    }

    /**
     * 要求登录；未登录直接输出 401 并返回 null。
     */
    public function requireLogin(): ?array {
        $admin = $this->currentAdmin();
        if ($admin === null) {
            http_response_code(401);
            echo json_encode(["message" => "未登录或登录已失效，请重新登录"]);
            return null;
        }
        return $admin;
    }

    /**
     * 要求超级管理员；普通管理员输出 403。
     */
    public function requireSuper(): ?array {
        $admin = $this->requireLogin();
        if ($admin === null) return null;
        if ($admin['role'] !== 'super') {
            http_response_code(403);
            echo json_encode(["message" => "权限不足，仅超级管理员可执行此操作"]);
            return null;
        }
        return $admin;
    }

    /**
     * 获取客户端真实 IP
     * nginx 反代会带 X-Real-IP；不信任 X-Forwarded-For（可被客户端伪造，除非来自可信代理）
     */
    public static function clientIp(): string {
        $ip = $_SERVER['HTTP_X_REAL_IP'] ?? '';
        if ($ip !== '') return substr(trim(explode(',', $ip)[0]), 0, 45);

        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        return substr(trim(explode(',', $ip)[0]), 0, 45);
    }

    public static function userAgent(): string {
        return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
    }

    private function bearerToken(): ?string {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';
        if ($header === '') {
            // 兼容 Apache 未透传 Authorization 的环境
            if (function_exists('apache_request_headers')) {
                $headers = apache_request_headers();
                foreach ($headers as $k => $v) {
                    if (strcasecmp($k, 'Authorization') === 0) { $header = $v; break; }
                }
            }
        }
        if ($header === '') return null;
        if (preg_match('/Bearer\s+(\S+)/i', $header, $m)) return $m[1];
        return null;
    }

    private function secret(): string {
        // 优先用环境变量；未配置时使用固定兜底值（建议生产环境通过环境变量覆盖）
        $secret = getenv('AUTH_TOKEN_SECRET');
        if ($secret === false || $secret === '') {
            $secret = 'xingluo-auth-default-secret-change-me';
        }
        return $secret;
    }

    private function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }
}
