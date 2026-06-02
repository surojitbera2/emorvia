<?php
require_once __DIR__ . '/../config.php';
start_session_once();
// If already logged in, go straight to dashboard
if (!empty($_SESSION['admin_user'])) {
    header('Location: index.php');
    exit;
}
$flash = flash_pop();
?><!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Sign In · BongoBandhu Payment Gateway</title>
<link rel="stylesheet" href="../assets/style.css">
</head>
<body class="auth-page">
<div class="auth-shell">
  <div class="auth-card">
    <div class="auth-brand">
      <div class="auth-logo">BB</div>
      <h1>Payment Gateway</h1>
      <p>Sign in to manage Cashfree &amp; Razorpay settings</p>
    </div>

    <?php if ($flash): ?>
      <div class="flash <?= h($flash['type']) ?>"><?= h($flash['msg']) ?></div>
    <?php endif; ?>

    <form method="post" action="login_action.php" class="form auth-form">
      <label>
        <span>Username</span>
        <input data-testid="admin-username" type="text" name="username" required autofocus autocomplete="username" placeholder="admin" />
      </label>
      <label>
        <span>Password</span>
        <input data-testid="admin-password" type="password" name="password" required autocomplete="current-password" placeholder="••••••••" />
      </label>
      <button data-testid="admin-signin" type="submit" class="btn primary block">Sign in</button>
    </form>

    <p class="auth-hint">Default: <code>admin</code> / <code>admin123</code> — please change after first login.</p>
  </div>
  <p class="auth-footer">&copy; <?= date('Y') ?> BongoBandhu · Secure Payments</p>
</div>
</body>
</html>
