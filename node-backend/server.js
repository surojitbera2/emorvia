// Navya — Production Node.js + Express + Socket.io + Mongoose backend.
// Routes (all prefixed /api):
//   Auth:  POST /auth/register | /auth/login | /provider/login | /admin/login
//   User:  GET /me | GET /me/txns | DELETE /me | POST /recharge | POST /call/log
//   Public: GET /providers | GET /providers/:id | GET /payments/settings
//   Provider self: GET /provider/me | PATCH /provider/me | DELETE /provider/me | GET /provider/me/calls
//   Admin:
//     GET/POST/DELETE /admin/users | POST /admin/users/:id/adjust
//     GET/POST/PATCH/DELETE /admin/providers
//     GET /admin/recharges | POST /admin/recharges/:id/approve|reject
//     GET /admin/calls
//     PUT /admin/payments/settings
// Socket.io: register/call_request/call_accept/call_reject/webrtc_offer/answer/ice/call_end

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// const Razorpay = require("razorpay"); // REMOVED - Razorpay disabled
const webpush = require("web-push");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admindash";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin#2026*";
const WELCOME_BONUS = Number(process.env.WELCOME_BONUS || 50);

// ----- MessageCentral OTP (hard-coded credentials per user request) -----
const MC_CUSTOMER_ID = process.env.MC_CUSTOMER_ID || "C-E2EDF3036EDD41B";
const MC_AUTH_TOKEN = process.env.MC_AUTH_TOKEN || "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDLUUyRURGMzAzNkVERDQxQiIsImlhdCI6MTc3ODk5NDc4NywiZXhwIjoxOTM2Njc0Nzg3fQ.w4WuuGZML4qciXn9oCtXNMRo7WmUQa4ZEO3AA3Nv-RTTEZZpsn_Jj5AT32Z7SuUAHQ2_yzqamCoEGimhNbOKHw";
const MC_BASE = "https://cpaas.messagecentral.com";

