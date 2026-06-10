<?php
require_once __DIR__ . '/config.php';

$orderId = isset($_GET['order_id']) ? trim($_GET['order_id']) : '';
$picked  = isset($_GET['gateway'])  ? trim($_GET['gateway'])  : '';

function render_error($title, $msg) {
    include __DIR__ . '/assets/header.php';
    echo '<div class="card error"><h2>' . h($title) . '</h2><p>' . h($msg) . '</p></div>';
    include __DIR__ . '/assets/footer.php';
    exit;
}

if ($orderId === '') {
    render_error('Invalid request', 'No order_id provided.');
}

// Fetch order details from Node.js
$nodeRes = node_fetch_order($orderId);
if (!$nodeRes['ok']) {
    render_error('Order not found', $nodeRes['error']);
}
$order = $nodeRes['order'];

// If already approved on Node side, jump to return
if (($order['status'] ?? '') === 'approved') {
    header('Location: ' . node_return_url($orderId, 'success'));
    exit;
}

// Insert/update local payments row
if (!payment_get($orderId)) {
    payment_create($orderId, (float)$order['amount'], '');
}

// Determine enabled gateways
$cf = gateway_get('cashfree');
$rp = gateway_get('razorpay');
$eb = gateway_get('easebuzz');
$cfEnabled = $cf && (int)$cf['enabled'] === 1 && $cf['key_id'] && $cf['key_secret'];
$rpEnabled = $rp && (int)$rp['enabled'] === 1 && $rp['key_id'] && $rp['key_secret'];
$ebEnabled = $eb && (int)$eb['enabled'] === 1 && $eb['key_id'] && $eb['key_secret'];

if (!$cfEnabled && !$rpEnabled && !$ebEnabled) {
    render_error('Payment unavailable', 'No payment gateway is enabled. Please contact the merchant.');
}

// Auto-pick single available gateway
if (!$picked) {
    $enabledList = [];
    if ($cfEnabled) $enabledList[] = 'cashfree';
    if ($rpEnabled) $enabledList[] = 'razorpay';
    if ($ebEnabled) $enabledList[] = 'easebuzz';
    if (count($enabledList) === 1) $picked = $enabledList[0];
}

// If user has picked a gateway, redirect to that flow
if ($picked === 'cashfree' && $cfEnabled) {
    $returnUrl = base_url() . '/callback/cashfree.php?order_id=' . rawurlencode($orderId);
    $customer = [
        'id'    => $order['customerId'],
        'name'  => $order['customerName'],
        'email' => $order['customerEmail'],
        'phone' => $order['customerPhone'],
    ];
    $r = cashfree_create_order($cf, $orderId, (float)$order['amount'], $customer, $returnUrl);
    if (!$r['ok']) render_error('Cashfree error', $r['error']);
    payment_update($orderId, ['gateway' => 'cashfree', 'gateway_order_id' => $r['cf_order_id']]);

    $paymentSessionId = $r['payment_session_id'];
    $mode = $cf['mode'];
    // Render Cashfree JS SDK page that redirects to hosted checkout
    ?>
    <!doctype html>
    <html><head><meta charset="UTF-8"><title>Redirecting to Cashfree…</title>
    <link rel="stylesheet" href="assets/style.css"></head>
    <body class="loading">
    <div class="loader"><div class="spinner"></div><p>Redirecting to Cashfree secure checkout…</p></div>
    <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
    <script>
      (function(){
        var cashfree = Cashfree({ mode: <?= json_encode($mode === 'live' ? 'production' : 'sandbox') ?> });
        cashfree.checkout({
          paymentSessionId: <?= json_encode($paymentSessionId) ?>,
          redirectTarget: '_self'
        }).then(function(){}).catch(function(err){
          document.body.innerHTML = '<div class="loader"><p>Error: ' + (err && err.message ? err.message : 'Failed to start payment') + '</p></div>';
        });
      })();
    </script></body></html>
    <?php
    exit;
}

