<?php
require_once __DIR__ . '/../config.php';

// Cashfree return handler — verifies order via Get Order API, notifies Node, redirects user.
$orderId = isset($_GET['order_id']) ? trim($_GET['order_id']) : '';
if ($orderId === '') { http_response_code(400); echo 'Missing order_id'; exit; }

$p = payment_get($orderId);
if (!$p) { http_response_code(404); echo 'Unknown order'; exit; }

$cf = gateway_get('cashfree');
if (!$cf) { http_response_code(500); echo 'Cashfree not configured'; exit; }

$verify = cashfree_get_order($cf, $orderId);
$status = 'failed';
$payId = '';
if ($verify['ok'] && cashfree_is_paid($verify['data'])) {
    $status = 'success';
    // Cashfree returns latest payment under cf_payment_id when querying /orders/{id}/payments
    // We just use orderId as reference here. Optionally call /orders/{id}/payments for cf_payment_id.
    $payId = $verify['data']['cf_order_id'] ?? '';
}

payment_update($orderId, [
    'status'             => $status === 'success' ? 'success' : 'failed',
    'gateway_payment_id' => $payId,
]);

// Notify Node.js
$notify = node_notify_payment($orderId, $status, $payId, 'cashfree');
if ($notify['ok']) payment_update($orderId, ['notified' => 1]);

// Redirect back to user app
header('Location: ' . node_return_url($orderId, $status));
exit;
