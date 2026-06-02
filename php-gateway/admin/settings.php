<?php
require_once __DIR__ . '/../config.php';
admin_require_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    setting_set('node_base_url',      trim($_POST['node_base_url'] ?? ''));
    $sec = trim($_POST['node_shared_secret'] ?? '');
    if ($sec !== '' && strpos($sec, '*****') !== 0) {
        setting_set('node_shared_secret', $sec);
    }
    setting_set('node_return_url',    trim($_POST['node_return_url'] ?? ''));
    flash_set('Node.js settings saved.', 'success');
    header('Location: settings.php');
    exit;
}

$baseUrl  = setting_get('node_base_url', '');
$secret   = setting_get('node_shared_secret', '');
$retUrl   = setting_get('node_return_url', '');
$secMask  = $secret ? '*****' . substr($secret, -4) : '';

include __DIR__ . '/header_admin.php';
?>
<h1 class="page-title">Node.js Settings <small>Bridge configuration to the BongoBandhu wallet backend</small></h1>
<div class="card">
  <p class="muted">Bridge to the Node.js wallet backend. The Shared Secret here must match the value in the Node.js admin panel (Payments → External Gateway).</p>
  <?php $f = flash_pop(); if ($f): ?><div class="flash <?= h($f['type']) ?>"><?= h($f['msg']) ?></div><?php endif; ?>
  <form method="post" class="form">
    <label><span>Node.js Base URL</span>
      <input type="text" name="node_base_url" value="<?= h($baseUrl) ?>" placeholder="https://api.yourdomain.com" required />
      <small>No trailing slash. Just the base URL of your Node.js backend.</small>
    </label>
    <label><span>Shared Secret</span>
      <input type="text" name="node_shared_secret" value="<?= h($secMask) ?>" placeholder="Paste the same secret as configured in Node admin" />
      <small>Used to authenticate order lookups and HMAC-sign payment callbacks. Leave masked value unchanged to keep current.</small>
    </label>
    <label><span>Custom Return URL <span class="muted">(optional)</span></span>
      <input type="text" name="node_return_url" value="<?= h($retUrl) ?>" placeholder="Leave empty to use {Base}/api/ext-payment/return" />
      <small>Where the user is sent after payment. Defaults to Node.js return endpoint.</small>
    </label>
    <button class="btn primary">Save</button>
  </form>
</div>
<?php include __DIR__ . '/footer_admin.php'; ?>
