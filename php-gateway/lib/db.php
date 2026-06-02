<?php
// Single PDO instance.
function db() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// Fetch a single setting row (or default)
function setting_get($key, $default = null) {
    $st = db()->prepare('SELECT v FROM settings WHERE k = ? LIMIT 1');
    $st->execute([$key]);
    $row = $st->fetch();
    if (!$row) return $default;
    $decoded = json_decode($row['v'], true);
    return $decoded === null ? $row['v'] : $decoded;
}

function setting_set($key, $value) {
    $v = is_string($value) ? $value : json_encode($value);
    $st = db()->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)');
    $st->execute([$key, $v]);
}

function gateway_get($name) {
    $st = db()->prepare('SELECT * FROM gateways WHERE name = ? LIMIT 1');
    $st->execute([$name]);
    return $st->fetch();
}

function gateway_save($name, $data) {
    $existing = gateway_get($name);
    if ($existing) {
        $st = db()->prepare('UPDATE gateways SET enabled=?, mode=?, key_id=?, key_secret=?, webhook_secret=?, updated_at=NOW() WHERE name=?');
        $st->execute([
            !empty($data['enabled']) ? 1 : 0,
            $data['mode'] ?? 'test',
            $data['key_id'] ?? '',
            $data['key_secret'] ?? '',
            $data['webhook_secret'] ?? '',
            $name,
        ]);
    } else {
        $st = db()->prepare('INSERT INTO gateways (name, enabled, mode, key_id, key_secret, webhook_secret) VALUES (?,?,?,?,?,?)');
        $st->execute([
            $name,
            !empty($data['enabled']) ? 1 : 0,
            $data['mode'] ?? 'test',
            $data['key_id'] ?? '',
            $data['key_secret'] ?? '',
            $data['webhook_secret'] ?? '',
        ]);
    }
}

function payment_get($orderId) {
    $st = db()->prepare('SELECT * FROM payments WHERE order_id = ? LIMIT 1');
    $st->execute([$orderId]);
    return $st->fetch();
}

function payment_create($orderId, $amount, $gateway, $gatewayOrderId = '') {
    $st = db()->prepare('INSERT INTO payments (order_id, amount, currency, gateway, gateway_order_id, status) VALUES (?,?,?,?,?,?)');
    $st->execute([$orderId, $amount, 'INR', $gateway, $gatewayOrderId, 'pending']);
}

function payment_update($orderId, $fields) {
    $cols = [];
    $vals = [];
    foreach ($fields as $k => $v) { $cols[] = "$k = ?"; $vals[] = $v; }
    $vals[] = $orderId;
    $sql = 'UPDATE payments SET ' . implode(', ', $cols) . ', updated_at=NOW() WHERE order_id = ?';
    $st = db()->prepare($sql);
    $st->execute($vals);
}
