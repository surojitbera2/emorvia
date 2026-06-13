<?php
require_once __DIR__ . '/../config.php';
admin_require_login();
$page = 'payouts';

$g      = gateway_get('cashfree_payout');
$ebw    = gateway_get('easebuzz_wire');
$node   = node_config();

$cfReady  = $g   && (int)$g['enabled']   === 1 && !empty($g['key_id'])  && !empty($g['key_secret']);
$ebwReady = $ebw && (int)$ebw['enabled'] === 1; // manual flow: credentials are optional for now

$flash_ok  = '';
$flash_err = '';

// === Schema migration (idempotent): add `provider` column to payouts table ===
try {
    db()->exec("ALTER TABLE payouts ADD COLUMN provider VARCHAR(32) DEFAULT 'cashfree'");
} catch (Throwable $e) { /* column already exists; ignore */ }

// === 1) Handle Cashfree payout submission ===
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'send') {
    $providerId   = trim($_POST['provider_id'] ?? '');
    $providerName = trim($_POST['provider_name'] ?? '');
    $upiId        = trim($_POST['upi_id'] ?? '');
    $amount       = (float)($_POST['amount'] ?? 0);

    if (!$cfReady) {
        $flash_err = 'Cashfree Payouts is not enabled / configured. Go to Settings → Gateways → Cashfree Payouts V2.';
    } elseif (!$providerId || !$upiId || $amount <= 0) {
        $flash_err = 'Provider, UPI ID and amount are required.';
    } elseif (!preg_match('/^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/', $upiId)) {
        $flash_err = 'UPI VPA looks invalid (expected format: name@bank).';
    } else {
        $transferId = 'EMV' . date('YmdHis') . substr(bin2hex(random_bytes(3)), 0, 6);
        $pdo = db();
        $st = $pdo->prepare('INSERT INTO payouts (provider_id, provider_name, upi_id, amount, transfer_id, status, admin_user, provider) VALUES (?, ?, ?, ?, ?, "initiating", ?, "cashfree")');
        $st->execute([$providerId, $providerName, $upiId, $amount, $transferId, $_SESSION['admin_user'] ?? '']);
        $payoutRowId = (int)$pdo->lastInsertId();

        $beneId = 'EMV_' . preg_replace('/[^A-Za-z0-9]/', '', $providerId);
        $r = cf_payout_transfer($g, $transferId, $amount, $upiId, $providerName, $beneId, 'EMORVIA listener payout');

        $statusU = $r['ok'] ? ($r['status'] ?: 'RECEIVED') : 'FAILED';
        $desc    = $r['ok'] ? ($r['description'] ?: '') : ($r['error'] ?: 'failed');
        $cfTid   = $r['cf_transfer_id'] ?? '';

        $pdo->prepare('UPDATE payouts SET cf_transfer_id=?, status=?, status_description=? WHERE id=?')
            ->execute([$cfTid, $statusU, $desc, $payoutRowId]);

        if ($r['ok']) {
            $n = cf_payout_notify_node($providerId, $amount, $transferId, $cfTid, $statusU);
            $pdo->prepare('UPDATE payouts SET node_notified=?, node_response=? WHERE id=?')
                ->execute([$n['ok'] ? 1 : 0, mb_substr((string)$n['response'], 0, 2000), $payoutRowId]);
            if ($n['ok']) {
                $flash_ok = "Cashfree payout of ₹{$amount} sent to {$upiId} (status: {$statusU}). Node updated.";
            } else {
                $flash_err = "Payout sent to Cashfree (status: {$statusU}) but Node update failed: " . ($n['error'] ?: 'unknown');
            }
        } else {
            $flash_err = 'Cashfree rejected the transfer: ' . $desc;
        }
    }
}

