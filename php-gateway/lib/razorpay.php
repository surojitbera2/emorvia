<?php
// Razorpay Orders API + Standard Checkout — pure PHP/cURL

function razorpay_create_order($g, $orderId, $amountRupees) {
    $url = 'https://api.razorpay.com/v1/orders';
    $payload = [
        'amount'          => (int)round($amountRupees * 100), // paise
        'currency'        => 'INR',
        'receipt'         => $orderId,
        'payment_capture' => 1,
        'notes'           => ['internal_order_id' => $orderId],
    ];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_USERPWD        => $g['key_id'] . ':' . $g['key_secret'],
        CURLOPT_HTTPAUTH       => CURLAUTH_BASIC,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($body, true);
    if ($code < 200 || $code >= 300 || empty($json['id'])) {
        return ['ok' => false, 'error' => $json['error']['description'] ?? $body ?? 'Razorpay order failed'];
    }
    return ['ok' => true, 'order_id' => $json['id'], 'amount_paise' => $json['amount']];
}

function razorpay_verify_signature($g, $razorpay_order_id, $razorpay_payment_id, $razorpay_signature) {
    $base = $razorpay_order_id . '|' . $razorpay_payment_id;
    $expected = hash_hmac('sha256', $base, $g['key_secret']);
    return timing_safe_equals($expected, $razorpay_signature);
}

// Optional: server-side fetch of payment for double-check
function razorpay_fetch_payment($g, $razorpay_payment_id) {
    $url = 'https://api.razorpay.com/v1/payments/' . rawurlencode($razorpay_payment_id);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_USERPWD        => $g['key_id'] . ':' . $g['key_secret'],
        CURLOPT_HTTPAUTH       => CURLAUTH_BASIC,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($body, true);
    if ($code < 200 || $code >= 300) return ['ok' => false, 'error' => $body];
    return ['ok' => true, 'data' => $json];
}
