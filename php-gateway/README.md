# BongoBandhu — PHP Payment Gateway (Cashfree + Razorpay)

A standalone PHP application that acts as a bridge between your Node.js BongoBandhu backend and the **Cashfree** & **Razorpay** payment gateways. The Node.js app redirects users here with only an `order_id`; this app handles the gateway flow and credits the wallet via a signed webhook.

## Architecture

```
User (App)
  │  Step 1: chooses "UPI / Net Banking / Card" on Recharge screen
  ▼
Node.js  (POST /api/ext-payment/initiate)
  │   creates pending Recharge, returns redirectUrl
  ▼
PHP Gateway  (pay.php?order_id=…)
  │   fetches order from Node (X-Gateway-Secret)
  │   creates order at Cashfree / Razorpay
  │   redirects to gateway hosted checkout
  ▼
User pays at gateway
  │
  ▼
Gateway callback → PHP (callback/cashfree.php or callback/razorpay.php)
  │   verifies via Get Order API / HMAC signature
  │   POSTs to Node: /api/ext-payment/callback  (HMAC-signed)
  │
  ▼
Node.js credits wallet → redirects user back to /wallet
```

## Requirements
- PHP **7.4+** with `pdo_mysql`, `curl`, `openssl` extensions.
- MySQL/MariaDB database.
- HTTPS domain (required by both gateways for live mode).

## Installation (cPanel shared hosting)

1. Upload the entire `php-gateway/` folder to a folder on your hosting, e.g. `public_html/payment/`.
   The final URL must match what you configured in the Node.js admin panel:
   `https://yourdomain.com/payment`
2. Create a MySQL database from cPanel and note: **DB name, username, password**.
3. Edit `config.php` and set `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`.
4. Open `https://yourdomain.com/payment/install.php` in your browser **once**.
   It will create all tables and seed a default admin user.
5. **Delete `install.php`** from the server.
6. Log in at `https://yourdomain.com/payment/admin/login.php`
   - Default username: `admin`
   - Default password: `admin123`
   - Immediately change the password from *Password* page.

## Configuration

### A. Node.js side (BongoBandhu admin app)
Go to **Admin → Payments & Billing → UPI / Net Banking / Card (External Gateway)** and set:

| Field | Value |
|------|-------|
| Enabled | ✅ |
| Display Label | "UPI / Net Banking / Card" (or your preferred text) |
| PHP Gateway URL | `https://yourdomain.com/payment` |
| Shared Secret | a long random string, e.g., `openssl rand -hex 32` |

Save. Copy the **Shared Secret** value — you'll paste the same value into PHP admin.

### B. PHP side
Log into the PHP admin and configure:

1. **Node.js Settings**
   - Node.js Base URL: `https://api.yourdomain.com` (your Node.js backend public URL — without trailing slash)
   - Shared Secret: paste the exact same secret as set on Node.js side.
   - Custom Return URL: leave empty unless you want users sent to a specific page after payment.

2. **Gateways → Cashfree**
   - Get keys from Cashfree Dashboard → *Payment Gateway* → *Developers* → *API Keys*.
   - Enable, choose Mode (Test / Live), paste **App ID** and **Secret Key**.

3. **Gateways → Razorpay**
   - Get keys from Razorpay Dashboard → *Account & Settings* → *API Keys*.
   - Enable, choose Mode (Test / Live), paste **Key ID** and **Key Secret**.

You can enable one or both. If both are enabled, the user sees a chooser screen.

## Test Flow

1. Log in to the BongoBandhu app as a user.
2. Open **Wallet → Recharge**.
3. Choose an amount, select **UPI / Net Banking / Card**.
4. Click **Pay**.
5. You'll be redirected to `https://yourdomain.com/payment?order_id=…` which auto-creates the gateway order and opens the hosted checkout.
6. Pay with Cashfree's or Razorpay's test card / UPI in sandbox mode.
7. On successful payment, you're redirected back to the wallet — balance updates automatically.

### Test cards / UPI
- **Cashfree sandbox**: `4111 1111 1111 1111`, exp `12/30`, CVV `123`, OTP `1111`. UPI VPA: `success@gocash`.
- **Razorpay test**: `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1111`. UPI VPA: `success@razorpay`.

## Security Notes
- The `Shared Secret` is the **only** thing protecting the order-lookup and callback APIs on Node.js. Keep it long and private. Rotate it if leaked.
- All callbacks from PHP → Node.js are HMAC-SHA256 signed using this secret (`X-Gateway-Signature` header) over the raw JSON body.
- All requests from PHP → Node.js for fetching order details use the secret as a `X-Gateway-Secret` header.
- Always run gateways in **Test mode** until your full end-to-end flow is verified.
- Delete `install.php` after first setup. The `lib/` folder is protected by `.htaccess`.
- Change the default admin password immediately.

## File Map
```
php-gateway/
├── config.php                # DB + default admin + includes
├── install.php               # one-time setup (delete after running)
├── index.php                 # entry — redirects to pay.php
├── pay.php                   # user-facing payment page
├── .htaccess                 # security
│
├── lib/
│   ├── db.php                # PDO + settings/gateways/payments helpers
│   ├── helpers.php           # http, session, hmac, escaping
│   ├── node_api.php          # talk to Node.js backend
│   ├── cashfree.php          # Cashfree PG (v2025-01-01) API client
│   └── razorpay.php          # Razorpay Orders API + signature verify
│
├── callback/
│   ├── cashfree.php          # Cashfree return URL handler
│   └── razorpay.php          # Razorpay POST callback handler
│
├── admin/
│   ├── login.php / logout.php / login_action.php
│   ├── index.php             # dashboard
│   ├── gateways.php          # configure Cashfree + Razorpay keys
│   ├── settings.php          # Node.js base URL + shared secret
│   ├── payments.php          # list all payment attempts
│   ├── password.php          # change admin password
│   └── header_admin.php / footer_admin.php
│
└── assets/
    ├── style.css
    ├── header.php
    └── footer.php
```

## Common Issues

| Symptom | Fix |
|---------|-----|
| "Node.js gateway not configured" | Set Node.js Base URL & Shared Secret in PHP admin → Settings |
| "Failed to fetch order (HTTP 401)" | Shared Secret mismatch between Node and PHP |
| "invalid signature" in Node logs after payment | Shared Secret was changed; re-save same secret on both sides |
| Cashfree "Invalid x-client-id" | Wrong keys for selected mode (test/live mix-up) |
| Razorpay BAD_REQUEST_ERROR on order create | Amount too low, or live keys used with un-activated account |
| Webhook never reaches Node | Both servers must be HTTPS-reachable from each other; check firewall |