// === 2) Handle Easebuzz Wire MANUAL confirmation ===
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'easebuzz_manual') {
    $providerId   = trim($_POST['provider_id'] ?? '');
    $providerName = trim($_POST['provider_name'] ?? '');
    $upiId        = trim($_POST['upi_id'] ?? '');
    $amount       = (float)($_POST['amount'] ?? 0);
    $utr          = trim($_POST['utr'] ?? '');
    $notes        = trim($_POST['notes'] ?? '');
    $statusU      = strtoupper(trim($_POST['ebw_status'] ?? 'SUCCESS'));

    if (!$ebwReady) {
        $flash_err = 'Easebuzz Wire is not enabled. Go to Settings → Gateways → Easebuzz Wire (Payouts).';
    } elseif (!$providerId || !$upiId || $amount <= 0 || $utr === '') {
        $flash_err = 'Provider, UPI ID, amount and UTR / Bank Reference are required.';
    } elseif (!in_array($statusU, ['SUCCESS', 'PENDING', 'FAILED'], true)) {
        $flash_err = 'Invalid status. Choose SUCCESS / PENDING / FAILED.';
    } else {
        $transferId = 'EBW' . date('YmdHis') . substr(bin2hex(random_bytes(3)), 0, 6);
        $pdo = db();
        $st  = $pdo->prepare('INSERT INTO payouts (provider_id, provider_name, upi_id, amount, transfer_id, cf_transfer_id, status, status_description, admin_user, provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "easebuzz_wire")');
        $st->execute([
            $providerId, $providerName, $upiId, $amount, $transferId,
            $utr,
            $statusU,
            'Easebuzz Wire (manual) · UTR ' . $utr . ($notes ? ' · ' . $notes : ''),
            $_SESSION['admin_user'] ?? ''
        ]);
        $payoutRowId = (int)$pdo->lastInsertId();

        if ($statusU === 'SUCCESS') {
            $n = ebw_payout_notify_node($providerId, $amount, $transferId, $utr, $statusU, $notes ?: ('Easebuzz Wire (manual) · UTR ' . $utr));
            $pdo->prepare('UPDATE payouts SET node_notified=?, node_response=? WHERE id=?')
                ->execute([$n['ok'] ? 1 : 0, mb_substr((string)$n['response'], 0, 2000), $payoutRowId]);
            if ($n['ok']) {
                $flash_ok = "Easebuzz Wire payout of ₹{$amount} to {$upiId} recorded (UTR {$utr}). Listener earnings updated.";
            } else {
                $flash_err = "Easebuzz payout recorded locally (UTR {$utr}) but Node update failed: " . ($n['error'] ?: 'unknown');
            }
        } else {
            $flash_ok = "Easebuzz Wire payout recorded as {$statusU} (UTR {$utr}). Node was NOT notified (status not SUCCESS).";
        }
    }
}

// === Pull pending payouts from Node ===
$pending = node_fetch_pending_payouts();

// === Local payout history ===
$pdo     = db();
$history = $pdo->query('SELECT * FROM payouts ORDER BY created_at DESC LIMIT 100')->fetchAll(PDO::FETCH_ASSOC);

$ebwDashUrl = ebw_dashboard_url($ebw['mode'] ?? 'live');

