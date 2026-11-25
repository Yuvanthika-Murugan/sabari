<?php

declare(strict_types=1);

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Router;

spl_autoload_register(function (string $class): void {
    if (str_starts_with($class, 'App\\')) {
        $file = __DIR__ . '/../src/' . str_replace('\\', '/', substr($class, 4)) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});

$configFile = __DIR__ . '/../config/config.php';
if (!is_file($configFile)) {
    $configFile = __DIR__ . '/../config/config.example.php';
}
$config = require $configFile;

date_default_timezone_set($config['app']['timezone']);
ini_set('display_errors', '0');

// ----- Customer and user photos -----
// Apache serves these files directly; this covers `php -S`, which routes every request here.
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (preg_match('#/(uploads/(?:customers|users)/[a-f0-9]{32}\.jpg)$#', $uriPath, $m)) {
    $file = __DIR__ . '/' . $m[1];
    if (!is_file($file)) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: image/jpeg');
    header('Cache-Control: private, max-age=31536000, immutable');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

// ----- CORS -----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $config['app']['cors_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
// Security headers: no sniffing, no framing, no caching of private data, no scripts
// if a response is ever opened directly in a browser.
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header('Cross-Origin-Resource-Policy: same-site');
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    header('Strict-Transport-Security: max-age=31536000');
}
header_remove('X-Powered-By');

$respond = function (int $status, array|null $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
};

try {
    DB::configure($config['db']);
    Auth::configure($config['app']);

    $request = Request::capture();
    $router = new Router();
    (require __DIR__ . '/../routes.php')($router);

    if (!in_array("{$request->method} {$request->path}", PUBLIC_ROUTES, true)) {
        Auth::authenticate($request);
    }

    $respond(200, $router->dispatch($request));
} catch (HttpException $e) {
    $respond($e->status, ['message' => $e->getMessage(), 'errors' => (object) $e->errors]);
} catch (PDOException $e) {
    // 23000: integrity constraint (duplicate key or record still referenced elsewhere)
    if ($e->getCode() === '23000') {
        $respond(409, ['message' => 'This record is linked to other data and cannot be changed or removed.', 'errors' => (object) []]);
    } else {
        error_log((string) $e);
        $respond(500, ['message' => $config['app']['debug'] ? $e->getMessage() : 'A database error occurred', 'errors' => (object) []]);
    }
} catch (Throwable $e) {
    error_log((string) $e);
    $respond(500, ['message' => $config['app']['debug'] ? $e->getMessage() : 'An unexpected error occurred', 'errors' => (object) []]);
}
