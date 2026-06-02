<?php
// =====================================================================
// Cashfree Payouts V2 — UPI Standard Transfer
// Docs: https://www.cashfree.com/docs/api-reference/payouts/v2/transfers-v2/standard-transfer-v2
// =====================================================================
// Credentials are stored in the `gateways` table under name="cashfree_payout":
//   key_id        → X-Client-Id    (Payouts client id from Cashfree dashboard)
//   key_secret    → X-Client-Secret(Payouts client secret)
//   mode          → 'live' or 'test'
// =====================================================================

function cf_payout_base_url($mode) {
    return $mode === 'live'
        ? 'https://api.cashfree.com/payout'
        : 'https://sandbox.cashfree.com/payout';
}

function cf_payout_headers($g) {
    return [
        'Content-Type: application/json',
        'Accept: application/json',
        'x-api-version: 2024-01-01',
        'x-client-id: '     . $g['key_id'],
        'x-client-secret: ' . $g['key_secret'],
    ];
}

/**
 * Initiate a standard UPI transfer.
 *
 * @param array  $g            gateway row (mode, key_id, key_secret)
 * @param string $transferId   alphanumeric+underscore, max 40 chars, unique per merchant
 * @param float  $amount       INR, min 1.00
 * @param string $vpa          beneficiary UPI VPA (e.g. "name@upi")
 * @param string $beneficiaryName
 * @param string $beneficiaryId
 * @param string $remarks      optional
 * @return array {ok, status, cf_transfer_id, transfer_id, raw, error}
 */
function cf_payout_transfer($g, $transferId, $amount, $vpa, $beneficiaryName, $beneficiaryId, $remarks = '') {
    $url = cf_payout_base_url($g['mode']) . '/transfers';
    $payload = [
        'transfer_id'     => $transferId,
        'transfer_amount' => (float)$amount,
        'transfer_mode'   => 'upi',
        'beneficiary_details' => [
            'beneficiary_id'   => $beneficiaryId,
            'beneficiary_name' => preg_replace('/[^A-Za-z ]/', '', $beneficiaryName) ?: 'Listener',
            'beneficiary_instrument_details' => [
                'vpa' => $vpa,
            ],
        ],
    ];
    if ($remarks) {
        $payload['transfer_remarks'] = preg_replace('/[^A-Za-z0-9 ]/', '', $remarks);
    }
    $res = http_post_json($url, $payload, cf_payout_headers($g));

    if ($res['http'] < 200 || $res['http'] >= 300 || !is_array($res['json'])) {
        return [
            'ok' => false,
            'error' => $res['json']['message'] ?? $res['json']['error']['message'] ?? $res['body'] ?? 'Cashfree payout failed',
            'raw' => $res,
        ];
    }
    $status = strtoupper((string)($res['json']['status'] ?? ''));
    // Per Cashfree docs, success-equivalent states for a freshly-submitted UPI transfer:
    //   RECEIVED / SUCCESS / PENDING / QUEUED  → all mean the transfer is *not failed*.
    // Failure states: FAILED / REJECTED / REVERSED / MANUALLY_REJECTED
    $okStates = ['RECEIVED', 'SUCCESS', 'PENDING', 'QUEUED', 'APPROVAL_PENDING'];
    return [
        'ok'             => in_array($status, $okStates, true),
        'status'         => $status,
        'status_code'    => $res['json']['status_code'] ?? '',
        'description'    => $res['json']['status_description'] ?? '',
        'cf_transfer_id' => $res['json']['cf_transfer_id'] ?? '',
        'transfer_id'    => $res['json']['transfer_id'] ?? $transferId,
        'raw'            => $res['json'],
        'error'          => in_array($status, $okStates, true)
            ? null
            : ($res['json']['status_description'] ?? 'Transfer did not reach Cashfree successfully'),
    ];
}

/**
 * Check the status of a previously-submitted transfer.
 * GET /payout/transfers?transfer_id=<id>
 */
function cf_payout_get_status($g, $transferId) {
    $url = cf_payout_base_url($g['mode']) . '/transfers?transfer_id=' . rawurlencode($transferId);
    $res = http_get_json($url, cf_payout_headers($g));
    if ($res['http'] < 200 || $res['http'] >= 300) {
        return ['ok' => false, 'error' => $res['json']['message'] ?? 'Cashfree get-status failed', 'raw' => $res['json']];
    }
    return ['ok' => true, 'data' => $res['json']];
}

/**
 * Notify the Node.js backend that the payout has been completed.
 * Body is HMAC-SHA256 signed with the shared secret stored under setting
 * 'node_shared_secret' (already used for ext-payment callbacks).
 */
function cf_payout_notify_node($providerId, $amount, $transferId, $cfTransferId, $status) {
    $cfg = node_config();
    if (!$cfg['base_url'] || !$cfg['shared_secret']) {
        return ['ok' => false, 'error' => 'Node.js gateway not configured in admin settings'];
    }
    $payload = json_encode([
        'providerId'    => $providerId,
        'amount'        => (float)$amount,
        'transferId'    => $transferId,
        'cfTransferId'  => $cfTransferId,
        'status'        => $status,
        'note'          => 'Cashfree UPI · ' . $status,
        'ts'            => time(),
    ]);
    $sig = hash_hmac('sha256', $payload, $cfg['shared_secret']);
    $url = rtrim($cfg['base_url'], '/') . '/api/ext-payout/complete';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Gateway-Signature: ' . $sig,
        ],
    ]);
    $body = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    return [
        'ok'       => $http >= 200 && $http < 300,
        'http'     => $http,
        'response' => $body,
        'error'    => $err ?: ($http >= 400 ? $body : null),
    ];
}

/**
 * Fetch the list of providers with positive pending earnings from Node.js.
 * Uses the simpler X-Gateway-Secret header for GETs.
 */
function node_fetch_pending_payouts() {
    $cfg = node_config();
    if (!$cfg['base_url'] || !$cfg['shared_secret']) {
        return ['ok' => false, 'error' => 'Node.js gateway not configured in admin settings'];
    }
    $url = rtrim($cfg['base_url'], '/') . '/api/ext-payout/pending';
    $res = http_get_json($url, ['X-Gateway-Secret: ' . $cfg['shared_secret']]);
    if ($res['http'] !== 200 || !is_array($res['json'])) {
        return ['ok' => false, 'error' => 'Failed to fetch pending payouts (HTTP ' . $res['http'] . '): ' . ($res['json']['error'] ?? $res['body'])];
    }
    return ['ok' => true, 'list' => $res['json']];
}
