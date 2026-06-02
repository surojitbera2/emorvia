<?php
require_once __DIR__ . '/../config.php';
admin_require_login();
$page = 'payouts';

$g = gateway_get('cashfree_payout');
$node = node_config();
$flash_ok = '';
$flash_err = '';

// === Handle "Send Payout" submission ===
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'send') {
    $providerId   = trim($_POST['provider_id'] ?? '');
    $providerName = trim($_POST['provider_name'] ?? '');
    $upiId        = trim($_POST['upi_id'] ?? '');
    $amount       = (float)($_POST['amount'] ?? 0);

    if (!$g || empty($g['enabled']) || empty($g['key_id']) || empty($g['key_secret'])) {
        $flash_err = 'Cashfree Payout gateway is not enabled / configured. Configure it from Settings → Gateways.';
    } elseif (!$providerId || !$upiId || $amount <= 0) {
        $flash_err = 'Provider, UPI ID and amount are required.';
    } elseif (!preg_match('/^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/', $upiId)) {
        $flash_err = 'UPI VPA looks invalid (expected format: name@bank).';
    } else {
        // 1) Insert pending row
        $transferId = 'EMV' . date('YmdHis') . substr(bin2hex(random_bytes(3)), 0, 6);
        $pdo = db();
        $st = $pdo->prepare('INSERT INTO payouts (provider_id, provider_name, upi_id, amount, transfer_id, status, admin_user) VALUES (?, ?, ?, ?, ?, "initiating", ?)');
        $st->execute([$providerId, $providerName, $upiId, $amount, $transferId, $_SESSION['admin_user'] ?? '']);
        $payoutRowId = (int)$pdo->lastInsertId();

        // 2) Call Cashfree
        $beneId = 'EMV_' . preg_replace('/[^A-Za-z0-9]/', '', $providerId);
        $r = cf_payout_transfer($g, $transferId, $amount, $upiId, $providerName, $beneId, 'EMORVIA listener payout');

        $statusU = $r['ok'] ? ($r['status'] ?: 'RECEIVED') : 'FAILED';
        $desc    = $r['ok'] ? ($r['description'] ?: '') : ($r['error'] ?: 'failed');
        $cfTid   = $r['cf_transfer_id'] ?? '';

        $pdo->prepare('UPDATE payouts SET cf_transfer_id=?, status=?, status_description=? WHERE id=?')
            ->execute([$cfTid, $statusU, $desc, $payoutRowId]);

        if ($r['ok']) {
            // 3) Notify Node so it can mark the payout in MongoDB
            $n = cf_payout_notify_node($providerId, $amount, $transferId, $cfTid, $statusU);
            $pdo->prepare('UPDATE payouts SET node_notified=?, node_response=? WHERE id=?')
                ->execute([$n['ok'] ? 1 : 0, mb_substr((string)$n['response'], 0, 2000), $payoutRowId]);
            if ($n['ok']) {
                $flash_ok = "Payout of ₹{$amount} sent to {$upiId} (status: {$statusU}). Node updated.";
            } else {
                $flash_err = "Payout sent to Cashfree (status: {$statusU}) but Node update failed: " . ($n['error'] ?: 'unknown');
            }
        } else {
            $flash_err = 'Cashfree rejected the transfer: ' . $desc;
        }
    }
}

// === Pull pending payouts from Node ===
$pending = node_fetch_pending_payouts();

// === Local payout history ===
$pdo = db();
$history = $pdo->query('SELECT * FROM payouts ORDER BY created_at DESC LIMIT 100')->fetchAll(PDO::FETCH_ASSOC);

