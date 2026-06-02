<?php
// Cashfree PG API v2025-01-01 — pure PHP/cURL

function cashfree_base_url($mode) {
    return $mode === 'live' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
}

function cashfree_headers($g) {
    return [
        'Content-Type: application/json',
        'Accept: application/json',
        'x-api-version: 2025-01-01',
        'x-client-id: '     . $g['key_id'],
        'x-client-secret: ' . $g['key_secret'],
    ];
}

// Create an order, returns ['ok'=>bool, 'payment_session_id'=>..., 'cf_order_id'=>..., 'error'=>...]
function cashfree_create_order($g, $orderId, $amount, $customer, $returnUrl, $notifyUrl = null) {
    $url = cashfree_base_url($g['mode']) . '/orders';
    $payload = [
        'order_id'       => $orderId,
        'order_amount'   => (float)$amount,
        'order_currency' => 'INR',
        'customer_details' => [
            'customer_id'    => (string)$customer['id'],
            'customer_name'  => (string)$customer['name'],
            'customer_email' => (string)$customer['email'],
            'customer_phone' => (string)$customer['phone'],
        ],
        'order_meta' => [
            'return_url' => $returnUrl,
        ],
    ];
    if ($notifyUrl) $payload['order_meta']['notify_url'] = $notifyUrl;

    $res = http_post_json($url, $payload, cashfree_headers($g));
    if ($res['http'] < 200 || $res['http'] >= 300 || empty($res['json']['payment_session_id'])) {
        return [
            'ok'    => false,
            'error' => $res['json']['message'] ?? $res['body'] ?? 'Cashfree order failed',
        ];
    }
    return [
        'ok' => true,
        'payment_session_id' => $res['json']['payment_session_id'],
        'cf_order_id'        => $res['json']['order_id'] ?? $orderId,
    ];
}

// Get order status (server-side verification by order_id)
function cashfree_get_order($g, $orderId) {
    $url = cashfree_base_url($g['mode']) . '/orders/' . rawurlencode($orderId);
    $res = http_get_json($url, cashfree_headers($g));
    if ($res['http'] < 200 || $res['http'] >= 300 || !is_array($res['json'])) {
        return ['ok' => false, 'error' => $res['json']['message'] ?? 'Cashfree get order failed', 'raw' => $res['json']];
    }
    return ['ok' => true, 'data' => $res['json']];
}

function cashfree_is_paid($data) {
    $s1 = $data['order_status']    ?? '';
    $s2 = $data['payment_status']  ?? '';
    return ($s1 === 'PAID') || ($s2 === 'SUCCESS');
}
