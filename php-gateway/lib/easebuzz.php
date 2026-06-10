<?php
// =====================================================================
// Easebuzz Payment Gateway — Initiate Payment API (pure PHP/cURL)
// Docs: https://docs.easebuzz.in/docs/payment-gateway/8ec545c331e6f-initiate-payment-api
//
// Credentials are stored in the `gateways` table under name="easebuzz":
//   key_id      → Merchant Key   (from Easebuzz dashboard)
//   key_secret  → Salt           (from Easebuzz dashboard)
//   mode        → 'test' or 'live'
//
// Flow:
//   1) POST /payment/initiateLink → get access_key
//   2) Redirect user to {base}/pay/{access_key} (hosted checkout)
//   3) Easebuzz POSTs response to our surl/furl after payment
//   4) Verify reverse hash + (optional) transaction status API
// =====================================================================

function easebuzz_base_url($mode) {
    return $mode === 'live'
        ? 'https://pay.easebuzz.in/'
        : 'https://testpay.easebuzz.in/';
}

function easebuzz_dashboard_url($mode) {
    return $mode === 'live'
        ? 'https://dashboard.easebuzz.in/'
        : 'https://testdashboard.easebuzz.in/';
}

// Build SHA-512 hash for the Initiate Payment request.
// Sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|SALT
function easebuzz_request_hash($params, $salt) {
    $fields = ['key','txnid','amount','productinfo','firstname','email',
               'udf1','udf2','udf3','udf4','udf5','udf6','udf7','udf8','udf9','udf10'];
    $s = '';
    foreach ($fields as $f) {
        $s .= (isset($params[$f]) ? $params[$f] : '') . '|';
    }
    $s .= $salt;
    return strtolower(hash('sha512', $s));
}

// Verify the response hash returned by Easebuzz (callback POST).
// Reverse sequence: SALT|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
function easebuzz_verify_response_hash($resp, $salt) {
    $reverse = ['udf10','udf9','udf8','udf7','udf6','udf5','udf4','udf3','udf2','udf1',
                'email','firstname','productinfo','amount','txnid','key'];
    $s = $salt . '|' . ($resp['status'] ?? '');
    foreach ($reverse as $f) {
        $s .= '|' . (isset($resp[$f]) ? $resp[$f] : '');
    }
    $expected = strtolower(hash('sha512', $s));
    return timing_safe_equals($expected, strtolower((string)($resp['hash'] ?? '')));
}

/**
 * Initiate a payment session and return the hosted checkout URL.
 *
 * @param array  $g          gateway row (mode, key_id=merchant_key, key_secret=salt)
 * @param string $orderId    your internal order id (becomes txnid)
 * @param float  $amount     INR amount (must be ≥ 1)
 * @param array  $customer   ['name'=>..., 'email'=>..., 'phone'=>...]
 * @param string $surl       success return URL (Easebuzz POSTs here)
 * @param string $furl       failure return URL (Easebuzz POSTs here)
 * @param string $productInfo
 * @return array {ok, redirect_url, access_key, error, raw}
 */