if ($picked === 'razorpay' && $rpEnabled) {
    $r = razorpay_create_order($rp, $orderId, (float)$order['amount']);
    if (!$r['ok']) render_error('Razorpay error', $r['error']);
    payment_update($orderId, ['gateway' => 'razorpay', 'gateway_order_id' => $r['order_id']]);

    $callbackUrl = base_url() . '/callback/razorpay.php?order_id=' . rawurlencode($orderId);
    ?>
    <!doctype html>
    <html><head><meta charset="UTF-8"><title>Redirecting to Razorpay…</title>
    <link rel="stylesheet" href="assets/style.css"></head>
    <body class="loading">
    <div class="loader"><div class="spinner"></div><p>Opening Razorpay secure checkout…</p></div>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      var options = {
        key:        <?= json_encode($rp['key_id']) ?>,
        amount:     <?= json_encode($r['amount_paise']) ?>,
        currency:   "INR",
        name:       "BongoBandhu",
        description:"Wallet Recharge — Order " + <?= json_encode($orderId) ?>,
        order_id:   <?= json_encode($r['order_id']) ?>,
        callback_url: <?= json_encode($callbackUrl) ?>,
        redirect:   true,
        prefill: {
          name:    <?= json_encode($order['customerName']) ?>,
          email:   <?= json_encode($order['customerEmail']) ?>,
          contact: <?= json_encode($order['customerPhone']) ?>
        },
        notes: { order_id: <?= json_encode($orderId) ?> },
        theme: { color: "#9333EA" }
      };
      var rzp = new Razorpay(options);
      rzp.open();
    </script></body></html>
    <?php
    exit;
}

if ($picked === 'easebuzz' && $ebEnabled) {
    $callbackUrl = base_url() . '/callback/easebuzz.php?order_id=' . rawurlencode($orderId);
    $customer = [
        'name'  => $order['customerName']  ?? 'Customer',
        'email' => $order['customerEmail'] ?? 'noreply@example.com',
        'phone' => $order['customerPhone'] ?? '',
    ];
    $r = easebuzz_initiate_payment(
        $eb,
        $orderId,
        (float)$order['amount'],
        $customer,
        $callbackUrl, // surl
        $callbackUrl, // furl — Easebuzz POSTs to the same handler; we check status server-side
        'Wallet Recharge'
    );
    if (!$r['ok']) render_error('Easebuzz error', $r['error']);
    payment_update($orderId, ['gateway' => 'easebuzz', 'gateway_order_id' => $r['access_key']]);

    // Server-side redirect to Easebuzz hosted checkout
    header('Location: ' . $r['redirect_url']);
    exit;
}

// Otherwise — show gateway selection page
include __DIR__ . '/assets/header.php';
?>
<div class="card">
  <h1>Complete Your Payment</h1>
  <div class="amount-box">
    <div class="row"><span>Order ID</span><span class="mono"><?= h($orderId) ?></span></div>
    <div class="row"><span>Amount</span><strong>₹ <?= h(number_format((float)$order['amount'], 2)) ?></strong></div>
  </div>
  <p class="muted">Choose your preferred payment method:</p>
  <div class="gateway-list">
    <?php if ($cfEnabled): ?>
    <a class="gw-btn" href="pay.php?order_id=<?= h(urlencode($orderId)) ?>&gateway=cashfree">
      <div class="gw-name">Cashfree</div>
      <div class="gw-desc">UPI · Cards · Net Banking · Wallets</div>
    </a>
    <?php endif; ?>
    <?php if ($rpEnabled): ?>
    <a class="gw-btn" href="pay.php?order_id=<?= h(urlencode($orderId)) ?>&gateway=razorpay">
      <div class="gw-name">Razorpay</div>
      <div class="gw-desc">UPI · Cards · Net Banking · Wallets</div>
    </a>
    <?php endif; ?>
    <?php if ($ebEnabled): ?>
    <a class="gw-btn" href="pay.php?order_id=<?= h(urlencode($orderId)) ?>&gateway=easebuzz">
      <div class="gw-name">Easebuzz</div>
      <div class="gw-desc">UPI · Cards · Net Banking · Wallets</div>
    </a>
    <?php endif; ?>
  </div>
  <p class="tiny muted">Secure payment · 256-bit encryption</p>
</div>
<?php include __DIR__ . '/assets/footer.php';
