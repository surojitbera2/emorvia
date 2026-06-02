<?php
require_once __DIR__ . '/../config.php';

// Razorpay callback handler (Standard Checkout posts here with redirect=true).
$orderId = isset($_GET['order_id']) ? trim($_GET['order_id']) : '';
if ($orderId === '') { http_response_code(400); echo 'Missing order_id'; exit; }

$p = payment_get($orderId);
if (!$p) { http_response_code(404); echo 'Unknown order'; exit; }

$rp = gateway_get('razorpay');
if (!$rp) { http_response_code(500); echo 'Razorpay not configured'; exit; }

$razorpay_payment_id = $_POST['razorpay_payment_id'] ?? '';
$razorpay_order_id   = $_POST['razorpay_order_id']   ?? '';
$razorpay_signature  = $_POST['razorpay_signature']  ?? '';

$status = 'failed';
if ($razorpay_payment_id && $razorpay_order_id && $razorpay_signature
    && razorpay_verify_signature($rp, $razorpay_order_id, $razorpay_payment_id, $razorpay_signature)) {
    // Optional secondary check
    $f = razorpay_fetch_payment($rp, $razorpay_payment_id);
    if ($f['ok'] && (($f['data']['status'] ?? '') === 'captured' || ($f['data']['status'] ?? '') === 'authorized')) {
        $status = 'success';
    }
}

payment_update($orderId, [
    'status'             => $status === 'success' ? 'success' : 'failed',
    'gateway_payment_id' => $razorpay_payment_id,
]);

$notify = node_notify_payment($orderId, $status, $razorpay_payment_id, 'razorpay');
if ($notify['ok']) payment_update($orderId, ['notified' => 1]);

header('Location: ' . node_return_url($orderId, $status));
exit;
