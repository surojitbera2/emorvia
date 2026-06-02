# EMORVIA — Beginner VPS Deployment Guide

> Goal: take this codebase from your laptop / Emergent preview to a fresh Linux VPS that serves real users at `https://emorvia.in`.
> Tested on **Ubuntu 22.04 LTS** (works on 24.04 too).

You will end up with **three services** running side-by-side, all behind a single HTTPS domain:

| Service | Port (internal) | Role |
|---|---|---|
| Node.js backend (`/app/node-backend`) | 8001 | API + WebRTC + Socket.io |
| React frontend (`/app/frontend`, built) | 3000 *(or served as static files)* | UI |
| PHP gateway (`/app/php-gateway`) | 80/443 via PHP-FPM | Cashfree PG + Payouts, admin panel |

A single **Nginx** reverse-proxy routes:
- `https://emorvia.in/` → React static build
- `https://emorvia.in/api/*` + `/socket.io/*` → Node.js on `127.0.0.1:8001`
- `https://emorvia.in/pay/*` → PHP gateway

---

## 0. What you need before starting

1. A **VPS** with at least:
   - 2 vCPU
   - 4 GB RAM (1 GB will work for testing; 4 GB is comfortable)
   - 25 GB SSD
   - Ubuntu 22.04 LTS (cleanest install)
2. **SSH access** as a user with `sudo`
3. **A domain name** pointing at the VPS public IP (A record `emorvia.in → x.x.x.x`)
4. A computer with `ssh` (any Mac / Linux / Windows with PowerShell)

> **DNS check** before anything else:
> `dig +short emorvia.in` should print your VPS IP. If not, wait — DNS can take a few minutes.

---

## 1. SSH into the server and update it

```bash
ssh root@YOUR_SERVER_IP                    # or ssh ubuntu@... with key
apt update && apt upgrade -y
apt install -y curl wget git ufw build-essential
```

**Firewall (only open what we need):**
```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable
```

Create a regular user (avoid running everything as root):
```bash
adduser emorvia                            # set a password when prompted
usermod -aG sudo emorvia
su - emorvia                               # switch into the new user
```

From here on, run everything as `emorvia` (use `sudo` when needed).

---

## 2. Install Node.js, MongoDB, Nginx, PHP, MySQL

### 2.1 Node.js 20 (LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
sudo npm install -g yarn pm2
node --version    # should print v20.x
```

### 2.2 MongoDB 7
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-7.0.gpg
echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
mongosh --eval "db.runCommand({ping:1})"   # should print {ok: 1}
```

### 2.3 Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

### 2.4 PHP 8.2 + MySQL (for the PHP payment gateway)
```bash
sudo apt install -y php8.2-fpm php8.2-mysql php8.2-curl php8.2-mbstring php8.2-xml php8.2-zip \
                    mariadb-server
sudo systemctl enable --now php8.2-fpm mariadb
sudo mysql_secure_installation              # set a root password, answer Y to all
```

Create the gateway database:
```bash
sudo mysql -u root -p << 'SQL'
CREATE DATABASE IF NOT EXISTS emorvia_pay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'emorvia_pay'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON emorvia_pay.* TO 'emorvia_pay'@'localhost';
FLUSH PRIVILEGES;
SQL
```
**Save that password somewhere safe — you'll paste it into `php-gateway/config.php`.**

### 2.5 SSL / HTTPS (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
```
We'll run `certbot` *after* Nginx is configured (Step 5).

---

## 3. Pull your code to the server

```bash
cd ~
# Option A — Git (recommended)
git clone https://github.com/<your-org>/emorvia.git app
# Option B — scp from your laptop
#   scp -r ./bongobandhu-main.zip emorvia@SERVER:~ then unzip on the server.

cd ~/app
ls
# You should see: node-backend/  frontend/  php-gateway/  ...
```

---

## 4. Configure each service

### 4.1 Node.js backend

```bash
cd ~/app/node-backend
yarn install --production
nano .env
```
Paste (replace bracketed values):

```env
PORT=8001
MONGO_URL=mongodb://127.0.0.1:27017/emorvia

# Long random string — used to sign user/provider JWTs
JWT_SECRET=<openssl rand -hex 48>

# Admin login for /admin
ADMIN_USERNAME=admindash
ADMIN_PASSWORD="<your strong password>"

# Welcome credit (₹) granted on first OTP-verify per mobile (idempotent)
WELCOME_BONUS=50

# CORS — your final domain
CORS_ORIGIN=https://emorvia.in