require __DIR__ . '/header_admin.php';
?>
<h1 class="page-title">Listener Payouts <small>Cashfree Payouts V2 — UPI transfers</small></h1>
<div class="card">
  <p class="muted">Configure Cashfree Payouts keys in <a href="gateways.php">Gateways → Cashfree Payouts V2</a>. Successful payouts automatically update EMORVIA backend.</p>

  <?php if ($flash_ok): ?><div class="alert alert-success"><?= h($flash_ok) ?></div><?php endif; ?>
  <?php if ($flash_err): ?><div class="alert alert-danger"><?= h($flash_err) ?></div><?php endif; ?>

  <?php if (!$g || empty($g['enabled']) || empty($g['key_id'])): ?>
    <div class="alert alert-warning">
      <strong>Cashfree Payouts not configured.</strong>
      Add your <em>Payouts</em> Client ID / Client Secret in
      <a href="settings.php">Settings → Gateways</a> and enable the
      <code>cashfree_payout</code> row.
    </div>
  <?php endif; ?>

  <h3>Pending payouts (from EMORVIA backend)</h3>
  <?php if (!$pending['ok']): ?>
    <div class="alert alert-danger"><?= h($pending['error']) ?></div>
  <?php elseif (empty($pending['list'])): ?>
    <p class="muted">No listener has pending earnings right now.</p>
  <?php else: ?>
    <table class="table">
      <thead>
        <tr><th>Listener</th><th>Mobile</th><th>UPI ID</th><th>Pending ₹</th><th>Action</th></tr>
      </thead>
      <tbody>
      <?php foreach ($pending['list'] as $row): ?>
        <tr>
          <td><?= h($row['name']) ?></td>
          <td><?= h($row['mobile']) ?></td>
          <td><?= h($row['upiId'] ?: '—') ?></td>
          <td>₹<?= number_format((float)$row['pendingAmount'], 2) ?></td>
          <td>
            <form method="post" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <input type="hidden" name="action" value="send">
              <input type="hidden" name="provider_id" value="<?= h($row['providerId']) ?>">
              <input type="hidden" name="provider_name" value="<?= h($row['name']) ?>">
              <input type="text"  name="upi_id" value="<?= h($row['upiId']) ?>" required placeholder="name@upi" style="width:160px">
              <input type="number" step="0.01" min="1" name="amount" value="<?= h($row['pendingAmount']) ?>" required style="width:90px">
              <button class="btn btn-primary" onclick="return confirm('Send ₹' + this.form.amount.value + ' to ' + this.form.upi_id.value + ' via Cashfree?')">Pay via Cashfree</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>

  <h3 style="margin-top:30px">Recent payouts</h3>
  <?php if (!$history): ?>
    <p class="muted">No payouts have been sent yet.</p>
  <?php else: ?>
    <table class="table">
      <thead><tr><th>When</th><th>Listener</th><th>UPI</th><th>₹</th><th>Status</th><th>Cashfree ID</th><th>Node</th></tr></thead>
      <tbody>
      <?php foreach ($history as $p): ?>
        <tr>
          <td><?= h($p['created_at']) ?></td>
          <td><?= h($p['provider_name']) ?></td>
          <td><?= h($p['upi_id']) ?></td>
          <td>₹<?= number_format((float)$p['amount'], 2) ?></td>
          <td>
            <?php
              $st = strtoupper($p['status']);
              $cls = in_array($st, ['SUCCESS','COMPLETED','RECEIVED','QUEUED','PENDING','APPROVAL_PENDING']) ? 'ok'
                   : (in_array($st, ['FAILED','REJECTED','REVERSED','MANUALLY_REJECTED','INITIATING']) ? 'fail' : 'warn');
            ?>
            <span class="badge badge-<?= h($cls) ?>"><?= h($st) ?></span>
            <?php if ($p['status_description']): ?><br><small class="muted"><?= h(mb_substr($p['status_description'],0,80)) ?></small><?php endif; ?>
          </td>
          <td><small><?= h($p['cf_transfer_id'] ?: '—') ?></small></td>
          <td><?= $p['node_notified'] ? '<span class="badge badge-ok">✓</span>' : '<span class="badge badge-fail">✗</span>' ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>
<?php require __DIR__ . '/footer_admin.php'; ?>
