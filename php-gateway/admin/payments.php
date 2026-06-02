<?php
require_once __DIR__ . '/../config.php';
admin_require_login();
$q = trim($_GET['q'] ?? '');
$where = '';
$params = [];
if ($q !== '') { $where = 'WHERE order_id LIKE ?'; $params[] = '%' . $q . '%'; }
$st = db()->prepare("SELECT * FROM payments $where ORDER BY id DESC LIMIT 200");
$st->execute($params);
$rows = $st->fetchAll();
include __DIR__ . '/header_admin.php';
?>
<h1 class="page-title">Payments <small>All payment attempts across gateways</small></h1>
<div class="card">
  <div class="row-between" style="margin-bottom:8px">
    <h2>Order history</h2>
    <form class="search" method="get">
      <input type="text" name="q" value="<?= h($q) ?>" placeholder="Search order ID…" />
      <button class="btn">Search</button>
    </form>
  </div>
  <table class="table">
    <thead><tr><th>Order ID</th><th>Amount</th><th>Gateway</th><th>Payment ID</th><th>Status</th><th>Notified</th><th>Time</th></tr></thead>
    <tbody>
    <?php if (!$rows): ?><tr><td colspan="7" class="muted center">No payments found.</td></tr><?php endif; ?>
    <?php foreach ($rows as $r): ?>
      <tr>
        <td class="mono"><?= h($r['order_id']) ?></td>
        <td>₹ <?= h(number_format((float)$r['amount'], 2)) ?></td>
        <td><?= h($r['gateway'] ?: '—') ?></td>
        <td class="mono"><?= h($r['gateway_payment_id'] ?: '—') ?></td>
        <td><span class="badge <?= h($r['status']) ?>"><?= h(strtoupper($r['status'])) ?></span></td>
        <td><?= ((int)$r['notified'] === 1) ? '✓' : '—' ?></td>
        <td class="muted"><?= h($r['created_at']) ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php include __DIR__ . '/footer_admin.php'; ?>
