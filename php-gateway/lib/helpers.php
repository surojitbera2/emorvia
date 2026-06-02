<?php
function http_post_json($url, $payload, $headers = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => is_string($payload) ? $payload : json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => array_merge(['Content-Type: application/json', 'Accept: application/json'], $headers),
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['http' => $code, 'body' => $body, 'error' => $err, 'json' => json_decode($body ?: '', true)];
}

function http_get_json($url, $headers = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => array_merge(['Accept: application/json'], $headers),
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['http' => $code, 'body' => $body, 'error' => $err, 'json' => json_decode($body ?: '', true)];
}

function start_session_once() {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_start();
    }
}

function admin_require_login() {
    start_session_once();
    if (empty($_SESSION['admin_user'])) {
        header('Location: ' . admin_url('login.php'));
        exit;
    }
}

function admin_url($path = '') {
    $base = rtrim(dirname($_SERVER['PHP_SELF']), '/');
    // If we're inside /admin/, go up one
    if (basename($base) === 'admin') return $base . '/' . ltrim($path, '/');
    return $base . '/admin/' . ltrim($path, '/');
}

function base_url() {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $dir    = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
    if (basename($dir) === 'admin' || basename($dir) === 'callback') $dir = dirname($dir);
    return $scheme . '://' . $host . $dir;
}

function timing_safe_equals($a, $b) {
    if (function_exists('hash_equals')) return hash_equals((string)$a, (string)$b);
    if (strlen($a) !== strlen($b)) return false;
    $r = 0;
    for ($i = 0, $n = strlen($a); $i < $n; $i++) $r |= ord($a[$i]) ^ ord($b[$i]);
    return $r === 0;
}

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function flash_set($msg, $type = 'success') {
    start_session_once();
    $_SESSION['flash'] = ['msg' => $msg, 'type' => $type];
}
function flash_pop() {
    start_session_once();
    $f = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $f;
}
