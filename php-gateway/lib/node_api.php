<?php
// Helper to talk to the Node.js backend (Bongo Bandhu)

function node_config() {
    return [
        'base_url'       => setting_get('node_base_url', ''),
        'shared_secret'  => setting_get('node_shared_secret', ''),
        'return_url'     => setting_get('node_return_url', ''),
    ];
}

function node_fetch_order($orderId) {
    $cfg = node_config();
    if (!$cfg['base_url'] || !$cfg['shared_secret']) {
        return ['ok' => false, 'error' => 'Node.js gateway not configured in admin settings.'];
    }
    $url = rtrim($cfg['base_url'], '/') . '/api/ext-payment/order/' . rawurlencode($orderId);
    $res = http_get_json($url, ['X-Gateway-Secret: ' . $cfg['shared_secret']]);
    if ($res['http'] !== 200 || !is_array($res['json'])) {
        return ['ok' => false, 'error' => 'Failed to fetch order (HTTP ' . $res['http'] . '): ' . ($res['json']['error'] ?? $res['body'])];
    }
    return ['ok' => true, 'order' => $res['json']];
}

function node_notify_payment($orderId, $status, $paymentId, $gateway) {
    $cfg = node_config();
    if (!$cfg['base_url'] || !$cfg['shared_secret']) {
        return ['ok' => false, 'error' => 'Node.js not configured'];
    }
    $payload = json_encode([
        'orderId'   => $orderId,
        'status'    => $status, // 'success' | 'failed' | 'cancelled'
        'paymentId' => $paymentId,
        'gateway'   => $gateway,
        'ts'        => time(),
    ]);
    $sig = hash_hmac('sha256', $payload, $cfg['shared_secret']);
    $url = rtrim($cfg['base_url'], '/') . '/api/ext-payment/callback';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Gateway-Signature: ' . $sig,
        ],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['ok' => ($code >= 200 && $code < 300), 'http' => $code, 'body' => $body];
}

// URL to redirect the user back to (either node return endpoint or a configured front-end URL)
function node_return_url($orderId, $status) {
    $cfg = node_config();
    $url = $cfg['return_url'] ?: (rtrim($cfg['base_url'], '/') . '/api/ext-payment/return');
    $sep = strpos($url, '?') === false ? '?' : '&';
    return $url . $sep . 'order_id=' . rawurlencode($orderId) . '&status=' . rawurlencode($status);
}
