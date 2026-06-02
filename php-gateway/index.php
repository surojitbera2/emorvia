<?php
require_once __DIR__ . '/config.php';

$orderId = isset($_GET['order_id']) ? trim($_GET['order_id']) : '';
if ($orderId === '') {
    header('Location: pay.php'); // will show error
    exit;
}
header('Location: pay.php?order_id=' . rawurlencode($orderId));
exit;
