// Real API client — axios against the Node backend. Same import surface as
// before (`api.xxx`), but every method is now async and returns a Promise.

import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

export const http = axios.create({ baseURL: BACKEND, timeout: 25000 });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("emorvia_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const unwrap = async (p) => {
  try { return (await p).data; }
  catch (e) {
    const msg = e?.response?.data?.error || e?.message || "Network error";
    throw new Error(msg);
  }
};

export const api = {
  // ----- auth (OTP) -----
  otpSend: ({ mobile, role }) => unwrap(http.post("/api/auth/otp/send", { mobile, role })),
  otpVerify: ({ mobile, code, role }) => unwrap(http.post("/api/auth/otp/verify", { mobile, code, role })),

  // ----- legacy password auth (kept for fallback) -----
  registerUser: ({ mobile, password }) => unwrap(http.post("/api/auth/register", { mobile, password })),
  loginUser: ({ mobile, password }) => unwrap(http.post("/api/auth/login", { mobile, password })),
  loginProvider: ({ mobile, password }) => unwrap(http.post("/api/provider/login", { mobile, password })),
  adminLogin: (username, password) => unwrap(http.post("/api/admin/login", { username, password })),

  // ----- web push -----
  pushVapidKey: () => unwrap(http.get("/api/push/vapid-public-key")),
  pushSubscribe: (subscription) => unwrap(http.post("/api/push/subscribe", { subscription, userAgent: navigator.userAgent })),
  pushUnsubscribe: (endpoint) => unwrap(http.post("/api/push/unsubscribe", { endpoint })),
  pushTest: () => unwrap(http.post("/api/push/test")),

  // ----- provider self -----
  providerUpdateProfile: (patch) => unwrap(http.patch("/api/provider/me", patch)),
  providerUploadImages: async (files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    return unwrap(http.post("/api/provider/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }));
  },

  // ----- user -----
  getMe: () => unwrap(http.get("/api/me")),
  getMyTxns: () => unwrap(http.get("/api/me/txns")),
  deleteMe: () => unwrap(http.delete("/api/me")),
  requestRecharge: ({ amount, refNote }) => unwrap(http.post("/api/recharge", { amount, refNote })),
  saveCallLog: ({ providerId, durationSec, amount, autoCutoff }) =>
    unwrap(http.post("/api/call/log", { providerId, durationSec, amount, autoCutoff })),

  // ----- public catalog -----
  getProviders: () => unwrap(http.get("/api/providers")),
  getProvider: (id) => unwrap(http.get(`/api/providers/${id}`)),
  getPaymentSettings: () => unwrap(http.get("/api/payments/settings")),
  // getRazorpayEnabled: () => unwrap(http.get("/api/razorpay/enabled")), // REMOVED
  getPublicBilling: () => unwrap(http.get("/api/billing/public")),
  getLanguages: () => unwrap(http.get("/api/languages")),
  adminGetLanguages: () => unwrap(http.get("/api/admin/languages")),
  adminAddLanguage: (name) => unwrap(http.post("/api/admin/languages", { name })),
  adminDeleteLanguage: (name) => unwrap(http.delete(`/api/admin/languages/${encodeURIComponent(name)}`)),
  getAdminWhatsapp: () => unwrap(http.get("/api/whatsapp/number")),

  // ----- razorpay (REMOVED) -----
  // rzpCreateOrder: (amount) => unwrap(http.post("/api/razorpay/create-order", { amount })),
  // rzpVerify: (payload) => unwrap(http.post("/api/razorpay/verify", payload)),

  // ----- provider self -----
  getProviderMe: () => unwrap(http.get("/api/provider/me")),
  deleteProviderMe: () => unwrap(http.delete("/api/provider/me")),
  setProviderOnline: (online) => unwrap(http.patch("/api/provider/me", { online })),
  getProviderMyCalls: () => unwrap(http.get("/api/provider/me/calls")),
  providerGetBlocks: () => unwrap(http.get("/api/provider/me/blocks")),
  providerBlockUser: (userId) => unwrap(http.post("/api/provider/me/block", { userId })),
  providerUnblockUser: (userId) => unwrap(http.post("/api/provider/me/unblock", { userId })),

  // ----- admin -----
  adminGetUsers: () => unwrap(http.get("/api/admin/users")),
  adminAddUser: (data) => unwrap(http.post("/api/admin/users", data)),
  adminUpdateUser: (id, patch) => unwrap(http.patch(`/api/admin/users/${id}`, patch)),
  adminDeleteUser: (id) => unwrap(http.delete(`/api/admin/users/${id}`)),
  adminAdjustUser: (id, delta, note) => unwrap(http.post(`/api/admin/users/${id}/adjust`, { delta, note })),

  adminGetProviders: () => unwrap(http.get("/api/admin/providers")),
  adminAddProvider: (data) => unwrap(http.post("/api/admin/providers", data)),
  adminUpdateProvider: (id, patch) => unwrap(http.patch(`/api/admin/providers/${id}`, patch)),
  adminDeleteProvider: (id) => unwrap(http.delete(`/api/admin/providers/${id}`)),

  adminGetRecharges: () => unwrap(http.get("/api/admin/recharges")),
  adminApproveRecharge: (id) => unwrap(http.post(`/api/admin/recharges/${id}/approve`)),
  adminRejectRecharge: (id) => unwrap(http.post(`/api/admin/recharges/${id}/reject`)),
  adminGetCalls: () => unwrap(http.get("/api/admin/calls")),
  adminGetPayouts: (params = {}) => unwrap(http.get("/api/admin/payouts", { params })),
  adminMarkPayoutDone: (data) => unwrap(http.post("/api/admin/payouts/mark-done", data)),
  adminPayoutHistory: (providerId) => unwrap(http.get("/api/admin/payouts/history", { params: providerId ? { providerId } : {} })),
  adminClearProviderPayouts: (providerId) => unwrap(http.delete(`/api/admin/payouts/clear/${providerId}`)),
  adminPayoutsCsvUrl: (params = {}) => {
    const qs = new URLSearchParams({ ...params, format: "csv" }).toString();
    return `${BACKEND}/api/admin/payouts?${qs}`;
  },
  adminSavePayments: (data) => unwrap(http.put("/api/admin/payments/settings", data)),
  adminGetBilling: () => unwrap(http.get("/api/admin/billing")),
  adminSaveBilling: (data) => unwrap(http.put("/api/admin/billing", data)),
  adminChangePassword: (currentPassword, newPassword) => unwrap(http.post("/api/admin/change-password", { currentPassword, newPassword })),
  adminGetWhatsapp: () => unwrap(http.get("/api/admin/whatsapp")),
  adminSaveWhatsapp: (data) => unwrap(http.put("/api/admin/whatsapp", data)),
  adminGetUpi: () => unwrap(http.get("/api/admin/upi")),
  adminSaveUpi: (data) => unwrap(http.put("/api/admin/upi", data)),
  getUpiSettings: () => unwrap(http.get("/api/upi/settings")),
  initiateUpiPayment: (amount) => unwrap(http.post("/api/upi/initiate", { amount })),

  // ----- external payment (PHP gateway: Cashfree / Razorpay) -----
  getExtPaymentEnabled: () => unwrap(http.get("/api/ext-payment/enabled")),
  initiateExtPayment: (amount, customer) => unwrap(http.post("/api/ext-payment/initiate", { amount, ...customer })),
  adminGetExtPayment: () => unwrap(http.get("/api/admin/ext-payment")),
  adminSaveExtPayment: (data) => unwrap(http.put("/api/admin/ext-payment", data)),
  // adminGetRazorpay: () => unwrap(http.get("/api/admin/razorpay")), // REMOVED
  // adminSaveRazorpay: (data) => unwrap(http.put("/api/admin/razorpay", data)), // REMOVED

  // Upload provider images (multipart). Returns { urls: [...] }
  adminUploadImages: async (files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    return unwrap(http.post("/api/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }));
  },
  adminUpload: (formData) => unwrap(http.post("/api/admin/upload", formData, { headers: { "Content-Type": "multipart/form-data" } })),
};
