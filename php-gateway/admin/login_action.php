<?php
require_once __DIR__ . '/../config.php';
start_session_once();

$u = $_POST['username'] ?? '';
$p = $_POST['password'] ?? '';

$st = db()->prepare('SELECT * FROM admin_users WHERE username = ? LIMIT 1');
$st->execute([$u]);
$row = $st->fetch();
if (!$row || !password_verify($p, $row['password_hash'])) {
    flash_set('Invalid username or password.', 'error');
    header('Location: login.php');
    exit;
}
$_SESSION['admin_user'] = $row['username'];
$_SESSION['admin_id']   = $row['id'];
header('Location: index.php');
exit;
