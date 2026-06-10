<?php
// =====================================================================
// Easebuzz Wire — UPI / IMPS / NEFT Payouts (TO listeners)
// =====================================================================
//
// !!! IMPLEMENTATION PENDING !!!
//
// Easebuzz Wire API docs are NOT publicly available — they are shared
// privately with merchants by Easebuzz support after Wire is activated
// on your account.
//
// Once you obtain the docs (or a working cURL/Postman sample), fill in
// the functions below. The skeleton matches the same shape used by the
// Cashfree Payouts integration (see lib/cashfree_payouts.php) so it can
// plug into admin/payouts.php with minimal changes.
//
// What's needed to finish this file:
//   1. Wire API base URLs (test + live)
//   2. Authentication: header names (e.g. x-api-key / Bearer) or
//      hash-based signing (sequence + algo)
//   3. POST endpoint for creating a UPI transfer
//   4. Request payload shape (beneficiary, amount, transfer_id, etc.)
//   5. Response shape (status codes that mean success / pending / failed)
//
// Credentials are already wired into the admin UI under name="easebuzz_wire":
//   key_id     → Wire API Key / Client ID
//   key_secret → Wire API Secret / Salt
//   mode       → 'test' or 'live'
//
// =====================================================================

function ebw_base_url($mode) {
    // TODO: replace once Easebuzz Wire docs are obtained.
    return $mode === 'live'
        ? 'https://wire.easebuzz.in/'       // placeholder
        : 'https://testwire.easebuzz.in/';  // placeholder
}

/**
 * Initiate a UPI payout to a listener.
 *
 * @param array  $g            gateway row (mode, key_id, key_secret)
 * @param string $transferId   unique transfer id (alphanumeric, ≤40 chars)
 * @param float  $amount       INR
 * @param string $vpa          beneficiary UPI VPA (e.g. "name@upi")
 * @param string $beneficiaryName
 * @param string $beneficiaryId
 * @param string $remarks
 * @return array {ok, status, transfer_id, ebw_transfer_id, error, raw}
 */
function ebw_payout_transfer($g, $transferId, $amount, $vpa, $beneficiaryName, $beneficiaryId, $remarks = '') {
    return [
        'ok'    => false,
        'error' => 'Easebuzz Wire integration is not yet implemented. '
                 . 'Please provide Wire API docs to the admin developer to enable this feature.',
    ];
}

function ebw_payout_get_status($g, $transferId) {
    return ['ok' => false, 'error' => 'Easebuzz Wire integration is not yet implemented.'];
}
