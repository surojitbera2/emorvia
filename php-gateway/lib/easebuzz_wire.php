<?php
// =====================================================================
// Easebuzz Wire — UPI / IMPS / NEFT Payouts (TO listeners)
// =====================================================================
//
// MODE: Manual-dashboard workflow
// -----------------------------------------------------------------
// The Easebuzz Wire **API** is not publicly documented — Easebuzz
// shares it privately after activation. Until those docs are obtained
// from Easebuzz support, this integration runs in *manual* mode:
//
//   1. Admin clicks "Pay via Easebuzz" on a pending listener row.
//   2. PHP opens the Easebuzz Wire dashboard in a new tab with the
//      payout amount + listener UPI VPA pre-filled (where supported).
//   3. Admin completes the UPI payout inside Easebuzz Wire dashboard.
//   4. Admin returns to PHP admin, pastes the UTR / Bank Reference,
//      and clicks "Mark Paid".
//   5. PHP records the payout locally and notifies the Node.js backend
//      so the listener's wallet/earnings are marked paid in MongoDB.
//
// When the Wire API spec becomes available, fill in ebw_payout_transfer()
// below and switch admin/payouts.php to call that instead of the manual
// confirmation flow. The notify_node helper already returns the same
// shape the Cashfree integration uses, so swapping is straightforward.
//
// Credentials are stored in `gateways` table under name="easebuzz_wire":
//   key_id     → (future) Wire API Key / Client ID
//   key_secret → (future) Wire API Secret / Salt
//   mode       → 'test' or 'live'
// =====================================================================

function ebw_dashboard_url($mode = 'live') {
    // Easebuzz Wire dashboard. Admin logs in here to send payouts manually.
    return $mode === 'live'
        ? 'https://wire.easebuzz.in/'
        : 'https://testwire.easebuzz.in/';
}

/**
 * Notify the Node.js backend that an Easebuzz Wire payout has been
 * completed manually (after admin enters UTR in the PHP admin).
 *
 * Uses the same /api/ext-payout/complete endpoint that the Cashfree
 * integration uses — Node.js doesn't care which gateway sent the money,
 * it just marks the payout as completed in MongoDB.
 *
 * @return array {ok, http, response, error}
 */
function ebw_payout_notify_node($providerId, $amount, $transferId, $utr, $status, $note = '') {
    $cfg = node_config();
    if (!$cfg['base_url'] || !$cfg['shared_secret']) {
        return ['ok' => false, 'error' => 'Node.js gateway not configured in admin settings'];
    }
    $payload = json_encode([
        'providerId'   => $providerId,
        'amount'       => (float)$amount,
        'transferId'   => $transferId,
        'cfTransferId' => $utr, // re-using key name; Node treats it as opaque external id
        'status'       => $status,
        'note'         => $note ?: ('Easebuzz Wire (manual) · UTR ' . $utr),
        'ts'           => time(),
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

// ---------------------------------------------------------------------
// Future API integration (stub) — fill in once Wire API docs are obtained.
// ---------------------------------------------------------------------
function ebw_base_url($mode) {
    return $mode === 'live'
        ? 'https://wire.easebuzz.in/'       // placeholder
        : 'https://testwire.easebuzz.in/';  // placeholder
}

function ebw_payout_transfer($g, $transferId, $amount, $vpa, $beneficiaryName, $beneficiaryId, $remarks = '') {
    return [
        'ok'    => false,
        'error' => 'Easebuzz Wire programmatic API is not yet implemented. Use the manual confirmation flow in admin/payouts.php.',
    ];
}

function ebw_payout_get_status($g, $transferId) {
    return ['ok' => false, 'error' => 'Easebuzz Wire programmatic API is not yet implemented.'];
}