const sendOtpSms = async (mobile) => {
  const url = `${MC_BASE}/verification/v3/send?countryCode=91&customerId=${encodeURIComponent(MC_CUSTOMER_ID)}&flowType=SMS&mobileNumber=${encodeURIComponent(mobile)}`;
  const r = await fetch(url, { method: "POST", headers: { authToken: MC_AUTH_TOKEN } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.responseCode !== 200) {
    const msg = data?.message || data?.data?.errorMessage || `OTP send failed (${r.status})`;
    throw new Error(msg);
  }
  return data.data?.verificationId || data.data?.transactionId;
};
const validateOtp = async (verificationId, code) => {
  const url = `${MC_BASE}/verification/v3/validateOtp?verificationId=${encodeURIComponent(verificationId)}&code=${encodeURIComponent(code)}`;
  const r = await fetch(url, { method: "GET", headers: { authToken: MC_AUTH_TOKEN } });
  const data = await r.json().catch(() => ({}));
  const status = data?.data?.verificationStatus;
  if (!r.ok || (status && status !== "VERIFICATION_COMPLETED")) {
    throw new Error(data?.message || "Invalid or expired OTP");
  }
  return true;
};

// ----- VAPID keys for Web Push (auto-generate + persist to file) -----
const VAPID_FILE = path.join(__dirname, "vapid.json");
let VAPID = null;
if (fs.existsSync(VAPID_FILE)) {
  try { VAPID = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8")); } catch { VAPID = null; }
}
if (!VAPID || !VAPID.publicKey || !VAPID.privateKey) {
  VAPID = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(VAPID, null, 2));
  console.log("Generated new VAPID keys");
}
webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@navyasocial.in", VAPID.publicKey, VAPID.privateKey);

const app = express();
app.set("trust proxy", true);  // Honour X-Forwarded-Proto from Nginx
app.use(cors({ origin: (process.env.CORS_ORIGIN || "*").split(","), credentials: true }));
app.use(express.json({ limit: "5mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ----- Static uploads (provider images) -----
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// Serve uploads under /api/uploads to work with Kubernetes ingress
app.use("/api/uploads", express.static(UPLOAD_DIR, { maxAge: "30d" }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = (file.originalname || "img").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-40);
    cb(null, `${Date.now()}_${crypto.randomBytes(4).toString("hex")}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB per file
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|jpg)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG/PNG/WEBP/GIF images allowed"));
  },
});

// ----- toJSON transform (expose `id`, hide `_id` / `__v` / `password`) -----
const transform = (_doc, ret) => {
  ret.id = ret._id?.toString();
  delete ret._id; delete ret.__v; delete ret.password;
  return ret;
};

const UserSchema = new mongoose.Schema({
  name: String,
  mobile: { type: String, unique: true, index: true },
  password: String,
  wallet: { type: Number, default: 0 },
  bonusBalance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { toJSON: { transform }, toObject: { transform } });

const ProviderSchema = new mongoose.Schema({
  name: String,
  mobile: { type: String, unique: true, index: true },
  password: String,
  avatar: String,
  avatars: { type: [String], default: [] },
  bio: String,
  age: Number,
  // Per-minute call charge (₹/min) — provider sets this from profile; admin can also override.
  perMinRate: { type: Number, default: 20 },
  // Optional per-provider payout share override (%). If null, falls back to global providerSharePct.
  sharePctOverride: { type: Number, default: null },
  rate: { type: Number, default: 0 }, // DEPRECATED — kept for back-compat
  online: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  languages: { type: [String], default: [] },
  earnings: { type: Number, default: 0 },
  daily: { type: Number, default: 0 },
  blockedUsers: { type: [String], default: [], index: true },
  status: { type: String, enum: ["pending", "active", "rejected"], default: "active", index: true },
  realMeetEnabled: { type: Boolean, default: false },
  videoCallEnabled: { type: Boolean, default: true },
}, { toJSON: { transform }, toObject: { transform } });

const TxnSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  type: { type: String, enum: ["credit", "debit"] },
  amount: Number,
  note: String,
  at: { type: Date, default: Date.now },
}, { toJSON: { transform }, toObject: { transform } });

const CallLogSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  providerId: { type: String, index: true },
  durationSec: Number,
  amount: Number,           // gross billed to user
  bonusUsed: { type: Number, default: 0 },  // portion paid from welcome credit
  realUsed: { type: Number, default: 0 },   // portion paid from real wallet (counts as revenue)
  providerEarnings: Number, // net credited to provider (from realUsed only)
  sharePct: Number,         // provider share percent at time of call
  autoCutoff: { type: Boolean, default: false },
  at: { type: Date, default: Date.now },
}, { toJSON: { transform }, toObject: { transform } });

const RechargeSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  amount: Number,
  refNote: String,
  status: { type: String, default: "pending", index: true },
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  at: { type: Date, default: Date.now },
}, { toJSON: { transform }, toObject: { transform } });

const SettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed,
}, { toJSON: { transform }, toObject: { transform } });

// OTP cache (verificationId per mobile) — Mongo so it survives restarts
const OtpSchema = new mongoose.Schema({
  mobile: { type: String, index: true },
  role: { type: String, enum: ["user", "provider"] },
  verificationId: String,
  at: { type: Date, default: Date.now, expires: 600 }, // auto-expire after 10 min
}, { toJSON: { transform }, toObject: { transform } });

// Web Push subscriptions
const PushSubSchema = new mongoose.Schema({
  ownerId: { type: String, index: true },
  ownerRole: { type: String, enum: ["user", "provider"], default: "provider" },
  endpoint: { type: String, unique: true, index: true },
  keys: { p256dh: String, auth: String },
  ua: String,
  at: { type: Date, default: Date.now },
}, { toJSON: { transform }, toObject: { transform } });

// Provider payouts — admin records each payout cycle; provider's pending balance resets to 0.
const PayoutSchema = new mongoose.Schema({
  providerId: { type: String, index: true },
  providerName: String,
  amount: { type: Number, required: true },     // ₹ paid out
  fromDate: Date,                                // payout cycle start (optional)
  toDate: Date,                                  // payout cycle end (optional)
  note: String,                                  // admin note / UTR / bank ref
  at: { type: Date, default: Date.now },
}, { toJSON: { transform }, toObject: { transform } });

const User = mongoose.model("User", UserSchema);
const Provider = mongoose.model("Provider", ProviderSchema);
const Txn = mongoose.model("Txn", TxnSchema);
const CallLog = mongoose.model("CallLog", CallLogSchema);
const Recharge = mongoose.model("Recharge", RechargeSchema);
const Settings = mongoose.model("Settings", SettingsSchema);
const Otp = mongoose.model("Otp", OtpSchema);
const PushSub = mongoose.model("PushSub", PushSubSchema);
const Payout = mongoose.model("Payout", PayoutSchema);

// ----- Auth -----
// Long-lived tokens — users/providers/admin stay logged in until they explicitly sign out.
const sign = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "365d" });
const auth = (role) => (req, res, next) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "no token" });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    if (role && p.role !== role) return res.status(403).json({ error: "forbidden" });
    req.user = p;
    next();
  } catch { res.status(401).json({ error: "invalid token" }); }
};

// ----- Routes -----
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ===== OTP-based auth (MessageCentral SMS) =====
const sanitizeMobile = (m) => String(m || "").replace(/\D/g, "").slice(-10);

// Send OTP to a mobile (works for both user and provider). The role determines
// which account type will be created on verify if it doesn't already exist.
app.post("/api/auth/otp/send", async (req, res) => {
  try {
    const mobile = sanitizeMobile(req.body?.mobile);
    const role = req.body?.role === "provider" ? "provider" : "user";
    if (mobile.length !== 10) return res.status(400).json({ error: "Enter a valid 10-digit mobile" });

    // Bypass OTP sending for test accounts
    const bypassAccounts = ["7777777777", "6666666666"];

    if (bypassAccounts.includes(mobile)) {
      // Bypass mode: skip actual SMS sending
      console.log(`Bypass OTP send for test account ${mobile}`);
      // Create a dummy verification record so the flow continues
      await Otp.findOneAndUpdate({ mobile, role }, { verificationId: `bypass_${mobile}`, at: new Date() }, { upsert: true });
      res.json({ ok: true });
    } else {
      // Normal mode: send actual OTP via MessageCentral
      const verificationId = await sendOtpSms(mobile);
      await Otp.findOneAndUpdate({ mobile, role }, { verificationId, at: new Date() }, { upsert: true });
      res.json({ ok: true });
    }
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Verify OTP — creates account if new, returns JWT.
app.post("/api/auth/otp/verify", async (req, res) => {
  try {
    const mobile = sanitizeMobile(req.body?.mobile);
    const code = String(req.body?.code || "").trim();
    const requestedRole = req.body?.role === "provider" ? "provider" : "user";
    if (!mobile || !code) return res.status(400).json({ error: "mobile and code required" });

    // Bypass OTP validation for test accounts
    const bypassAccounts = {
      "7777777777": { otp: "2411", role: "user" },
      "6666666666": { otp: "0401", role: "provider" }
    };

    const isBypass = bypassAccounts[mobile];

    if (isBypass) {
      if (code !== isBypass.otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }
      console.log(`Bypass OTP validated for ${mobile}`);
    } else {
      const rec = await Otp.findOne({ mobile, role: requestedRole });
      if (!rec) return res.status(400).json({ error: "OTP expired — request a new one" });
      await validateOtp(rec.verificationId, code);
      await Otp.deleteOne({ _id: rec._id });
    }

    let provider = null;
    if (requestedRole === "provider") {
      provider = await Provider.findOne({ mobile });
    } else {
      provider = await Provider.findOne({ mobile });
    }

    if (requestedRole === "provider" || provider) {
      let isNew = false;
      if (!provider) {
        provider = await Provider.create({
          mobile,
          name: `Listener${mobile.slice(-4)}`,
          status: "pending",
          online: false,
        });
        isNew = true;
      }
      const token = sign({ id: provider._id.toString(), role: "provider" });
      return res.json({ token, provider: provider.toJSON(), isNew });
    }

    let u = await User.findOne({ mobile });
    let isNew = false;
    if (!u) {
      u = await User.create({
        mobile,
        name: `User${mobile.slice(-4)}`,
        wallet: WELCOME_BONUS,
        bonusBalance: WELCOME_BONUS,
      });
      if (WELCOME_BONUS > 0) await Txn.create({ userId: u._id.toString(), type: "credit", amount: WELCOME_BONUS, note: "Welcome bonus (free trial credit)" });
      isNew = true;
    }
    const token = sign({ id: u._id.toString(), role: "user" });
    return res.json({ token, user: u.toJSON(), isNew });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// USER auth (legacy password-based — kept for backwards compat)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, mobile, password } = req.body || {};
    if (!mobile || !password) return res.status(400).json({ error: "mobile and password required" });
    if (await User.findOne({ mobile })) return res.status(409).json({ error: "mobile already registered" });
    const hash = await bcrypt.hash(password, 10);
    const u = await User.create({ name: name || `User${mobile.slice(-4)}`, mobile, password: hash, wallet: WELCOME_BONUS, bonusBalance: WELCOME_BONUS });
    if (WELCOME_BONUS > 0) await Txn.create({ userId: u._id.toString(), type: "credit", amount: WELCOME_BONUS, note: "Welcome bonus (free trial credit)" });
    const token = sign({ id: u._id.toString(), role: "user" });
    res.json({ token, user: u.toJSON() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { mobile, password } = req.body || {};
    const u = await User.findOne({ mobile });
    if (!u || !(await bcrypt.compare(password, u.password))) return res.status(401).json({ error: "invalid mobile or password" });
    const token = sign({ id: u._id.toString(), role: "user" });
    res.json({ token, user: u.toJSON() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/provider/login", async (req, res) => {
  try {
    const { mobile, password } = req.body || {};
    const p = await Provider.findOne({ mobile });
    if (!p || !(await bcrypt.compare(password, p.password))) return res.status(401).json({ error: "invalid mobile or password" });
    const token = sign({ id: p._id.toString(), role: "provider" });
    res.json({ token, provider: p.toJSON() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "username and password required" });

    // Check DB-stored admin credentials first; fallback to env vars for initial login.
    const stored = await Settings.findOne({ key: "adminCredentials" });
    const dbUsername = stored?.value?.username;
    const dbPasswordHash = stored?.value?.passwordHash;

    let ok = false;
    if (dbUsername && dbPasswordHash) {
      ok = username === dbUsername && await bcrypt.compare(password, dbPasswordHash);
    } else {
      // Fallback: env-var credentials (used before admin changes password the first time)
      ok = username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
    }

    if (!ok) return res.status(401).json({ error: "invalid credentials" });
    res.json({ token: sign({ role: "admin" }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin — change own password
app.post("/api/admin/change-password", auth("admin"), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "currentPassword and newPassword required" });
    if (String(newPassword).length < 6) return res.status(400).json({ error: "new password must be at least 6 characters" });

    // Verify current password (against DB or env fallback)
    const stored = await Settings.findOne({ key: "adminCredentials" });
    const dbUsername = stored?.value?.username;
    const dbPasswordHash = stored?.value?.passwordHash;

    let currentOk = false;
    if (dbUsername && dbPasswordHash) {
      currentOk = await bcrypt.compare(currentPassword, dbPasswordHash);
    } else {
      currentOk = currentPassword === ADMIN_PASSWORD;
    }
    if (!currentOk) return res.status(401).json({ error: "current password is incorrect" });

    const hash = await bcrypt.hash(String(newPassword), 10);
    await Settings.findOneAndUpdate(
      { key: "adminCredentials" },
      { value: { username: dbUsername || ADMIN_USERNAME, passwordHash: hash } },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public catalog — only active (approved) providers visible to users.
app.get("/api/providers", async (_req, res) => res.json(await Provider.find({ status: "active" }).sort({ online: -1, name: 1 })));
app.get("/api/providers/:id", async (req, res) => {
  const p = await Provider.findOne({ _id: req.params.id, status: "active" });
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});
app.get("/api/payments/settings", async (_req, res) => {
  const s = await Settings.findOne({ key: "payments" });
  res.json(s?.value || { upi_id: "navyasocial@upi", qr_url: "" });
});

// User self
app.get("/api/me", auth("user"), async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!u) return res.status(404).json({ error: "not found" });
  res.json(u);
});
app.get("/api/me/txns", auth("user"), async (req, res) => {
  res.json(await Txn.find({ userId: req.user.id }).sort({ at: -1 }).limit(200));
});

// User self-delete — hard delete user + all related data (txns, recharges, call logs).
app.delete("/api/me", auth("user"), async (req, res) => {
  try {
    const userId = req.user.id;
    await Promise.all([
      User.deleteOne({ _id: userId }),
      Txn.deleteMany({ userId }),
      Recharge.deleteMany({ userId }),
      CallLog.deleteMany({ userId }),
      PushSub.deleteMany({ ownerId: userId, ownerRole: "user" }),
    ]);
    // Remove this user from any provider's block list.
    await Provider.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/recharge", auth("user"), async (req, res) => {
  const { amount, refNote } = req.body || {};
  if (!amount || amount < 1) return res.status(400).json({ error: "invalid amount" });
  const r = await Recharge.create({ userId: req.user.id, amount, refNote });
  res.json(r);
});

// ----- Helpers for per-minute billing -----
// Billing is now per-minute: amount = ceil(durationSec / 60) * provider.perMinRate.
// Provider earns: amount * effectiveSharePct% where effectiveSharePct =
// provider.sharePctOverride ?? globalProviderSharePct (admin setting).
const DEFAULT_PROVIDER_SHARE_PCT = 60;
const GRACE_SEC = 10; // calls shorter than this are not charged (accidental connects)

const billedMinutes = (durationSec) => {
  const d = Number(durationSec) || 0;
  if (d < GRACE_SEC) return 0;
  return Math.ceil(d / 60);
};

const computeCallAmount = (durationSec, perMinRate) => {
  const mins = billedMinutes(durationSec);
  const rate = Math.max(0, Number(perMinRate) || 0);
  return mins * rate;
};

const effectiveSharePct = (provider, globalPct) => {
  const override = provider?.sharePctOverride;
  if (override != null && !isNaN(Number(override))) {
    return Math.max(0, Math.min(100, Number(override)));
  }
  return Math.max(0, Math.min(100, Number(globalPct ?? DEFAULT_PROVIDER_SHARE_PCT)));
};

// In-flight promise map — ensures concurrent requests for the same user+provider
// share the same promise, preventing duplicate call logs / double charging.
// Node.js is single-threaded, so the synchronous check + set is atomic.
const callLogInFlight = new Map(); // key=`${userId}:${providerId}` -> Promise<log>
const CALL_LOG_DEDUP_WINDOW_MS = 60 * 1000; // 60 seconds dedup window

app.post("/api/call/log", auth("user"), async (req, res) => {
  const { providerId, durationSec, autoCutoff } = req.body || {};
  if (!providerId || durationSec == null) return res.status(400).json({ error: "missing fields" });

  const lockKey = `${req.user.id}:${providerId}`;

  // SYNCHRONOUS check: if another request for this exact key is in flight,
  // await its result and return the same log (no double-charge).
  if (callLogInFlight.has(lockKey)) {
    try {
      const existingLog = await callLogInFlight.get(lockKey);
      return res.json(existingLog);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Build the work promise. This runs the full charge + log logic.
  const workPromise = (async () => {
    const now = Date.now();

    // DB-level dedup check (handles process restart / second request arriving
    // after first finished + lock was cleared)
    const recent = await CallLog.findOne({
      userId: req.user.id,
      providerId,
      at: { $gte: new Date(now - CALL_LOG_DEDUP_WINDOW_MS) },
    }).sort({ at: -1 });
    if (recent) return recent;

    const billing = await Settings.findOne({ key: "billing" });
    const globalSharePct = Number(billing?.value?.providerSharePct ?? DEFAULT_PROVIDER_SHARE_PCT);

    // Load provider to know perMinRate + optional share override.
    const prov = await Provider.findById(providerId).select("perMinRate sharePctOverride");
    if (!prov) return null;
    const perMinRate = Math.max(0, Number(prov.perMinRate) || 0);
    const sharePct = effectiveSharePct(prov, globalSharePct);

    // Server is source of truth: amount = billedMinutes × perMinRate.
    const amount = computeCallAmount(Number(durationSec) || 0, perMinRate);

    const u = await User.findById(req.user.id).select("bonusBalance");
    const currentBonus = Math.max(0, Number(u?.bonusBalance || 0));
    const bonusUsed = Math.min(amount, currentBonus);
    const realUsed = Math.max(0, amount - bonusUsed);

    // Provider credit: percentage of REAL money used (bonus calls earn nothing).
    const providerCredit = realUsed > 0
      ? Math.round((realUsed * sharePct / 100) * 100) / 100
      : 0;

    const log = await CallLog.create({
      userId: req.user.id, providerId, durationSec, amount,
      bonusUsed, realUsed,
      providerEarnings: providerCredit, sharePct,
      autoCutoff: !!autoCutoff,
    });
    if (amount > 0) {
      await User.updateOne(
        { _id: req.user.id },
        { $inc: { wallet: -amount, bonusBalance: -bonusUsed } }
      );
      await Txn.create({ userId: req.user.id, type: "debit", amount, note: `Call ${durationSec}s${bonusUsed > 0 ? ` (₹${bonusUsed.toFixed(2)} bonus)` : ""}` });
      if (providerCredit > 0) {
        await Provider.updateOne({ _id: providerId }, { $inc: { earnings: providerCredit, daily: providerCredit } });
      }
    }
    return log;
  })();

  // Register the in-flight promise BEFORE any await — this is atomic in JS.
  callLogInFlight.set(lockKey, workPromise);

  try {
    const log = await workPromise;
    res.json(log);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    // Keep the lock alive for the dedup window so late-arriving duplicates
    // (e.g. browser retries) also return the same result without re-charging.
    setTimeout(() => callLogInFlight.delete(lockKey), CALL_LOG_DEDUP_WINDOW_MS);
  }
});

// Provider self
app.get("/api/provider/me", auth("provider"), async (req, res) => {
  const p = await Provider.findById(req.user.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});
app.patch("/api/provider/me", auth("provider"), async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (typeof body.online === "boolean") patch.online = body.online;
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 60);
  if (typeof body.bio === "string") patch.bio = body.bio.trim().slice(0, 300);
  if (body.age != null) patch.age = Math.max(18, Math.min(99, Number(body.age) || 18));
  // Provider can set their own per-minute call charge (₹). Clamp to sane bounds.
  if (body.perMinRate != null) {
    const r = Math.max(1, Math.min(1000, Math.round(Number(body.perMinRate) || 0)));
    if (r > 0) patch.perMinRate = r;
  }
  if (Array.isArray(body.avatars)) {
    patch.avatars = body.avatars.filter((u) => typeof u === "string" && u).slice(0, 8);
    patch.avatar = patch.avatars[0] || "";
  }
  if (Array.isArray(body.languages)) {
    patch.languages = [...new Set(body.languages.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()))].slice(0, 10);
  }
  const p = await Provider.findByIdAndUpdate(req.user.id, patch, { new: true });
  res.json(p);
});
app.get("/api/provider/me/calls", auth("provider"), async (req, res) => {
  const calls = await CallLog.find({ providerId: req.user.id }).sort({ at: -1 }).limit(200);
  const userIds = [...new Set(calls.map((c) => c.userId))];
  const users = await User.find({ _id: { $in: userIds } });
  const uMap = Object.fromEntries(users.map((u) => [u._id.toString(), { name: u.name, mobile: u.mobile }]));
  res.json(calls.map((c) => ({
    ...c.toJSON(),
    userName: uMap[c.userId]?.name || "—",
    userMobile: uMap[c.userId]?.mobile || "",
  })));
});

// Provider self-delete — hard delete provider + all related data
// (their call logs, payouts, push subs). Frees the mobile number for re-registration.
app.delete("/api/provider/me", auth("provider"), async (req, res) => {
  try {
    const providerId = req.user.id;
    await Promise.all([
      Provider.deleteOne({ _id: providerId }),
      CallLog.deleteMany({ providerId }),
      Payout.deleteMany({ providerId }),
      PushSub.deleteMany({ ownerId: providerId, ownerRole: "provider" }),
    ]);
    providerBlocks.delete(providerId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Provider block/unblock + list ----------
app.get("/api/provider/me/blocks", auth("provider"), async (req, res) => {
  const p = await Provider.findById(req.user.id).select("blockedUsers");
  const ids = p?.blockedUsers || [];
  const users = await User.find({ _id: { $in: ids } }).select("name mobile");
  res.json(users.map((u) => ({ id: u._id.toString(), name: u.name, mobile: u.mobile })));
});
app.post("/api/provider/me/block", auth("provider"), async (req, res) => {
  const userId = String(req.body?.userId || "");
  if (!userId) return res.status(400).json({ error: "userId required" });
  await Provider.updateOne({ _id: req.user.id }, { $addToSet: { blockedUsers: userId } });
  addBlock(req.user.id, userId);
  res.json({ ok: true });
});
app.post("/api/provider/me/unblock", auth("provider"), async (req, res) => {
  const userId = String(req.body?.userId || "");
  if (!userId) return res.status(400).json({ error: "userId required" });
  await Provider.updateOne({ _id: req.user.id }, { $pull: { blockedUsers: userId } });
  removeBlock(req.user.id, userId);
  res.json({ ok: true });
});

// Admin — users
app.get("/api/admin/users", auth("admin"), async (_req, res) => res.json(await User.find({}).sort({ createdAt: -1 })));
app.post("/api/admin/users", auth("admin"), async (req, res) => {
  try {
    const { name, mobile, password = "user123", wallet = 0 } = req.body || {};
    if (!name || !mobile) return res.status(400).json({ error: "missing fields" });
    if (await User.findOne({ mobile })) return res.status(409).json({ error: "mobile exists" });
    const hash = await bcrypt.hash(password, 10);
    const u = await User.create({ name, mobile, password: hash, wallet: Number(wallet) || 0 });
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/admin/users/:id", auth("admin"), async (req, res) => {
  await User.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});
app.patch("/api/admin/users/:id", auth("admin"), async (req, res) => {
  try {
    const body = req.body || {};
    const patch = {};
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 60);
    if (typeof body.mobile === "string" && body.mobile.trim()) {
      const cleanMobile = String(body.mobile).replace(/\D/g, "").slice(-10);
      if (cleanMobile.length !== 10) return res.status(400).json({ error: "invalid mobile" });
      // Ensure mobile uniqueness
      const dup = await User.findOne({ mobile: cleanMobile, _id: { $ne: req.params.id } });
      if (dup) return res.status(409).json({ error: "mobile already in use" });
      patch.mobile = cleanMobile;
    }
    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 6) return res.status(400).json({ error: "password must be at least 6 characters" });
      patch.password = await bcrypt.hash(body.password, 10);
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "nothing to update" });
    const u = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!u) return res.status(404).json({ error: "user not found" });
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/admin/users/:id/adjust", auth("admin"), async (req, res) => {
  const delta = Number(req.body?.delta || 0);
  if (!delta) return res.status(400).json({ error: "invalid delta" });
  const note = req.body?.note || "Admin adjustment";
  await User.updateOne({ _id: req.params.id }, { $inc: { wallet: delta } });
  await Txn.create({ userId: req.params.id, type: delta > 0 ? "credit" : "debit", amount: Math.abs(delta), note });
  res.json({ ok: true });
});

// Admin — providers
app.get("/api/admin/providers", auth("admin"), async (_req, res) => res.json(await Provider.find({}).sort({ name: 1 })));
app.post("/api/admin/providers", auth("admin"), async (req, res) => {
  try {
    const { password = "pro123", ...rest } = req.body || {};
    if (!rest.name || !rest.mobile) return res.status(400).json({ error: "missing fields" });
    if (await Provider.findOne({ mobile: rest.mobile })) return res.status(409).json({ error: "mobile exists" });
    const hash = await bcrypt.hash(password, 10);
    const p = await Provider.create({ ...rest, password: hash, avatar: rest.avatar || "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400" });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch("/api/admin/providers/:id", auth("admin"), async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 60);
  if (typeof body.mobile === "string") patch.mobile = String(body.mobile).replace(/\D/g, "").slice(-10);
  if (typeof body.bio === "string") patch.bio = body.bio.trim().slice(0, 300);
  if (body.age != null) patch.age = Math.max(18, Math.min(99, Number(body.age) || 18));
  if (typeof body.online === "boolean") patch.online = body.online;
  if (typeof body.busy === "boolean") patch.busy = body.busy;
  if (typeof body.status === "string" && ["pending", "active", "rejected"].includes(body.status)) patch.status = body.status;
  if (typeof body.realMeetEnabled === "boolean") patch.realMeetEnabled = body.realMeetEnabled;
  if (typeof body.videoCallEnabled === "boolean") patch.videoCallEnabled = body.videoCallEnabled;
  // Admin can also set/override the provider's per-minute call charge.
  if (body.perMinRate != null && body.perMinRate !== "") {
    const r = Math.max(0, Math.min(10000, Math.round(Number(body.perMinRate) || 0)));
    patch.perMinRate = r;
  }
  // Admin per-provider payout override (% to provider). Pass null/"" to clear and use global default.
  if ("sharePctOverride" in body) {
    if (body.sharePctOverride === null || body.sharePctOverride === "" || body.sharePctOverride === undefined) {
      patch.sharePctOverride = null;
    } else {
      const n = Number(body.sharePctOverride);
      if (!isNaN(n)) patch.sharePctOverride = Math.max(0, Math.min(100, Math.round(n)));
    }
  }
  if (Array.isArray(body.avatars)) {
    patch.avatars = body.avatars.filter((u) => typeof u === "string" && u).slice(0, 8);
    patch.avatar = patch.avatars[0] || "";
  }
  if (typeof body.avatar === "string" && body.avatar && !Array.isArray(body.avatars)) patch.avatar = body.avatar;
  if (Array.isArray(body.languages)) {
    patch.languages = [...new Set(body.languages.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()))].slice(0, 10);
  }
  if (body.password) patch.password = await bcrypt.hash(body.password, 10);
  const p = await Provider.findByIdAndUpdate(req.params.id, patch, { new: true });
  res.json(p);
});
app.delete("/api/admin/providers/:id", auth("admin"), async (req, res) => {
  await Provider.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

// Admin — image upload (multipart, up to 8 files). Returns array of absolute URLs.
app.post("/api/admin/upload", auth("admin"), (req, res) => {
  upload.array("files", 8)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
    const urls = (req.files || []).map((f) => `${base}/api/uploads/${f.filename}`);
    res.json({ urls });
  });
});

// Provider self-upload (same multipart endpoint).
app.post("/api/provider/upload", auth("provider"), (req, res) => {
  upload.array("files", 8)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
    const urls = (req.files || []).map((f) => `${base}/api/uploads/${f.filename}`);
    res.json({ urls });
  });
});

// ===== Web Push =====
app.get("/api/push/vapid-public-key", (_req, res) => res.json({ key: VAPID.publicKey }));

app.post("/api/push/subscribe", auth("provider"), async (req, res) => {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys) return res.status(400).json({ error: "invalid subscription" });
    await PushSub.findOneAndUpdate(
      { endpoint: sub.endpoint },
      { ownerId: req.user.id, ownerRole: "provider", endpoint: sub.endpoint, keys: sub.keys, ua: req.body?.userAgent || "" },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/push/unsubscribe", auth("provider"), async (req, res) => {
  await PushSub.deleteOne({ endpoint: req.body?.endpoint || "" });
  res.json({ ok: true });
});

// Provider — send a test push to verify notification setup.
app.post("/api/push/test", auth("provider"), async (req, res) => {
  try {
    const subs = await PushSub.find({ ownerId: req.user.id });
    if (!subs.length) return res.status(404).json({ error: "no push subscriptions — enable notifications first" });
    let delivered = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify({
            type: "incoming_call",
            title: "📞 Test incoming call",
            body: "This is a test notification. Real calls will look like this.",
            tag: "test-call",
          }),
          { TTL: 60 }
        );
        delivered++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await PushSub.deleteOne({ _id: s._id });
        }
      }
    }));
    res.json({ ok: true, delivered, total: subs.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Helper: send a push to all subscriptions of a given owner. Removes stale ones (404/410).
const pushToOwner = async (ownerId, payload) => {
  const subs = await PushSub.find({ ownerId });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await PushSub.deleteOne({ _id: s._id });
      }
    }
  }));
};

// Admin — recharges / calls / payments
app.get("/api/admin/recharges", auth("admin"), async (_req, res) => {
  const list = await Recharge.find({}).sort({ at: -1 }).limit(500);
  const userIds = [...new Set(list.map((r) => r.userId))];
  const users = await User.find({ _id: { $in: userIds } });
  const map = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
  res.json(list.map((r) => ({ ...r.toJSON(), userName: map[r.userId] || "—" })));
});
app.post("/api/admin/recharges/:id/approve", auth("admin"), async (req, res) => {
  const r = await Recharge.findById(req.params.id);
  if (!r || r.status !== "pending") return res.status(400).json({ error: "invalid request" });
  r.status = "approved"; await r.save();
  await User.updateOne({ _id: r.userId }, { $inc: { wallet: r.amount } });
  await Txn.create({ userId: r.userId, type: "credit", amount: r.amount, note: `UPI Recharge (${r.refNote || "manual"})` });
  res.json(r);
});
app.post("/api/admin/recharges/:id/reject", auth("admin"), async (req, res) => {
  res.json(await Recharge.findByIdAndUpdate(req.params.id, { status: "rejected" }, { new: true }));
});
app.get("/api/admin/calls", auth("admin"), async (req, res) => {
  const q = {};
  if (req.query.providerId) q.providerId = String(req.query.providerId);
  if (req.query.from || req.query.to) {
    q.at = {};
    if (req.query.from) q.at.$gte = new Date(req.query.from);
    if (req.query.to) q.at.$lte = new Date(req.query.to);
  }
  const limit = Math.min(2000, Number(req.query.limit) || 500);
  const calls = await CallLog.find(q).sort({ at: -1 }).limit(limit);
  const userIds = [...new Set(calls.map((c) => c.userId))];
  const provIds = [...new Set(calls.map((c) => c.providerId))];
  const users = await User.find({ _id: { $in: userIds } });
  const provs = await Provider.find({ _id: { $in: provIds } });
  const uMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
  const pMap = Object.fromEntries(provs.map((p) => [p._id.toString(), p.name]));
  res.json(calls.map((c) => ({ ...c.toJSON(), userName: uMap[c.userId] || "—", providerName: pMap[c.providerId] || "—" })));
});

// ---------- Provider payout report (admin) ----------
app.get("/api/admin/payouts", auth("admin"), async (req, res) => {
  const match = {};
  if (req.query.providerId) match.providerId = String(req.query.providerId);
  if (req.query.from || req.query.to) {
    match.at = {};
    if (req.query.from) match.at.$gte = new Date(req.query.from);
    if (req.query.to) match.at.$lte = new Date(req.query.to);
  }

  const calls = await CallLog.find(match).sort({ at: -1 }).limit(5000);
  const provIds = [...new Set(calls.map((c) => c.providerId))];
  const userIds = [...new Set(calls.map((c) => c.userId))];
  const provs = await Provider.find({ _id: { $in: provIds } });
  const users = await User.find({ _id: { $in: userIds } });
  const pMap = Object.fromEntries(provs.map((p) => [p._id.toString(), { name: p.name, mobile: p.mobile }]));
  const uMap = Object.fromEntries(users.map((u) => [u._id.toString(), { name: u.name, mobile: u.mobile }]));
  const billing = await Settings.findOne({ key: "billing" });
  const defaultShare = Number(billing?.value?.providerSharePct ?? 60);

  const groups = {};
  for (const c of calls) {
    const id = c.providerId;
    if (!groups[id]) groups[id] = {
      providerId: id,
      providerName: pMap[id]?.name || "—",
      providerMobile: pMap[id]?.mobile || "",
      isDeleted: !pMap[id],
      calls: 0, durationSec: 0, gross: 0, bonusUsed: 0, realUsed: 0, payout: 0, adminShare: 0,
      pendingBalance: 0,
    };
    const g = groups[id];
    const share = c.sharePct != null ? c.sharePct : defaultShare;
    const real = c.realUsed != null ? c.realUsed : c.amount;
    const bonus = c.bonusUsed != null ? c.bonusUsed : 0;
    const earn = c.providerEarnings != null ? c.providerEarnings : Math.round((real * share) / 100 * 100) / 100;
    g.calls += 1;
    g.durationSec += c.durationSec || 0;
    g.gross += c.amount || 0;
    g.bonusUsed += bonus;
    g.realUsed += real;
    g.payout += earn;
    g.adminShare += Math.max(0, real - earn);
  }
  for (const p of provs) {
    const id = p._id.toString();
    if (groups[id]) groups[id].pendingBalance = p.earnings || 0;
  }
  const summary = Object.values(groups).sort((a, b) => b.payout - a.payout);

  const rows = calls.map((c) => {
    const share = c.sharePct != null ? c.sharePct : defaultShare;
    const real = c.realUsed != null ? c.realUsed : c.amount;
    const bonus = c.bonusUsed != null ? c.bonusUsed : 0;
    const earn = c.providerEarnings != null ? c.providerEarnings : Math.round((real * share) / 100 * 100) / 100;
    return {
      id: c._id.toString(),
      at: c.at,
      providerName: pMap[c.providerId]?.name || "—",
      providerMobile: pMap[c.providerId]?.mobile || "",
      userName: uMap[c.userId]?.name || "—",
      userMobile: uMap[c.userId]?.mobile || "",
      durationSec: c.durationSec || 0,
      gross: c.amount || 0,
      bonusUsed: bonus,
      realUsed: real,
      sharePct: share,
      payout: earn,
      adminShare: Math.max(0, real - earn),
      autoCutoff: !!c.autoCutoff,
    };
  });

  const totals = summary.reduce((t, g) => ({
    calls: t.calls + g.calls,
    durationSec: t.durationSec + g.durationSec,
    gross: t.gross + g.gross,
    bonusUsed: t.bonusUsed + g.bonusUsed,
    realUsed: t.realUsed + g.realUsed,
    payout: t.payout + g.payout,
    adminShare: t.adminShare + g.adminShare,
  }), { calls: 0, durationSec: 0, gross: 0, bonusUsed: 0, realUsed: 0, payout: 0, adminShare: 0 });

  if (String(req.query.format).toLowerCase() === "csv") {
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      "DateTime,Provider,Provider Mobile,User,User Mobile,Duration (sec),Gross ₹,Bonus ₹,Real ₹,Share %,Provider Payout ₹,Admin Share ₹,Auto-end",
      ...rows.map((r) => [
        new Date(r.at).toISOString(), r.providerName, r.providerMobile,
        r.userName, r.userMobile, r.durationSec,
        r.gross.toFixed(2), r.bonusUsed.toFixed(2), r.realUsed.toFixed(2),
        r.sharePct, r.payout.toFixed(2), r.adminShare.toFixed(2), r.autoCutoff ? "Yes" : "No",
      ].map(esc).join(",")),
    ];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="navya-payouts-${Date.now()}.csv"`);
    return res.send(lines.join("\n"));
  }

  res.json({ summary, rows, totals });
});

// Admin — mark payout done. Resets provider's pending earnings to 0 and logs the payout.
app.post("/api/admin/payouts/mark-done", auth("admin"), async (req, res) => {
  try {
    const providerId = String(req.body?.providerId || "");
    const amount = Number(req.body?.amount);
    if (!providerId || !(amount > 0)) return res.status(400).json({ error: "providerId and positive amount required" });
    const p = await Provider.findById(providerId);
    if (!p) return res.status(404).json({ error: "provider not found" });

    const payout = await Payout.create({
      providerId,
      providerName: p.name,
      amount,
      fromDate: req.body?.fromDate ? new Date(req.body.fromDate) : undefined,
      toDate: req.body?.toDate ? new Date(req.body.toDate) : undefined,
      note: String(req.body?.note || "").slice(0, 200),
    });
    await Provider.updateOne({ _id: providerId }, { $set: { earnings: 0, daily: 0 } });
    res.json({ ok: true, payout });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin — list payouts for a provider (or all). Used for history view.
app.get("/api/admin/payouts/history", auth("admin"), async (req, res) => {
  const q = {};
  if (req.query.providerId) q.providerId = String(req.query.providerId);
  const list = await Payout.find(q).sort({ at: -1 }).limit(500);
  res.json(list);
});

// Admin — clear all payout history + call logs for a (typically deleted) provider.
// Used when a provider's profile has been deleted and admin wants to wipe their orphaned data.
app.delete("/api/admin/payouts/clear/:providerId", auth("admin"), async (req, res) => {
  try {
    const providerId = String(req.params.providerId || "");
    if (!providerId) return res.status(400).json({ error: "providerId required" });
    const payoutResult = await Payout.deleteMany({ providerId });
    const callResult = await CallLog.deleteMany({ providerId });
    // Also zero-out any stale earnings on the provider record (if it still exists)
    await Provider.updateOne({ _id: providerId }, { $set: { earnings: 0, daily: 0 } }).catch(() => {});
    res.json({
      ok: true,
      payoutsDeleted: payoutResult.deletedCount || 0,
      callLogsDeleted: callResult.deletedCount || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/admin/payments/settings", auth("admin"), async (req, res) => {
  const s = await Settings.findOneAndUpdate({ key: "payments" }, { value: req.body }, { upsert: true, new: true });
  res.json(s.value);
});

// ---------- Billing settings (global payout split) ----------
app.get("/api/billing/public", async (_req, res) => {
  const s = await Settings.findOne({ key: "billing" });
  const v = s?.value || {};
  res.json({
    providerSharePct: Number(v.providerSharePct ?? DEFAULT_PROVIDER_SHARE_PCT),
  });
});
app.get("/api/admin/billing", auth("admin"), async (_req, res) => {
  const s = await Settings.findOne({ key: "billing" });
  const v = s?.value || {};
  res.json({
    providerSharePct: Number(v.providerSharePct ?? DEFAULT_PROVIDER_SHARE_PCT),
  });
});
app.put("/api/admin/billing", auth("admin"), async (req, res) => {
  const providerSharePct = Math.min(100, Math.max(0, Math.round(Number(req.body?.providerSharePct ?? DEFAULT_PROVIDER_SHARE_PCT))));
  const s = await Settings.findOneAndUpdate(
    { key: "billing" },
    { value: { providerSharePct } },
    { upsert: true, new: true }
  );
  res.json(s.value);
});

// ---------- Admin WhatsApp settings ----------
app.get("/api/admin/whatsapp", auth("admin"), async (_req, res) => {
  const s = await Settings.findOne({ key: "adminWhatsapp" });
  res.json({ whatsappNumber: s?.value?.whatsappNumber || "" });
});
app.put("/api/admin/whatsapp", auth("admin"), async (req, res) => {
  const whatsappNumber = String(req.body?.whatsappNumber || "").replace(/\D/g, "");
  await Settings.findOneAndUpdate(
    { key: "adminWhatsapp" },
    { value: { whatsappNumber } },
    { upsert: true }
  );
  res.json({ ok: true, whatsappNumber });
});
app.get("/api/whatsapp/number", async (_req, res) => {
  const s = await Settings.findOne({ key: "adminWhatsapp" });
  res.json({ whatsappNumber: s?.value?.whatsappNumber || "" });
});

// ---------- UPI Payment Settings ----------
app.get("/api/admin/upi", auth("admin"), async (_req, res) => {
  const s = await Settings.findOne({ key: "upiSettings" });
  res.json({ 
    upiId: s?.value?.upiId || "", 
    upiName: s?.value?.upiName || "Bongo Bandhu",
    qrCodeUrl: s?.value?.qrCodeUrl || ""
  });
});

app.put("/api/admin/upi", auth("admin"), async (req, res) => {
  const upiId = String(req.body?.upiId || "").trim();
  const upiName = String(req.body?.upiName || "Bongo Bandhu").trim();
  const qrCodeUrl = String(req.body?.qrCodeUrl || "").trim();
  await Settings.findOneAndUpdate(
    { key: "upiSettings" },
    { value: { upiId, upiName, qrCodeUrl } },
    { upsert: true }
  );
  res.json({ ok: true, upiId, upiName, qrCodeUrl });
});

app.get("/api/upi/settings", async (_req, res) => {
  const s = await Settings.findOne({ key: "upiSettings" });
  res.json({ 
    upiId: s?.value?.upiId || "", 
    upiName: s?.value?.upiName || "Bongo Bandhu",
    qrCodeUrl: s?.value?.qrCodeUrl || ""
  });
});

// User initiates UPI payment - creates pending recharge request
app.post("/api/upi/initiate", auth("user"), async (req, res) => {
  try {
    const amount = Math.max(1, Number(req.body?.amount || 0));
    if (amount < 1) return res.status(400).json({ error: "Invalid amount" });
    
    const txnId = `UPI${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const r = await Recharge.create({
      userId: req.user.id,
      amount,
      refNote: txnId,
      status: "pending",
    });
    
    const s = await Settings.findOne({ key: "upiSettings" });
    res.json({
      transactionId: txnId,
      amount,
      upiId: s?.value?.upiId || "",
      upiName: s?.value?.upiName || "Bongo Bandhu",
      qrCodeUrl: s?.value?.qrCodeUrl || "",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Razorpay settings (admin-configurable, no hardcoding) ---------- [DEPRECATED - REMOVED]
/*
const getRzpSettings = async () => (await Settings.findOne({ key: "razorpay" }))?.value || {};

app.get("/api/admin/razorpay", auth("admin"), async (_req, res) => {
  const v = await getRzpSettings();
  res.json({
    enabled: !!v.enabled,
    key_id: v.key_id || "",
    key_secret: v.key_secret ? "*****" + String(v.key_secret).slice(-4) : "",
    webhook_secret: v.webhook_secret ? "*****" + String(v.webhook_secret).slice(-4) : "",
    webhook_url: v.webhook_url || "",
  });
});
app.put("/api/admin/razorpay", auth("admin"), async (req, res) => {
  const cur = await getRzpSettings();
  const next = {
    enabled: !!req.body.enabled,
    key_id: req.body.key_id || cur.key_id || "",
    key_secret: (req.body.key_secret && !req.body.key_secret.startsWith("*****")) ? req.body.key_secret : (cur.key_secret || ""),
    webhook_secret: (req.body.webhook_secret && !req.body.webhook_secret.startsWith("*****")) ? req.body.webhook_secret : (cur.webhook_secret || ""),
    webhook_url: req.body.webhook_url || cur.webhook_url || "",
  };
  await Settings.findOneAndUpdate({ key: "razorpay" }, { value: next }, { upsert: true });
  res.json({ ok: true });
});

app.get("/api/razorpay/enabled", async (_req, res) => {
  const v = await getRzpSettings();
  res.json({ enabled: !!v.enabled && !!v.key_id && !!v.key_secret, key_id: v.enabled ? (v.key_id || "") : "" });
});
*/

// ---------- External PHP Payment Gateway (Cashfree / Razorpay via PHP) ----------
// Admin enables a single toggle for "UPI / Net Banking / Card" which redirects
// the user to an external PHP-hosted gateway. The PHP side handles the actual
// gateway choice (Cashfree / Razorpay) and calls back to credit the wallet.
const getExtPaymentSettings = async () => (await Settings.findOne({ key: "extPayment" }))?.value || {};

app.get("/api/admin/ext-payment", auth("admin"), async (_req, res) => {
  const v = await getExtPaymentSettings();
  res.json({
    enabled: !!v.enabled,
    gatewayUrl: v.gatewayUrl || "",
    sharedSecret: v.sharedSecret ? "*****" + String(v.sharedSecret).slice(-4) : "",
    label: v.label || "UPI / Net Banking / Card",
  });
});

app.put("/api/admin/ext-payment", auth("admin"), async (req, res) => {
  const cur = await getExtPaymentSettings();
  const incomingSecret = req.body?.sharedSecret;
  const next = {
    enabled: !!req.body?.enabled,
    gatewayUrl: String(req.body?.gatewayUrl || cur.gatewayUrl || "").trim(),
    sharedSecret: (incomingSecret && !String(incomingSecret).startsWith("*****"))
      ? String(incomingSecret).trim()
      : (cur.sharedSecret || ""),
    label: String(req.body?.label || cur.label || "UPI / Net Banking / Card").trim(),
  };
  if (next.enabled && (!next.gatewayUrl || !next.sharedSecret)) {
    return res.status(400).json({ error: "gatewayUrl and sharedSecret are required when enabled" });
  }
  await Settings.findOneAndUpdate({ key: "extPayment" }, { value: next }, { upsert: true });
  res.json({ ok: true });
});

// Public — frontend uses this to know whether to show the "UPI / Net Banking / Card" option
app.get("/api/ext-payment/enabled", async (_req, res) => {
  const v = await getExtPaymentSettings();
  res.json({
    enabled: !!v.enabled && !!v.gatewayUrl && !!v.sharedSecret,
    label: v.label || "UPI / Net Banking / Card",
  });
});

// User initiates an external payment — creates a pending Recharge and returns the redirect URL.
// The PHP gateway will receive only the orderId and fetch all other details from us.
app.post("/api/ext-payment/initiate", auth("user"), async (req, res) => {
  try {
    const amount = Math.max(1, Math.round(Number(req.body?.amount || 0)));
    if (amount < 1) return res.status(400).json({ error: "Invalid amount" });
    const v = await getExtPaymentSettings();
    if (!v.enabled || !v.gatewayUrl || !v.sharedSecret) {
      return res.status(400).json({ error: "External payment not configured" });
    }
    const customerName = String(req.body?.customerName || "").trim().slice(0, 80);
    const customerEmail = String(req.body?.customerEmail || "").trim().slice(0, 120);
    const customerPhone = String(req.body?.customerPhone || "").trim().replace(/\D/g, "").slice(0, 15);
    if (!customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: "Name, email and phone are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({ error: "Invalid email" });
    }
    if (customerPhone.length < 10) {
      return res.status(400).json({ error: "Invalid phone number" });
    }
    const orderId = `EXT${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await Recharge.create({
      userId: req.user.id,
      amount,
      refNote: `EXT:${orderId}`,
      status: "pending",
      customerName,
      customerEmail,
      customerPhone,
    });
    const sep = v.gatewayUrl.includes("?") ? "&" : "?";
    const redirectUrl = `${v.gatewayUrl}${sep}order_id=${encodeURIComponent(orderId)}`;
    res.json({ orderId, amount, redirectUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Called by the PHP gateway to fetch order details. Auth via shared secret header.
app.get("/api/ext-payment/order/:orderId", async (req, res) => {
  try {
    const v = await getExtPaymentSettings();
    if (!v.sharedSecret) return res.status(503).json({ error: "not configured" });
    if (req.headers["x-gateway-secret"] !== v.sharedSecret) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const orderId = String(req.params.orderId || "");
    const r = await Recharge.findOne({ refNote: `EXT:${orderId}` });
    if (!r) return res.status(404).json({ error: "order not found" });
    const u = await User.findById(r.userId);
    res.json({
      orderId,
      amount: r.amount,
      currency: "INR",
      status: r.status,
      customerId: r.userId,
      customerName: r.customerName || u?.name || `User${String(r.userId).slice(-4)}`,
      customerPhone: r.customerPhone || u?.mobile || "9999999999",
      customerEmail: r.customerEmail || `${r.userId}@bongobandhu.local`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook called by the PHP gateway after the customer pays successfully.
// Body must be JSON. Authenticated via HMAC-SHA256 of the raw body using shared secret.
app.post("/api/ext-payment/callback", async (req, res) => {
  try {
    const v = await getExtPaymentSettings();
    if (!v.sharedSecret) return res.status(503).json({ error: "not configured" });
    const sig = req.headers["x-gateway-signature"];
    const raw = req.rawBody; // populated by express.json verify hook
    if (!sig || !raw) return res.status(400).json({ error: "missing signature or body" });
    const expected = crypto.createHmac("sha256", v.sharedSecret).update(raw).digest("hex");
    if (expected !== sig) return res.status(401).json({ error: "invalid signature" });
    const data = req.body || {};
    const orderId = String(data.orderId || "");
    const status = String(data.status || "");
    const paymentId = String(data.paymentId || "");
    const gateway = String(data.gateway || "");
    if (!orderId) return res.status(400).json({ error: "orderId required" });
    const r = await Recharge.findOne({ refNote: `EXT:${orderId}` });
    if (!r) return res.status(404).json({ error: "order not found" });
    if (status === "success" || status === "PAID" || status === "captured") {
      if (r.status !== "approved") {
        r.status = "approved"; await r.save();
        await User.updateOne({ _id: r.userId }, { $inc: { wallet: r.amount } });
        await Txn.create({
          userId: r.userId, type: "credit", amount: r.amount,
          note: `${gateway || "Gateway"} ${paymentId || orderId}`,
        });
      }
      return res.json({ ok: true, status: "approved" });
    }
    if (status === "failed" || status === "cancelled") {
      if (r.status === "pending") {
        r.status = "rejected"; await r.save();
      }
      return res.json({ ok: true, status: "rejected" });
    }
    res.json({ ok: true, status: r.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// User lands here after PHP gateway processing — redirect back to the wallet
app.get("/api/ext-payment/return", async (req, res) => {
  const orderId = String(req.query.order_id || "");
  const status = String(req.query.status || "");
  const front = process.env.FRONTEND_URL || (req.headers.referer || "/").replace(/\/$/, "");
  // Best-effort redirect to /wallet page on the frontend
  const target = `${front}/wallet?recharge=${encodeURIComponent(status)}&order=${encodeURIComponent(orderId)}`;
  res.redirect(302, target);
});

// ---------- Languages (master list managed by admin) ----------
const getLanguages = async () => {
  const s = await Settings.findOne({ key: "languages" });
  return Array.isArray(s?.value) ? s.value : [];
};
app.get("/api/languages", async (_req, res) => res.json(await getLanguages()));
app.get("/api/admin/languages", auth("admin"), async (_req, res) => res.json(await getLanguages()));
app.post("/api/admin/languages", auth("admin"), async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: "name required" });
  const cur = await getLanguages();
  if (cur.find((l) => l.toLowerCase() === name.toLowerCase())) return res.status(400).json({ error: "language already exists" });
  const next = [...cur, name].sort((a, b) => a.localeCompare(b));
  await Settings.findOneAndUpdate({ key: "languages" }, { value: next }, { upsert: true });
  res.json(next);
});
app.delete("/api/admin/languages/:name", auth("admin"), async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const cur = await getLanguages();
  const next = cur.filter((l) => l !== name);
  await Settings.findOneAndUpdate({ key: "languages" }, { value: next }, { upsert: true });
  await Provider.updateMany({ languages: name }, { $pull: { languages: name } });
  res.json(next);
});

// ---------- Razorpay endpoints (REMOVED) ----------
/*
// Create order (auth user). Amount is INR rupees; we convert to paise.
app.post("/api/razorpay/create-order", auth("user"), async (req, res) => {
  try {
    const amount = Math.max(1, Number(req.body?.amount || 0));
    const v = await getRzpSettings();
    if (!v.enabled || !v.key_id || !v.key_secret) return res.status(400).json({ error: "Razorpay not configured" });
    const rzp = new Razorpay({ key_id: v.key_id, key_secret: v.key_secret });
    const order = await rzp.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${req.user.id.slice(-6)}`,
      notes: { userId: req.user.id, type: "wallet_recharge" },
    });
    await Recharge.create({ userId: req.user.id, amount, refNote: `RZP:${order.id}`, status: "pending" });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, key_id: v.key_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Verify payment signature, credit wallet
app.post("/api/razorpay/verify", auth("user"), async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({ error: "missing fields" });
    const v = await getRzpSettings();
    const expected = crypto.createHmac("sha256", v.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (expected !== razorpay_signature) return res.status(400).json({ error: "invalid signature" });

    const r = await Recharge.findOne({ refNote: `RZP:${razorpay_order_id}`, userId: req.user.id });
    if (!r) return res.status(404).json({ error: "order not found" });
    if (r.status === "approved") return res.json({ ok: true, alreadyCredited: true });
    r.status = "approved"; await r.save();
    await User.updateOne({ _id: req.user.id }, { $inc: { wallet: r.amount } });
    await Txn.create({ userId: req.user.id, type: "credit", amount: r.amount, note: `Razorpay ${razorpay_payment_id}` });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook — Razorpay signs the raw body with webhook_secret
app.post("/api/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const v = await getRzpSettings();
      if (!v.webhook_secret) return res.status(503).send("webhook not configured");
      const sig = req.headers["x-razorpay-signature"];
      const body = req.body;
      const expected = crypto.createHmac("sha256", v.webhook_secret).update(body).digest("hex");
      if (expected !== sig) return res.status(400).send("invalid signature");
      const evt = JSON.parse(body.toString("utf8"));
      if (evt.event === "payment.captured" || evt.event === "order.paid") {
        const orderId = evt.payload?.payment?.entity?.order_id || evt.payload?.order?.entity?.id;
        if (orderId) {
          const r = await Recharge.findOne({ refNote: `RZP:${orderId}` });
          if (r && r.status !== "approved") {
            r.status = "approved"; await r.save();
            await User.updateOne({ _id: r.userId }, { $inc: { wallet: r.amount } });
            await Txn.create({ userId: r.userId, type: "credit", amount: r.amount, note: `Razorpay webhook ${orderId}` });
          }
        }
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);
*/


// ---------- Seed defaults ----------
const seedDefaults = async () => {
  const backfill = await Provider.updateMany(
    { $or: [{ status: { $exists: false } }, { status: null }] },
    { $set: { status: "active" } }
  );
  if (backfill.modifiedCount > 0) console.log(`Backfilled status=active on ${backfill.modifiedCount} providers`);

  if ((await Provider.countDocuments()) === 0) {
    const seed = [
      { name: "Aarav Mehta", mobile: "8000000001", bio: "Career & life coach. 8+ yrs guiding professionals.", age: 32, online: true,
        avatar: "https://images.unsplash.com/photo-1598411435746-47bfecc3ea98?w=400" },
      { name: "Riya Kapoor", mobile: "8000000002", bio: "Certified counselor — relationship & wellness.", age: 29, online: true,
        avatar: "https://images.pexels.com/photos/7580822/pexels-photo-7580822.jpeg?w=400" },
      { name: "Vikram Singh", mobile: "8000000003", bio: "Vedic astrologer — clarity in 10 minutes.", age: 41, online: false,
        avatar: "https://images.pexels.com/photos/7580940/pexels-photo-7580940.jpeg?w=400" },
      { name: "Sanya Verma", mobile: "8000000004", bio: "Nutritionist focused on Indian diets.", age: 27, online: true,
        avatar: "https://images.pexels.com/photos/7580822/pexels-photo-7580822.jpeg?w=400" },
      { name: "Rohan Iyer", mobile: "8000000005", bio: "Tech mentor — system design & interviews.", age: 35, online: true,
        avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400" },
      { name: "Neha Sharma", mobile: "8000000006", bio: "Tarot reader. Insightful 1-on-1 sessions.", age: 33, online: false,
        avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400" },
    ];
    const hash = await bcrypt.hash("pro123", 10);
    await Provider.insertMany(seed.map((p) => ({ ...p, password: hash, earnings: 0, daily: 0 })));
    console.log("seeded providers");
  }
  if (!(await Settings.findOne({ key: "payments" }))) {
    await Settings.create({ key: "payments", value: { upi_id: "navyasocial@upi", qr_url: "https://images.unsplash.com/photo-1550482768-88b710a445fd?w=600" } });
    console.log("seeded payment settings");
  }
  if (!(await Settings.findOne({ key: "billing" }))) {
    await Settings.create({ key: "billing", value: { providerSharePct: DEFAULT_PROVIDER_SHARE_PCT } });
    console.log("seeded billing settings");
  } else {
    // One-time migration: drop legacy packages field if present.
    const existing = await Settings.findOne({ key: "billing" });
    const v = existing?.value || {};
    if (Array.isArray(v.packages)) {
      await Settings.updateOne(
        { key: "billing" },
        { $set: { value: { providerSharePct: Number(v.providerSharePct ?? DEFAULT_PROVIDER_SHARE_PCT) } } }
      );
      console.log("migrated billing settings: removed legacy packages");
    }
  }
  if (!(await Settings.findOne({ key: "languages" }))) {
    await Settings.create({ key: "languages", value: ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Punjabi", "Kannada", "Malayalam"] });
    console.log("seeded languages");
  }
};

// ---------- Socket.io signaling ----------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (process.env.CORS_ORIGIN || "*").split(","),
    credentials: true,
  },
});

const sockets = new Map(); // peerId -> socketId
const outbox = new Map(); // peerId -> queued messages

// ACTIVE CALL STORE
const activeCalls = new Map();

const providerBlocks = new Map();

const addBlock = (providerId, userId) => {
  if (!providerBlocks.has(providerId)) {
    providerBlocks.set(providerId, new Set());
  }

  providerBlocks.get(providerId).add(userId);
};

const removeBlock = (providerId, userId) => {
  const s = providerBlocks.get(providerId);

  if (s) s.delete(userId);
};

const OUTBOX_TTL_MS = 8000;
const OUTBOX_MAX = 32;

const pushOutbox = (peerId, event, data) => {
  let q = outbox.get(peerId);

  if (!q) {
    q = [];
    outbox.set(peerId, q);
  }

  q.push({
    ts: Date.now(),
    event,
    data,
  });

  if (q.length > OUTBOX_MAX) {
    q.shift();
  }
};

const flushOutbox = (peerId, socket) => {
  const q = outbox.get(peerId);

  if (!q) return;

  const now = Date.now();

  for (const m of q) {
    if (now - m.ts <= OUTBOX_TTL_MS) {
      socket.emit(m.event, m.data);
    }
  }

  outbox.delete(peerId);
};

const deliver = (event, to, payload) => {
  const sid = sockets.get(to);

  if (sid) {
    io.to(sid).emit(event, payload);
  } else {
    pushOutbox(to, event, payload);
  }
};

// FIND ACTIVE CALL
const findActiveCall = (a, b) => {
  return [...activeCalls.values()].find(
    (c) =>
      (c.providerId === a && c.userId === b) ||
      (c.providerId === b && c.userId === a)
  );
};

io.on("connection", (socket) => {

  // REGISTER
  socket.on("register", ({ id }) => {
    if (!id) return;

    sockets.set(id, socket.id);

    socket.data.id = id;

    flushOutbox(id, socket);

    if (!providerBlocks.has(id)) {
      Provider.findById(id)
        .select("blockedUsers")
        .lean()
        .then((p) => {
          if (p && Array.isArray(p.blockedUsers)) {
            providerBlocks.set(id, new Set(p.blockedUsers));
          }
        })
        .catch(() => {});
    }
  });

  // CALL REQUEST
  socket.on("call_request", async (msg = {}) => {
    const to = msg.to;
    const from = socket.data.id;

    if (!to || !from) return;

    const blocks = providerBlocks.get(to);

    if (blocks && blocks.has(from)) {
      deliver("call_reject", from, {
        from: to,
        reason: "blocked",
      });

      return;
    }

    const provider = await Provider.findById(to);

    if (!provider) {
      return;
    }

    if (provider.busy) {
      deliver("call_reject", from, {
        from: to,
        reason: "busy",
      });

      return;
    }

    deliver("call_request", to, {
      ...msg,
      from,
    });

    // PUSH NOTIFICATION — always fire so WebView/minimized apps receive
    // an OS-level alert with sound + vibration, regardless of socket state.
    // The service worker also messages any open clients to start the in-app
    // ringtone, so foreground tabs get the audio cue immediately.
    pushToOwner(to, {
      type: "incoming_call",
      title: "📞 Incoming call · Bongo Bandhu",
      body: `${msg.fromName || "Someone"} is calling you`,
      callerId: from,
      callerName: msg.fromName || "User",
      tag: `call-${from}`,
    }).catch(() => {});
  });

  // CALL ACCEPT
  socket.on("call_accept", async (msg = {}) => {
    try {
      const userId = msg.to;
      const providerId = socket.data.id;

      if (!userId || !providerId) return;

      const billing = await Settings.findOne({
        key: "billing",
      });

      const globalSharePct = Number(
        billing?.value?.providerSharePct ?? DEFAULT_PROVIDER_SHARE_PCT
      );

      const user = await User.findById(userId);

      if (!user) {
        return;
      }

      const prov = await Provider.findById(providerId).select(
        "perMinRate sharePctOverride"
      );

      if (!prov) return;

      const perMinRate = Math.max(0, Number(prov.perMinRate) || 0);
      const providerSharePct = effectiveSharePct(prov, globalSharePct);

      const wallet = Number(user.wallet || 0);

      // Allowed seconds = how many full minutes the user can afford at this rate.
      let allowedSec = 0;
      if (perMinRate > 0) {
        const affordableMins = Math.floor(wallet / perMinRate);
        allowedSec = affordableMins * 60;
      }

      if (allowedSec <= 0) {
        deliver("call_reject", userId, {
          reason: "insufficient_balance",
        });

        return;
      }

      const callId = crypto.randomUUID();

      activeCalls.set(callId, {
        callId,
        userId,
        providerId,
        startedAt: Date.now(),
        allowedSec,
        providerSharePct,
        perMinRate,
      });

      // PROVIDER BUSY
      await Provider.updateOne(
        { _id: providerId },
        {
          $set: {
            busy: true,
          },
        }
      );

      deliver("call_accept", userId, {
        ...msg,
        from: providerId,
        allowedSec,
      });

      // AUTO END TIMER
      setTimeout(async () => {
        try {
          const call = activeCalls.get(callId);

          if (!call) return;

          const durationSec = Math.floor(
            (Date.now() - call.startedAt) / 1000
          );

          const amount = computeCallAmount(
            durationSec,
            call.perMinRate
          );

          const freshUser = await User.findById(call.userId);

          if (!freshUser) return;

          if (freshUser.wallet < amount) {
            deliver("call_end", call.userId, {
              reason: "low_balance",
            });

            deliver("call_end", call.providerId, {
              reason: "low_balance",
            });

            activeCalls.delete(callId);

            return;
          }

          const currentBonus = Math.max(
            0,
            Number(freshUser.bonusBalance || 0)
          );

          const bonusUsed = Math.min(amount, currentBonus);

          const realUsed = Math.max(
            0,
            amount - bonusUsed
          );

          const providerCredit =
            Math.round(
              ((realUsed * call.providerSharePct) / 100) * 100
            ) / 100;

          // WALLET DEDUCT
          await User.updateOne(
            { _id: call.userId },
            {
              $inc: {
                wallet: -amount,
                bonusBalance: -bonusUsed,
              },
            }
          );

          // TXN
          await Txn.create({
            userId: call.userId,
            type: "debit",
            amount,
            note: `Call ${durationSec}s`,
          });

          // PROVIDER EARNING
          await Provider.updateOne(
            { _id: call.providerId },
            {
              $inc: {
                earnings: providerCredit,
                daily: providerCredit,
              },
              $set: {
                busy: false,
              },
            }
          );

          // SAVE CALL LOG
          await CallLog.create({
            userId: call.userId,
            providerId: call.providerId,
            durationSec,
            amount,
            bonusUsed,
            realUsed,
            providerEarnings: providerCredit,
            sharePct: call.providerSharePct,
            autoCutoff: true,
          });

          deliver("call_end", call.userId, {
            reason: "balance_finished",
          });

          deliver("call_end", call.providerId, {
            reason: "balance_finished",
          });

          activeCalls.delete(callId);

        } catch (e) {
          console.error("AUTO CALL END ERROR:", e.message);
        }
      }, allowedSec * 1000);

    } catch (e) {
      console.error("CALL ACCEPT ERROR:", e.message);
    }
  });

  // CALL END
  socket.on("call_end", async (msg = {}) => {
    try {
      const to = msg.to;
      const from = socket.data.id;

      if (!to || !from) return;

      deliver("call_end", to, {
        ...msg,
        from,
      });

      const call = findActiveCall(from, to);

      if (call) {

        const durationSec = Math.floor(
          (Date.now() - call.startedAt) / 1000
        );

        const amount = computeCallAmount(
          durationSec,
          call.perMinRate
        );

        const freshUser = await User.findById(call.userId);

        if (freshUser && amount > 0) {

          if (freshUser.wallet >= amount) {

            const currentBonus = Math.max(
              0,
              Number(freshUser.bonusBalance || 0)
            );

            const bonusUsed = Math.min(
              amount,
              currentBonus
            );

            const realUsed = Math.max(
              0,
              amount - bonusUsed
            );

            const providerCredit =
              Math.round(
                ((realUsed * call.providerSharePct) / 100) * 100
              ) / 100;

            // DEDUCT WALLET
            await User.updateOne(
              { _id: call.userId },
              {
                $inc: {
                  wallet: -amount,
                  bonusBalance: -bonusUsed,
                },
              }
            );

            // TRANSACTION
            await Txn.create({
              userId: call.userId,
              type: "debit",
              amount,
              note: `Call ${durationSec}s`,
            });

            // PROVIDER EARNING
            await Provider.updateOne(
              { _id: call.providerId },
              {
                $inc: {
                  earnings: providerCredit,
                  daily: providerCredit,
                },
              }
            );

            // SAVE CALL
            await CallLog.create({
              userId: call.userId,
              providerId: call.providerId,
              durationSec,
              amount,
              bonusUsed,
              realUsed,
              providerEarnings: providerCredit,
              sharePct: call.providerSharePct,
              autoCutoff: false,
            });
          }
        }

        activeCalls.delete(call.callId);
      }

      // FREE PROVIDER
      await Provider.updateOne(
        {
          _id: from,
        },
        {
          $set: {
            busy: false,
          },
        }
      );

      await Provider.updateOne(
        {
          _id: to,
        },
        {
          $set: {
            busy: false,
          },
        }
      );

    } catch (e) {
      console.error("CALL END ERROR:", e.message);
    }
  });

  // OTHER SOCKET EVENTS
  [
    "call_reject",
    "webrtc_offer",
    "webrtc_answer",
    "webrtc_ice",
  ].forEach((ev) => {
    socket.on(ev, (msg = {}) => {
      const to = msg.to;

      if (!to) return;

      deliver(ev, to, {
        ...msg,
        from: socket.data.id,
      });
    });
  });

  // DISCONNECT
  socket.on("disconnect", async () => {
    try {
      const id = socket.data.id;

      if (id && sockets.get(id) === socket.id) {
        sockets.delete(id);

        await Provider.updateOne(
          { _id: id },
          {
            $set: {
              busy: false,
            },
          }
        );

        // FORCE END ACTIVE CALL
        const active = [...activeCalls.values()].find(
          (c) =>
            c.providerId === id ||
            c.userId === id
        );

        if (active) {

          const other =
            active.providerId === id
              ? active.userId
              : active.providerId;

          deliver("call_end", other, {
            reason: "disconnect",
          });

          activeCalls.delete(active.callId);

          await Provider.updateOne(
            {
              _id: active.providerId,
            },
            {
              $set: {
                busy: false,
              },
            }
          );
        }
      }

    } catch (e) {
      console.error("DISCONNECT ERROR:", e.message);
    }
  });

});

// ---------- Start ----------
(async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("Mongo connected");
  await seedDefaults();
  server.listen(PORT, "0.0.0.0", () => console.log(`Navya backend on :${PORT}`));
})();
