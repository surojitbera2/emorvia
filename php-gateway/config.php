<?php
// =====================================================================
// BongoBandhu PHP Payment Gateway — config
// Edit DB credentials and run install.php once on first deployment.
// =====================================================================

// ---- Database (MySQL on cPanel shared hosting) ----
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_db_name');     // change me
define('DB_USER', 'your_db_user');     // change me
define('DB_PASS', 'your_db_password'); // change me

// ---- Default admin (created by install.php; change after first login) ----
define('DEFAULT_ADMIN_USER', 'admin');
define('DEFAULT_ADMIN_PASS', 'admin123');

// ---- Session ----
define('SESSION_NAME', 'bbpay_session');

// ---- Timezone ----
date_default_timezone_set('Asia/Kolkata');

// ---- Error reporting ----
// In production set to 0. Errors are always logged to PHP error log.
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/node_api.php';
require_once __DIR__ . '/lib/cashfree.php';
require_once __DIR__ . '/lib/razorpay.php';
