<?php
require_once __DIR__ . '/../config.php';
admin_require_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach (['cashfree', 'razorpay'] as $name) {
        $cur = gateway_get($name) ?: [];
        $incomingSecret = $_POST[$name . '_key_secret'] ?? '';
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

$cf = gateway_get('cashfree') ?: ['enabled' => 0, 'mode' => 'test', 'key_id' => '', 'key_secret' => '', 'webhook_secret' => ''];
$rp = gateway_get('razorpay') ?: ['enabled' => 0, 'mode' => 'test', 'key_id' => '', 'key_secret' => '', 'webhook_secret' => ''];
$mask = function ($s) { return $s ? '*****' . substr($s, -4) : ''; };
include __DIR__ . '/header_admin.php';
?>
<h1 class="page-title">Payment Gateways <small>Configure your Cashfree and Razorpay credentials</small></h1>
<div class="card">
  <p class="muted">Enable and configure your gateway credentials. Toggle either or both. When both are enabled, users will be shown a chooser screen.</p>
  <?php $f = flash_pop(); if ($f): ?><div class="flash <?= h($f['type']) ?>"><?= h($f['msg']) ?></div><?php endif; ?>
  <form method="post" class="form">
    <?php foreach ([['cashfree', 'Cashfree'], ['razorpay', 'Razorpay']] as [$n, $L]):
        $g = $n === 'cashfree' ? $cf : $rp; ?>
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
        <label><span>Key ID / App ID</span>
          <input type="text" name="<?= $n ?>_key_id" value="<?= h($g['key_id']) ?>" placeholder="<?= $n === 'cashfree' ? 'Cashfree App ID' : 'Razorpay Key ID' ?>" />
        </label>
        <label><span>Secret Key</span>
          <input type="text" name="<?= $n ?>_key_secret" value="<?= h($mask($g['key_secret'])) ?>" placeholder="<?= $n === 'cashfree' ? 'Cashfree Secret Key' : 'Razorpay Key Secret' ?>" />
          <small>Leave masked value unchanged to keep current secret.</small>
        </label>
        <label><span>Webhook Secret <span class="muted">(optional)</span></span>
          <input type="text" name="<?= $n ?>_webhook_secret" value="<?= h($mask($g['webhook_secret'])) ?>" placeholder="Used to verify direct gateway webhooks" />
        </label>
      </fieldset>
    <?php endforeach; ?>
    <button class="btn primary">Save Gateways</button>
  </form>
  <div class="info-box">
    <h3>Where to get keys</h3>
    <ul>
      <li><strong>Cashfree:</strong> Dashboard → Payment Gateway → Developers → API Keys (2FA required for production keys).</li>
      <li><strong>Razorpay:</strong> Dashboard → Account &amp; Settings → API Keys. Generate separately for Test and Live.</li>
    </ul>
  </div>
</div>
<?php include __DIR__ . '/footer_admin.php'; ?>
