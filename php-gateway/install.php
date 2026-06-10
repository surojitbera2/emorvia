<?php
require_once __DIR__ . '/config.php';

// One-time installer. Visit https://your-host/payment/install.php once.

try {
    $pdo = db();

    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        k VARCHAR(64) PRIMARY KEY,
        v TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS gateways (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(32) UNIQUE NOT NULL,
        enabled TINYINT(1) DEFAULT 0,
        mode VARCHAR(8) DEFAULT 'test',
        key_id VARCHAR(255) DEFAULT '',
        key_secret VARCHAR(255) DEFAULT '',
        webhook_secret VARCHAR(255) DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(64) UNIQUE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(8) DEFAULT 'INR',
        gateway VARCHAR(32) DEFAULT '',
        gateway_order_id VARCHAR(128) DEFAULT '',
        gateway_payment_id VARCHAR(128) DEFAULT '',
        status VARCHAR(32) DEFAULT 'pending',
        notified TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Seed default admin if none exists
    $cnt = (int)$pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
    if ($cnt === 0) {
        $st = $pdo->prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)');
        $st->execute([DEFAULT_ADMIN_USER, password_hash(DEFAULT_ADMIN_PASS, PASSWORD_BCRYPT)]);
    }

    // Seed gateway rows (disabled by default).
    // 'cashfree_payout' is a separate row because Payouts uses different API keys than PG.
    foreach (['cashfree', 'razorpay', 'cashfree_payout', 'easebuzz', 'easebuzz_wire'] as $g) {
        if (!gateway_get($g)) {
            gateway_save($g, ['enabled' => 0, 'mode' => 'test', 'key_id' => '', 'key_secret' => '', 'webhook_secret' => '']);
        }
    }

    // Payouts table — tracks each Cashfree disbursement the admin sends.
    $pdo->exec("CREATE TABLE IF NOT EXISTS payouts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider_id VARCHAR(64) NOT NULL,
        provider_name VARCHAR(120) DEFAULT '',
        upi_id VARCHAR(120) DEFAULT '',
        amount DECIMAL(12,2) NOT NULL,
        transfer_id VARCHAR(64) UNIQUE NOT NULL,
        cf_transfer_id VARCHAR(64) DEFAULT '',
        status VARCHAR(32) DEFAULT 'pending',
        status_description TEXT,
        node_notified TINYINT(1) DEFAULT 0,
        node_response TEXT,
        admin_user VARCHAR(64) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_provider (provider_id),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    echo "<h2>BongoBandhu Payment Gateway — Install Successful</h2>";
    echo "<p>Database tables created. Default admin user:</p>";
    echo "<ul><li>Username: <b>" . h(DEFAULT_ADMIN_USER) . "</b></li><li>Password: <b>" . h(DEFAULT_ADMIN_PASS) . "</b></li></ul>";
    echo "<p><b>Important:</b> Delete <code>install.php</code> from the server after setup, and change the default admin password from the admin panel.</p>";
    echo '<p>Go to <a href="admin/login.php">Admin Login</a></p>';
} catch (Throwable $e) {
    http_response_code(500);
    echo "<h2>Install failed</h2><pre>" . h($e->getMessage()) . "</pre>";
}
