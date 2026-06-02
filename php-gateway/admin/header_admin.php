<?php
start_session_once();
$active = basename($_SERVER['SCRIPT_NAME'] ?? '');
$adminUser = $_SESSION['admin_user'] ?? '';
$initial = strtoupper(substr($adminUser, 0, 1) ?: 'A');
?><!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin · BongoBandhu Payment Gateway</title>
<link rel="stylesheet" href="../assets/style.css">
</head>
<body class="admin">
<aside class="sidebar">
  <div class="brand-row">
    <div class="brand-logo">BB</div>
    <div class="brand-text">BB Pay<small>Admin Panel</small></div>
  </div>
  <?php if ($adminUser): ?>
  <nav>
    <a href="index.php"     class="<?= $active === 'index.php' ? 'active' : '' ?>">Dashboard</a>
    <a href="gateways.php"  class="<?= $active === 'gateways.php' ? 'active' : '' ?>">Gateways</a>
    <a href="settings.php"  class="<?= $active === 'settings.php' ? 'active' : '' ?>">Node.js Settings</a>
    <a href="payments.php"  class="<?= $active === 'payments.php' ? 'active' : '' ?>">Payments</a>
    <a href="password.php"  class="<?= $active === 'password.php' ? 'active' : '' ?>">Password</a>
  </nav>
  <div class="nav-bottom">
    <div class="user-chip">
      <span class="avatar"><?= h($initial) ?></span>
      <div>
        <div><?= h($adminUser) ?></div>
        <a href="logout.php">Sign out</a>
      </div>
    </div>
  </div>
  <?php endif; ?>
</aside>
<main class="content">