function easebuzz_initiate_payment($g, $orderId, $amount, $customer, $surl, $furl, $productInfo = 'Wallet Recharge') {
    if (empty($g['key_id']) || empty($g['key_secret'])) {
        return ['ok' => false, 'error' => 'Easebuzz Merchant Key / Salt not configured.'];
    }

    // Amount must be string with a decimal point (Easebuzz validation rejects integers).
    $amountStr = number_format((float)$amount, 2, '.', '');

    // Sanitize firstname to fit Easebuzz pattern: ^[a-zA-Z0-9&'\-._ ()\/,@]{1,150}$
    $firstname = preg_replace('/[^A-Za-z0-9&\'\-._ ()\/,@]/', '', (string)($customer['name'] ?? 'Customer'));
    if ($firstname === '') $firstname = 'Customer';
    $firstname = substr($firstname, 0, 60);

    // Sanitize productinfo: ^[a-zA-Z0-9\-\s|\-]{1,45}$
    $productInfo = preg_replace('/[^A-Za-z0-9\-\s|]/', ' ', $productInfo);
    $productInfo = substr(trim($productInfo) ?: 'Wallet Recharge', 0, 45);

    // Sanitize txnid: ^[a-zA-Z0-9_|\-\/]{1,40}$
    $txnid = preg_replace('/[^A-Za-z0-9_|\-\/]/', '', (string)$orderId);
    $txnid = substr($txnid !== '' ? $txnid : ('EBZ' . time()), 0, 40);

    $phone = preg_replace('/[^0-9+\-]/', '', (string)($customer['phone'] ?? ''));
    if (!preg_match('/^(\+\d{1,4}[-]?)?\d{5,20}$/', $phone)) {
        // Fall back to a 10-digit placeholder if mobile is invalid (Easebuzz still requires non-empty phone)
        $phone = '9999999999';
    }

    $params = [
        'key'         => trim($g['key_id']),
        'txnid'       => $txnid,
        'amount'      => $amountStr,
        'productinfo' => $productInfo,
        'firstname'   => $firstname,
        'email'       => (string)($customer['email'] ?? 'noreply@example.com'),
        'phone'       => $phone,
        'surl'        => $surl,
        'furl'        => $furl,
        // udf1..udf5 are optional but appear in the hash; leave empty
        'udf1' => '', 'udf2' => '', 'udf3' => '', 'udf4' => '', 'udf5' => '',
    ];
    // Compute hash including udf6..udf10 (which must be empty in the body but counted in hash)
    $hashParams = $params + ['udf6' => '', 'udf7' => '', 'udf8' => '', 'udf9' => '', 'udf10' => ''];
    $params['hash'] = easebuzz_request_hash($hashParams, trim($g['key_secret']));

    // Strip empty values from POST body (Easebuzz lib does the same)
    $body = array_filter($params, function ($v) { return $v !== '' && $v !== null; });

    $url = easebuzz_base_url($g['mode']) . 'payment/initiateLink';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($body),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
        ],
    ]);
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    $json = json_decode($raw ?: '', true);
    if ($code < 200 || $code >= 300 || !is_array($json)) {
        return ['ok' => false, 'error' => $err ?: ('Easebuzz HTTP ' . $code . ': ' . substr((string)$raw, 0, 200)), 'raw' => $raw];
    }
    // Success: { "status": 1, "data": "<access_key>" }
    // Failure: { "status": 0, "data": "<error message or object>" } or {"error":...}
    $status = (int)($json['status'] ?? 0);
    if ($status !== 1 || empty($json['data']) || !is_string($json['data'])) {
        $msg = is_string($json['data'] ?? null) ? $json['data'] : json_encode($json);
        return ['ok' => false, 'error' => $msg, 'raw' => $json];
    }

    $accessKey   = $json['data'];
    $redirectUrl = easebuzz_base_url($g['mode']) . 'pay/' . rawurlencode($accessKey);

    return [
        'ok'           => true,
        'access_key'   => $accessKey,
        'redirect_url' => $redirectUrl,
        'txnid'        => $txnid,
        'raw'          => $json,
    ];
}

/**
 * Server-side verification of a transaction (defence-in-depth after callback).
 * POST /transaction/v2/retrieve with hash sequence: key|txnid|SALT
 *
 * @return array {ok, paid, data|error}
 */
function easebuzz_fetch_transaction($g, $txnid) {
    if (empty($g['key_id']) || empty($g['key_secret'])) {
        return ['ok' => false, 'error' => 'Easebuzz not configured.'];
    }
    $key  = trim($g['key_id']);
    $salt = trim($g['key_secret']);

    $hash = strtolower(hash('sha512', $key . '|' . $txnid . '|' . $salt));
    $body = http_build_query(['key' => $key, 'txnid' => $txnid, 'hash' => $hash]);

    $url = easebuzz_dashboard_url($g['mode']) . 'transaction/v2/retrieve';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
    ]);
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode($raw ?: '', true);
    if ($code < 200 || $code >= 300 || !is_array($json)) {
        return ['ok' => false, 'error' => 'Easebuzz verify HTTP ' . $code, 'raw' => $raw];
    }
    // Successful transaction:  data.status === 'success' (also: 'userCancelled','failure','pending','dropped'...)
    $data   = $json['data'] ?? [];
    $status = is_array($data) ? strtolower((string)($data['status'] ?? '')) : strtolower((string)$data);
    $paid   = ($status === 'success');
    return ['ok' => (int)($json['status'] ?? 0) === 1, 'paid' => $paid, 'status' => $status, 'data' => $data];
}