require __DIR__ . '/header_admin.php';
?>
<h1 class="page-title">Listener Payouts <small>Send earnings to listeners via Cashfree (auto) or Easebuzz Wire (manual)</small></h1>
<div class="card">
  <p class="muted">
    Configure payout gateways in <a href="gateways.php">Gateways</a>. Cashfree Payouts uses API; Easebuzz Wire uses the dashboard manually then you record the UTR here.
  </p>

  <?php if ($flash_ok): ?><div class="alert alert-success"><?= h($flash_ok) ?></div><?php endif; ?>
  <?php if ($flash_err): ?><div class="alert alert-danger"><?= h($flash_err) ?></div><?php endif; ?>

  <?php if (!$cfReady && !$ebwReady): ?>
    <div class="alert alert-warning">
      <strong>No payout gateway is enabled.</strong>
      Enable at least one in <a href="gateways.php">Gateways</a>:
      <ul style="margin:6px 0 0 18px">
        <li><strong>Cashfree Payouts V2</strong> — automated UPI transfers via API.</li>
        <li><strong>Easebuzz Wire</strong> — manual UPI transfers via Easebuzz dashboard, recorded here.</li>
      </ul>
    </div>
  <?php else: ?>
    <div class="alert" style="background:#eef6ff;border:1px solid #cfe2ff;color:#0a3a8a;padding:10px;border-radius:6px;margin:8px 0 14px">
      <strong>Enabled payout methods:</strong>
      <?= $cfReady  ? '<span class="badge badge-ok">Cashfree (API)</span> ' : '' ?>
      <?= $ebwReady ? '<span class="badge badge-ok">Easebuzz Wire (manual)</span>' : '' ?>
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
        <tr><th>Listener</th><th>Mobile</th><th>UPI ID</th><th>Pending ₹</th><th style="min-width:380px">Action</th></tr>
      </thead>
      <tbody>
      <?php foreach ($pending['list'] as $row):
          $rid = 'r_' . preg_replace('/[^a-zA-Z0-9]/', '', (string)$row['providerId']);
      ?>
        <tr>
          <td><?= h($row['name']) ?></td>
          <td><?= h($row['mobile']) ?></td>
          <td><?= h($row['upiId'] ?: '—') ?></td>
          <td>₹<?= number_format((float)$row['pendingAmount'], 2) ?></td>
          <td>
            <div class="payout-actions" style="display:flex;flex-direction:column;gap:8px">

              <?php if ($cfReady): ?>
              <form method="post" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                <input type="hidden" name="action" value="send">
                <input type="hidden" name="provider_id"   value="<?= h($row['providerId']) ?>">
                <input type="hidden" name="provider_name" value="<?= h($row['name']) ?>">
                <input type="text"   name="upi_id" value="<?= h($row['upiId']) ?>" required placeholder="name@upi" style="width:160px">
                <input type="number" step="0.01" min="1" name="amount" value="<?= h($row['pendingAmount']) ?>" required style="width:90px">
                <button class="btn btn-primary" onclick="return confirm('Send ₹' + this.form.amount.value + ' to ' + this.form.upi_id.value + ' via Cashfree?')">Pay via Cashfree</button>
              </form>
              <?php endif; ?>

              <?php if ($ebwReady): ?>
              <details style="border:1px solid #e3d4ff;border-radius:6px;padding:6px 10px;background:#faf6ff">
                <summary style="cursor:pointer;font-weight:600;color:#6b21a8">Pay via Easebuzz (manual)</summary>
                <div style="margin-top:8px;font-size:0.9em">
                  <ol style="margin:4px 0 8px 18px;padding:0">
                    <li>Click <a href="<?= h($ebwDashUrl) ?>" target="_blank" rel="noopener">Open Easebuzz Wire Dashboard ↗</a></li>
                    <li>Send <strong>₹<?= number_format((float)$row['pendingAmount'], 2) ?></strong> to <strong><?= h($row['upiId'] ?: 'listener UPI') ?></strong> via UPI.</li>
                    <li>Copy the UTR / Bank Reference and paste below, then click Mark Paid.</li>
                  </ol>
                  <form method="post" style="display:grid;grid-template-columns:repeat(2, 1fr);gap:6px;align-items:end">
                    <input type="hidden" name="action" value="easebuzz_manual">
                    <input type="hidden" name="provider_id"   value="<?= h($row['providerId']) ?>">
                    <input type="hidden" name="provider_name" value="<?= h($row['name']) ?>">
                    <label style="display:flex;flex-direction:column;font-size:0.85em">UPI ID
                      <input type="text" name="upi_id" value="<?= h($row['upiId']) ?>" required placeholder="name@upi">
                    </label>
                    <label style="display:flex;flex-direction:column;font-size:0.85em">Amount ₹
                      <input type="number" step="0.01" min="1" name="amount" value="<?= h($row['pendingAmount']) ?>" required>
                    </label>
                    <label style="display:flex;flex-direction:column;font-size:0.85em">UTR / Bank Ref
                      <input type="text" name="utr" required placeholder="UTR / RRN / Bank txn id">
                    </label>
                    <label style="display:flex;flex-direction:column;font-size:0.85em">Status
                      <select name="ebw_status">
                        <option value="SUCCESS">SUCCESS</option>
                        <option value="PENDING">PENDING</option>
                        <option value="FAILED">FAILED</option>
                      </select>
                    </label>
                    <label style="grid-column:1/-1;display:flex;flex-direction:column;font-size:0.85em">Notes (optional)
                      <input type="text" name="notes" placeholder="e.g. paid via UPI app, txn time...">
                    </label>
                    <button class="btn btn-primary" style="grid-column:1/-1;background:#6b21a8;border-color:#6b21a8" onclick="return confirm('Record this payout as paid? This will update the listener balance.')">Mark Paid (Easebuzz)</button>
                  </form>
                </div>
              </details>
              <?php endif; ?>

            </div>
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
      <thead><tr><th>When</th><th>Via</th><th>Listener</th><th>UPI</th><th>₹</th><th>Status</th><th>Bank / Gateway ID</th><th>Node</th></tr></thead>
      <tbody>
      <?php foreach ($history as $p):
          $prov = $p['provider'] ?? 'cashfree';
          $provLabel = $prov === 'easebuzz_wire' ? 'Easebuzz Wire' : 'Cashfree';
      ?>
        <tr>
          <td><?= h($p['created_at']) ?></td>
          <td><span class="badge" style="background:<?= $prov === 'easebuzz_wire' ? '#ede9fe' : '#dcfce7' ?>;color:<?= $prov === 'easebuzz_wire' ? '#6b21a8' : '#166534' ?>"><?= h($provLabel) ?></span></td>
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
