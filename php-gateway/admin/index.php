<?php
require_once __DIR__ . '/../config.php';
admin_require_login();
$totalPayments = (int) db()->query("SELECT COUNT(*) FROM payments")->fetchColumn();
$successCount  = (int) db()->query("SELECT COUNT(*) FROM payments WHERE status='success'")->fetchColumn();
$failedCount   = (int) db()->query("SELECT COUNT(*) FROM payments WHERE status='failed'")->fetchColumn();
$pendingCount  = (int) db()->query("SELECT COUNT(*) FROM payments WHERE status='pending'")->fetchColumn();
$totalAmount   = (float) db()->query("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='success'")->fetchColumn();
$recent = db()->query("SELECT * FROM payments ORDER BY id DESC LIMIT 20")->fetchAll();
include __DIR__ . '/header_admin.php';
?>
<h1 class="page-title">Dashboard <small>Recent payment activity and totals</small></h1>
<div class="grid grid-4">
  <div class="stat acc"><div class="label">Total Orders</div><div class="value"><?= $totalPayments ?></div></div>
  <div class="stat ok"><div class="label">Successful</div><div class="value"><?= $successCount ?></div></div>
  <div class="stat warn"><div class="label">Pending</div><div class="value"><?= $pendingCount ?></div></div>
  <div class="stat err"><div class="label">Failed</div><div class="value"><?= $failedCount ?></div></div>
</div>
<div class="card" style="margin-top:18px">
  <div class="row-between" style="margin-bottom:8px"><h2>Recent Payments</h2>
    <div class="muted" style="font-size:13px"><strong style="color:var(--ok)">₹ <?= number_format($totalAmount, 2) ?></strong> received total</div>
  </div>
  <table class="table">
    <thead><tr><th>Order ID</th><th>Amount</th><th>Gateway</th><th>Status</th><th>Notified</th><th>Time</th></tr></thead>
    <tbody>
    <?php if (!$recent): ?>
      <tr><td colspan="6" class="muted center">No payments yet.</td></tr>
    <?php endif; ?>
    <?php foreach ($recent as $r): ?>
      <tr>
        <td class="mono"><?= h($r['order_id']) ?></td>
        <td>₹ <?= h(number_format((float)$r['amount'], 2)) ?></td>
        <td><?= h($r['gateway'] ?: '—') ?></td>
        <td><span class="badge <?= h($r['status']) ?>"><?= h(strtoupper($r['status'])) ?></span></td>
        <td><?= ((int)$r['notified'] === 1) ? '✓' : '—' ?></td>
        <td class="muted"><?= h($r['created_at']) ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php include __DIR__ . '/footer_admin.php'; ?>