# MessageCentral OTP (provided)
MC_CUSTOMER_ID=C-E2EDF3036EDD41B
MC_AUTH_TOKEN=eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDLUUyRURGMzAzNkVERDQxQiIsImlhdCI6MTc3ODk5NDc4NywiZXhwIjoxOTM2Njc0Nzg3fQ.w4WuuGZML4qciXn9oCtXNMRo7WmUQa4ZEO3AA3Nv-RTTEZZpsn_Jj5AT32Z7SuUAHQ2_yzqamCoEGimhNbOKHw

VAPID_SUBJECT=mailto:admin@emorvia.in
```

Tip for `JWT_SECRET`: run `openssl rand -hex 48` and paste the output.

Test it once in the foreground:
```bash
node server.js
# Expect: "EMORVIA backend on :8001"
# Open another terminal: curl -s http://127.0.0.1:8001/api/health  →  {"ok":true}
# Stop with Ctrl-C
```

Run it forever with **PM2**:
```bash
pm2 start server.js --name emorvia-backend
pm2 startup systemd -u emorvia --hp /home/emorvia
# Copy & run the command pm2 prints (sudo env PATH=... pm2 startup ...)
pm2 save
pm2 status                                  # should show online
```

### 4.2 React frontend (build once, serve as static files)

```bash
cd ~/app/frontend
nano .env
```
Set:
```env
REACT_APP_BACKEND_URL=https://emorvia.in
WDS_SOCKET_PORT=443
```

Build:
```bash
yarn install
yarn build
ls build/                                   # index.html + static/*
```
That `build/` folder is what Nginx will serve.

### 4.3 PHP gateway

```bash
cd ~/app/php-gateway
nano config.php
```
Edit the constants near the top:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'emorvia_pay');
define('DB_USER', 'emorvia_pay');
define('DB_PASS', 'CHANGE_ME_STRONG_PASSWORD');   // same password you used in Step 2.4
```

Run the one-time installer (creates tables + seeds gateway rows):
```bash
php install.php
# Output should end with "Install successful"
```

Set folder ownership so PHP-FPM can read/write:
```bash
sudo chown -R www-data:www-data ~/app/php-gateway
sudo chmod -R 755 ~/app/php-gateway
```

---

## 5. Nginx reverse proxy + HTTPS

```bash
sudo nano /etc/nginx/sites-available/emorvia
```

Paste:

```nginx
# Redirect plain HTTP → HTTPS (certbot adds this automatically too)
server {
    listen 80;
    server_name emorvia.in www.emorvia.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name emorvia.in www.emorvia.in;

    # Certbot will fill these in (Step 5.1)
    # ssl_certificate     /etc/letsencrypt/live/emorvia.in/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/emorvia.in/privkey.pem;

    client_max_body_size 25M;
    proxy_read_timeout 300;

    # 1) API + WebSocket → Node.js
    location ~ ^/(api|socket\.io)/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # 2) PHP gateway under /pay/
    location /pay/ {
        alias /home/emorvia/app/php-gateway/;
        index index.php;
        try_files $uri $uri/ /pay/index.php?$query_string;

        location ~ ^/pay/(.+\.php)$ {
            alias /home/emorvia/app/php-gateway/$1;
            fastcgi_pass unix:/run/php/php8.2-fpm.sock;
            fastcgi_index index.php;
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME $request_filename;
        }
    }

    # 3) React static build (default)
    root /home/emorvia/app/frontend/build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # Long-cache for hashed assets
    location ~* \.(?:css|js|woff2?|svg|png|jpg|jpeg|webp|ico)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
```

Enable + reload:
```bash
sudo ln -sf /etc/nginx/sites-available/emorvia /etc/nginx/sites-enabled/emorvia
sudo nginx -t                               # must say "syntax is ok"
sudo systemctl reload nginx
```

### 5.1 Get a real HTTPS certificate

```bash
sudo certbot --nginx -d emorvia.in -d www.emorvia.in
# Follow prompts: enter your email, agree to ToS, pick "Redirect" if asked.
```
Certbot will edit the `ssl_certificate*` lines for you and reload Nginx. From now on `https://emorvia.in` works.

Auto-renew is installed as a systemd timer; verify with:
```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run                # smoke test
```

---

## 6. Wire the PHP gateway to Node.js

Open `https://emorvia.in/pay/admin/login.php` in your browser:
- Default login: `admin` / `admin123` → **change it immediately** at *Password*.
- Go to **Node.js Settings**:
  - Base URL: `https://emorvia.in`
  - Shared Secret: paste a long random string (e.g. `openssl rand -hex 32`)
  - Save.

