<?php
require_once __DIR__ . '/../config.php';
admin_require_login();
$msg = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $cur = $_POST['current'] ?? '';
    $new = $_POST['new'] ?? '';
    $confirm = $_POST['confirm'] ?? '';
    $st = db()->prepare('SELECT * FROM admin_users WHERE id = ? LIMIT 1');
    $st->execute([$_SESSION['admin_id']]);
    $row = $st->fetch();
    if (!$row || !password_verify($cur, $row['password_hash'])) {
        $msg = ['type' => 'error', 'text' => 'Current password is incorrect.'];
    } elseif (strlen($new) < 6) {
        $msg = ['type' => 'error', 'text' => 'New password must be at least 6 characters.'];
    } elseif ($new !== $confirm) {
        $msg = ['type' => 'error', 'text' => 'Passwords do not match.'];
    } else {
        $u = db()->prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?');
        $u->execute([password_hash($new, PASSWORD_BCRYPT), $_SESSION['admin_id']]);
        $msg = ['type' => 'success', 'text' => 'Password updated successfully.'];
    }
}
include __DIR__ . '/header_admin.php';
?>
<h1 class="page-title">Change Password <small>Keep your admin account secure</small></h1>
<div class="card">
  <?php if ($msg): ?><div class="flash <?= h($msg['type']) ?>"><?= h($msg['text']) ?></div><?php endif; ?>
  <form method="post" class="form">
    <label><span>Current Password</span><input type="password" name="current" required autocomplete="current-password" /></label>
    <label><span>New Password</span><input type="password" name="new" required autocomplete="new-password" /><small>At least 6 characters</small></label>
    <label><span>Confirm New Password</span><input type="password" name="confirm" required autocomplete="new-password" /></label>
    <button class="btn primary">Update Password</button>
  </form>
</div>
<?php include __DIR__ . '/footer_admin.php'; ?>
