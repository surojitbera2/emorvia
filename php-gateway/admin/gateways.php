<?php
require_once __DIR__ . '/../config.php';
admin_require_login();

$GATEWAYS = [
    ['cashfree',        'Cashfree (Payments)',  'App ID',         'Secret Key'],
    ['razorpay',        'Razorpay',             'Key ID',         'Key Secret'],
    ['easebuzz',        'Easebuzz (Payments)',  'Merchant Key',   'Salt'],
    ['cashfree_payout', 'Cashfree Payouts V2',  'X-Client-Id',    'X-Client-Secret'],
    ['easebuzz_wire',   'Easebuzz Wire (Payouts)', 'Wire API Key','Wire API Salt / Secret'],
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach ($GATEWAYS as [$name, ,]) {
        $cur = gateway_get($name) ?: [];
        $incomingSecret  = $_POST[$name . '_key_secret'] ?? '';
        $incomingWebhook = $_POST[$name . '_webhook_secret'] ?? '';
        gateway_save($name, [
            'enabled'        => !empty($_POST[$name . '_enabled']) ? 1 : 0,
            'mode'           => $_POST[$name . '_mode'] ?? 'test',
            'key_id'         => trim($_POST[$name . '_key_id'] ?? ''),
            'key_secret'     => (strpos($incomingSecret, '*****') === 0) ? ($cur['key_secret'] ?? '') : trim($incomingSecret),
            'webhook_secret' => (strpos($incomingWebhook, '*****') === 0) ? ($cur['webhook_secret'] ?? '') : trim($incomingWebhook),
        ]);
    }
    flash_set('Gateway settings saved.', 'success');
    header('Location: gateways.php');
    exit;
}

$gateways = [];
foreach ($GATEWAYS as [$name, ,]) {
    $gateways[$name] = gateway_get($name) ?: ['enabled' => 0, 'mode' => 'test', 'key_id' => '', 'key_secret' => '', 'webhook_secret' => ''];
}
$mask = function ($s) { return $s ? '*****' . substr($s, -4) : ''; };
include __DIR__ . '/header_admin.php';
?>
<h1 class="page-title">Payment Gateways <small>Cashfree (PG + Payouts) and Razorpay credentials</small></h1>
<div class="card">
  <p class="muted">Enable each gateway you want to use. <strong>Cashfree Payments</strong> handles incoming recharges; <strong>Cashfree Payouts V2</strong> uses a separate API key pair and is used for sending UPI payouts to listeners.</p>
  <?php $f = flash_pop(); if ($f): ?><div class="flash <?= h($f['type']) ?>"><?= h($f['msg']) ?></div><?php endif; ?>
  <form method="post" class="form">
    <?php foreach ($GATEWAYS as [$n, $L, $kLabel, $sLabel]):
        $g = $gateways[$n]; ?>
      <fieldset class="fs">
        <legend><?= h($L) ?></legend>
        <label class="check">
          <input type="checkbox" name="<?= $n ?>_enabled" value="1" <?= (int)$g['enabled'] === 1 ? 'checked' : '' ?> />
          Enable <?= h($L) ?>
        </label>
        <label><span>Mode</span>
          <select name="<?= $n ?>_mode">
            <option value="test" <?= $g['mode'] === 'test' ? 'selected' : '' ?>>Test / Sandbox</option>
            <option value="live" <?= $g['mode'] === 'live' ? 'selected' : '' ?>>Live / Production</option>
          </select>
        </label>
        <label><span><?= h($kLabel) ?></span>
          <input type="text" name="<?= $n ?>_key_id" value="<?= h($g['key_id']) ?>" placeholder="<?= h($kLabel) ?>" />
        </label>
        <label><span><?= h($sLabel) ?></span>
          <input type="text" name="<?= $n ?>_key_secret" value="<?= h($mask($g['key_secret'])) ?>" placeholder="<?= h($sLabel) ?>" />
          <small>Leave masked value unchanged to keep current secret.</small>
        </label>
        <?php if (!in_array($n, ['cashfree_payout', 'easebuzz_wire'], true)): ?>
        <label><span>Webhook Secret <span class="muted">(optional)</span></span>
          <input type="text" name="<?= $n ?>_webhook_secret" value="<?= h($mask($g['webhook_secret'])) ?>" placeholder="Used to verify direct gateway webhooks" />
        </label>
        <?php endif; ?>
        <?php if ($n === 'easebuzz_wire'): ?>
        <p class="muted" style="margin:6px 0 0">
          <strong>Note:</strong> Easebuzz Wire API docs are shared privately by Easebuzz. Save your credentials here;
          actual UPI payout calls become active once <code>lib/easebuzz_wire.php</code> is completed with the Wire API spec.
        </p>
        <?php endif; ?>
      </fieldset>
    <?php endforeach; ?>
    <button class="btn primary">Save Gateways</button>
  </form>
  <div class="info-box">
    <h3>Where to get keys</h3>
    <ul>
      <li><strong>Cashfree Payments (PG):</strong> Dashboard → Payment Gateway → Developers → API Keys (2FA required for production keys).</li>
      <li><strong>Cashfree Payouts V2:</strong> Dashboard → Payouts → Developers → API Keys. <em>Separate</em> from PG keys — different product.</li>
      <li><strong>Razorpay:</strong> Dashboard → Account &amp; Settings → API Keys. Generate separately for Test and Live.</li>
      <li><strong>Easebuzz Payments:</strong> Dashboard (<code>dashboard.easebuzz.in</code>) → Settings → API Keys → <em>Merchant Key</em> &amp; <em>Salt</em>. Use Test credentials on <code>testdashboard.easebuzz.in</code> first.</li>
      <li><strong>Easebuzz Wire (Payouts):</strong> Activate Wire from Easebuzz dashboard, then request API credentials &amp; docs from Easebuzz support (<code>integration@easebuzz.in</code>).</li>
    </ul>
  </div>
</div>
<?php include __DIR__ . '/footer_admin.php'; ?>