Then mirror the same secret into Node.js (from your laptop or server):
```bash
curl -s -X POST https://emorvia.in/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admindash","password":"<your admin pw>"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])"
# Copy the token, then:
TOKEN=<paste>
curl -s -X PUT https://emorvia.in/api/admin/ext-payment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"gatewayUrl":"https://emorvia.in/pay","sharedSecret":"<same secret as PHP>","label":"UPI / Cards / Net banking"}'
```

Or do it via Admin UI: log into `https://emorvia.in/admin/login` → **Payments → External Payment Gateway** → paste secret + URL → Save.

### 6.1 Add your Cashfree keys

In the **PHP** admin: **Gateways**:
- **Cashfree (Payments)** — Production App ID + Secret. Mode: `live`. **Enable.**
- **Cashfree Payouts V2** — Production X-Client-Id + X-Client-Secret (from Cashfree → Payouts → Developers). Mode: `live`. **Enable.**

> Cashfree **Payouts** keys are different from **Payments** keys — they live under a different tab in your Cashfree dashboard.

### 6.2 Test a payout end-to-end

1. In Node.js admin: `https://emorvia.in/admin/providers` — make sure at least one listener has a valid UPI ID and pending earnings.
2. In PHP admin: `https://emorvia.in/pay/admin/payouts.php` — you'll see the queue.
3. Click **Pay via Cashfree** on a row → confirm.
4. PHP calls Cashfree → on success, calls back Node → provider's `earnings` is decremented automatically.

---

## 7. Healthchecks + day-2 operations

```bash
# Node
pm2 status
pm2 logs emorvia-backend --lines 100

# Mongo
sudo systemctl status mongod
mongosh emorvia --eval "db.providers.countDocuments()"

# Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# PHP-FPM
sudo systemctl status php8.2-fpm
sudo tail -f /var/log/php8.2-fpm.log
```

**Restart anything cleanly:**
```bash
pm2 restart emorvia-backend           # after editing node-backend/.env
sudo systemctl reload nginx           # after editing /etc/nginx/sites-available/emorvia
sudo systemctl restart php8.2-fpm     # after PHP config changes
```

**Pulling new code from git:**
```bash
cd ~/app
git pull
# Backend
cd node-backend && yarn install --production && cd -
pm2 restart emorvia-backend
# Frontend (rebuild, no service restart needed)
cd frontend && yarn install && yarn build && cd -
```

**Daily Mongo backup (cron):**
```bash
sudo crontab -e
# add:
0 3 * * * mongodump --db emorvia --archive --gzip > /var/backups/emorvia-$(date +\%F).gz
```

---

## 8. Common pitfalls

| Symptom | Fix |
|---|---|
| `curl 127.0.0.1:8001/api/health` works but `https://emorvia.in/api/health` 502s | PM2 not running → `pm2 status`. Or Nginx user can't reach `127.0.0.1` → check `proxy_pass` line. |
| Socket.io disconnects every 60 s | Add `proxy_read_timeout 300;` (already in our config) |
| WebRTC video black on remote | UDP / STUN blocked. Open UDP `3478` and the wide TURN range. Use a TURN service for users behind strict NATs (e.g. Twilio / metered.ca). |
| Cashfree payouts says `IP_NOT_WHITELISTED` | Cashfree dashboard → Payouts → Developers → IP Whitelist → add your VPS IP. |
| Admin password change in `.env` not taking effect | If you ever set an admin password through the API, it's stored in Mongo and overrides the `.env`. Reset via mongosh: `db.settings.deleteOne({key:"adminCredentials"})`. |
| "MongoDB not authorised" | We did not enable auth; that's fine since Mongo binds to `127.0.0.1` only by default. **Never** expose port 27017 publicly. |
| 500 from `/pay/install.php` | PHP can't connect to MySQL — re-check `config.php` DB creds; verify `mariadb` is running. |

---

## 9. Test credentials (in `/app/memory/test_credentials.md`)

| Role | Mobile | OTP |
|---|---|---|
| Admin (Node.js) | username `admindash` | password from `.env` |
| Admin (PHP gateway) | `admin` / `admin123` | **change after first login!** |
| User test bypass | `7777777777` | `2411` |
| Listener test bypass | `6666666666` | `0401` |
| Listener (legacy pw) | `8000000001` | `pro123` |

> Bypass numbers skip MessageCentral (don't burn SMS credits during testing). Anyone else triggers a real SMS.

---

You're live! 🎉 Open `https://emorvia.in` on your phone, tap *Continue with mobile number*, complete OTP, and you should see the listener list. From the PHP admin (`/pay/admin`) you can now disburse listener earnings via Cashfree UPI in two clicks.
