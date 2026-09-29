<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (file_exists('vendor/autoload.php')) {
    require 'vendor/autoload.php';
} else {
    // Fallback if composer not run (should not happen in Docker)
    include_once './Config/Database.php';
    include_once './Services/Auth.php';
    include_once './Controllers/AuthController.php';
    include_once './Controllers/LicenseController.php';
}

use Config\Database;
use Controllers\AuthController;
use Controllers\LicenseController;

$database = new Database();
$db = $database->getConnection();

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uriParts = explode('/', $uri);

// Simple Router（* = 需要登录的管理接口，权限在 Controller 内强制校验）
// POST /api/auth/login              登录（公开）
// GET  /api/auth/me                 当前登录用户（*）
// GET  /api/auth/list               管理员列表（超管）
// POST /api/auth/create             新增普通管理员（超管）
// POST /api/auth/reset-password     重置密码（超管）
// POST /api/auth/set-active         启用/停用账号（超管）
// GET  /api/auth/logs               登录日志（超管）
// GET  /api/license/query           授权查询（公开）
// GET  /api/license/list            授权列表（*）
// POST /api/license/create          新增授权（*）
// POST /api/license/delete          删除授权（*）
// POST /api/license/send-code       自助更绑验证码（公开）
// POST /api/license/update          自助更绑（公开）

if ($uri === '/api/auth/login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $auth = new AuthController($db);
    $auth->login();
} 
elseif ($uri === '/api/license/query' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $license = new LicenseController($db);
    $license->query();
}
elseif ($uri === '/api/license/create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $license = new LicenseController($db);
    $license->create();
}
elseif ($uri === '/api/license/update' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $license = new LicenseController($db);
    $license->update();
}
elseif ($uri === '/api/license/send-code' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $license = new LicenseController($db);
    $license->sendVerificationCode();
}
elseif ($uri === '/api/license/list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $license = new LicenseController($db);
    $license->listAll(); // 需登录（普通管理员及以上）
}
elseif ($uri === '/api/license/delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $license = new LicenseController($db);
    $license->delete();
}
// Admin Management Routes（权限在 Controller 内强制校验，不依赖前端隐藏）
elseif ($uri === '/api/auth/me' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $auth = new AuthController($db);
    $auth->me();
}
elseif ($uri === '/api/auth/list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $auth = new AuthController($db);
    $auth->list(); // 仅超级管理员
}
elseif ($uri === '/api/auth/create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $auth = new AuthController($db);
    $auth->create(); // 仅超级管理员
}
elseif ($uri === '/api/auth/reset-password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $auth = new AuthController($db);
    $auth->resetPassword(); // 仅超级管理员
}
elseif ($uri === '/api/auth/set-active' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $auth = new AuthController($db);
    $auth->setActive(); // 仅超级管理员
}
elseif ($uri === '/api/auth/logs' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $auth = new AuthController($db);
    $auth->logs(); // 仅超级管理员
}
else {
    http_response_code(404);
    echo json_encode(["message" => "Endpoint Not Found", "uri" => $uri]);
}
