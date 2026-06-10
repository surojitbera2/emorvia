<?php
require_once __DIR__ . '/../config.php';

// Easebuzz return handler — Easebuzz POSTs the payment response here (surl & furl).
// We verify the reverse hash, optionally double-check via transaction API,
// then notify Node.js and redirect the user back to the wallet.

$orderId = isset($_GET['order_id']) ? trim($_GET['order_id']) : '';
if ($orderId === '' && isset($_POST['txnid'])) {
    $orderId = trim($_POST['txnid']);
}
if ($orderId === '') { http_response_code(400); echo 'Missing order_id'; exit; }

$p = payment_get($orderId);
if (!$p) { http_response_code(404); echo 'Unknown order'; exit; }

$eb = gateway_get('easebuzz');
if (!$eb) { http_response_code(500); echo 'Easebuzz not configured'; exit; }

$resp = $_POST ?: [];
$status = 'failed';
$payId  = '';

if (!empty($resp) && easebuzz_verify_response_hash($resp, trim($eb['key_secret']))) {
    $respStatus = strtolower((string)($resp['status'] ?? ''));
    $payId      = (string)($resp['easepayid'] ?? $resp['txnid'] ?? '');

    if ($respStatus === 'success') {
        // Defence-in-depth: verify via Easebuzz transaction API as well
        $v = easebuzz_fetch_transaction($eb, (string)($resp['txnid'] ?? $orderId));
        if ($v['ok'] && !empty($v['paid'])) {
            $status = 'success';
        } else {
            error_log('[easebuzz] hash OK but transaction API not paid: ' . json_encode($v));
        }
    }
} else {
    error_log('[easebuzz] response hash mismatch or empty POST for order ' . $orderId);
}

payment_update($orderId, [
    'status'             => $status === 'success' ? 'success' : 'failed',
    'gateway_payment_id' => $payId,
]);

// Notify Node.js backend
$notify = node_notify_payment($orderId, $status, $payId, 'easebuzz');
if ($notify['ok']) payment_update($orderId, ['notified' => 1]);

// Redirect back to user app
header('Location: ' . node_return_url($orderId, $status));
exit;
