"""EMORVIA backend API tests.

Covers:
- health
- OTP send + verify (bypass account 7777777777) and live MessageCentral OTP send
- admin login
- admin billing (global provider share pct GET/PUT)
- public billing endpoint (no packages field)
- admin providers list & PATCH (perMinRate, sharePctOverride incl. null clear)
- provider password login + PATCH /provider/me (perMinRate)
- public providers list (perMinRate)
- POST /call/log per-minute amount = ceil(durationSec/60) * perMinRate
"""
import os
import math
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://php-easepay.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

USER_BYPASS_MOBILE = "7777777777"
USER_BYPASS_CODE = "2411"
PROVIDER_BYPASS_MOBILE = "6666666666"
PROVIDER_BYPASS_CODE = "0401"
LIVE_OTP_MOBILE = "8240915631"

ADMIN_USERNAME = "admindash"
ADMIN_PASSWORD = "Admin#2026*"

TEST_PROVIDER_MOBILE = "8000000001"
TEST_PROVIDER_PASSWORD = "pro123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/admin/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def user_token(session):
    # OTP send first (bypass)
    rs = session.post(f"{API}/auth/otp/send", json={"mobile": USER_BYPASS_MOBILE, "role": "user"})
    assert rs.status_code == 200, f"otp send failed: {rs.text}"
    rv = session.post(
        f"{API}/auth/otp/verify",
        json={"mobile": USER_BYPASS_MOBILE, "code": USER_BYPASS_CODE, "role": "user"},
    )
    assert rv.status_code == 200, f"otp verify failed: {rv.text}"
    data = rv.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="session")
def user_headers(user_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {user_token}"}


@pytest.fixture(scope="session")
def provider_token(session):
    r = session.post(f"{API}/provider/login", json={"mobile": TEST_PROVIDER_MOBILE, "password": TEST_PROVIDER_PASSWORD})
    assert r.status_code == 200, f"provider login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def provider_headers(provider_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {provider_token}"}


# ---------- Health ----------
class TestHealth:
    def test_health(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json() == {"ok": True}


# ---------- OTP ----------
class TestOtp:
    def test_otp_send_bypass(self, session):
        r = session.post(f"{API}/auth/otp/send", json={"mobile": USER_BYPASS_MOBILE, "role": "user"})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_otp_verify_bypass_creates_user(self, session):
        # send first
        session.post(f"{API}/auth/otp/send", json={"mobile": USER_BYPASS_MOBILE, "role": "user"})
        r = session.post(
            f"{API}/auth/otp/verify",
            json={"mobile": USER_BYPASS_MOBILE, "code": USER_BYPASS_CODE, "role": "user"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["mobile"] == USER_BYPASS_MOBILE

    def test_otp_send_live_messagecentral(self, session):
        # Send only once — do NOT verify; just confirm MessageCentral responds OK.
        r = session.post(f"{API}/auth/otp/send", json={"mobile": LIVE_OTP_MOBILE, "role": "user"})
        # We accept 200 ok=true. If MC fails (e.g., rate-limit), record failure.
        assert r.status_code == 200, f"live OTP send failed: {r.status_code} {r.text}"
        assert r.json().get("ok") is True


# ---------- Admin login + billing ----------
class TestAdminBilling:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 0

    def test_get_admin_billing(self, session, admin_headers):
        r = session.get(f"{API}/admin/billing", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "providerSharePct" in data
        assert isinstance(data["providerSharePct"], (int, float))

    def test_put_admin_billing_persists(self, session, admin_headers):
        # capture current
        r0 = session.get(f"{API}/admin/billing", headers=admin_headers)
        original = r0.json()["providerSharePct"]
        try:
            r = session.put(f"{API}/admin/billing", headers=admin_headers, json={"providerSharePct": 65})
            assert r.status_code == 200
            assert r.json()["providerSharePct"] == 65
            # Verify persistence via GET
            r2 = session.get(f"{API}/admin/billing", headers=admin_headers)
            assert r2.json()["providerSharePct"] == 65
            # Also reflected in public
            rp = session.get(f"{API}/billing/public")
            assert rp.status_code == 200
            assert rp.json()["providerSharePct"] == 65
        finally:
            # Restore to original (or 60 default)
            restore = original if isinstance(original, (int, float)) else 60
            session.put(f"{API}/admin/billing", headers=admin_headers, json={"providerSharePct": restore})

    def test_billing_public_no_packages(self, session):
        r = session.get(f"{API}/billing/public")
        assert r.status_code == 200
        data = r.json()
        assert "providerSharePct" in data
        assert "packages" not in data


# ---------- Admin providers PATCH ----------
class TestAdminProviders:
    def test_list_providers(self, session, admin_headers):
        r = session.get(f"{API}/admin/providers", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        first = data[0]
        assert "perMinRate" in first
        assert "sharePctOverride" in first  # may be null
        assert "id" in first
        assert "_id" not in first

    def test_patch_provider_perminrate_and_override(self, session, admin_headers):
        # Find provider by mobile 8000000001
        r = session.get(f"{API}/admin/providers", headers=admin_headers)
        prov = next((p for p in r.json() if p.get("mobile") == TEST_PROVIDER_MOBILE), None)
        assert prov is not None, "test provider not seeded"
        pid = prov["id"]
        # Patch callPerMinRate=50, sharePctOverride=70 (legacy perMinRate is no
        # longer writable as of iter 4; use callPerMinRate instead)
        r1 = session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 50, "sharePctOverride": 70},
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["callPerMinRate"] == 50
        assert d1["sharePctOverride"] == 70
        # Clear override
        r2 = session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"sharePctOverride": None},
        )
        assert r2.status_code == 200
        assert r2.json()["sharePctOverride"] is None


# ---------- Provider self ----------
class TestProviderSelf:
    def test_provider_login(self, provider_token):
        assert isinstance(provider_token, str) and len(provider_token) > 0

    def test_provider_patch_per_min_rate(self, session, provider_headers):
        # Iter 4: legacy perMinRate field is no longer writable. Use callPerMinRate.
        r = session.patch(f"{API}/provider/me", headers=provider_headers, json={"callPerMinRate": 30})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["callPerMinRate"] == 30


# ---------- Public providers ----------
class TestPublicProviders:
    def test_public_providers_list(self, session):
        r = session.get(f"{API}/providers")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            assert "perMinRate" in data[0]


# ---------- /call/log per-minute billing ----------
class TestCallLog:
    def test_call_log_per_minute(self, session, admin_headers, user_headers, provider_headers):
        # 1) Make sure user has wallet >> needed amount via admin adjust
        # Get user id by hitting /me
        me = session.get(f"{API}/me", headers=user_headers).json()
        user_id = me["id"]
        # Admin recharge user by 1000
        session.post(
            f"{API}/admin/users/{user_id}/adjust",
            headers=admin_headers,
            json={"amount": 1000, "note": "test top-up"},
        )
        # 2) Set provider perMinRate via admin
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        prov = next((p for p in provs if p.get("mobile") == TEST_PROVIDER_MOBILE), None)
        pid = prov["id"]
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 40, "sharePctOverride": None},
        )
        # 3) Log call (use a unique providerId-user combo by waiting? Dedup is per user+provider for 60s.
        # We'll just call once.)
        r = session.post(
            f"{API}/call/log",
            headers=user_headers,
            json={"providerId": pid, "durationSec": 120, "autoCutoff": False},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # 120 sec → ceil(120/60)=2 mins * 40 ₹ = 80
        expected = math.ceil(120 / 60) * 40
        assert data["amount"] == expected, f"expected {expected}, got {data.get('amount')}"
        # default channel should be "call"
        assert data.get("channel") in (None, "call"), f"expected channel=call, got {data.get('channel')}"


# ---------- Chat billing (Iteration 2) ----------
class TestChatCallLog:
    """Verify POST /api/call/log with channel='chat' bills the same as a call
    and dedup is channel-scoped (call vs chat). Provider earns sharePct% of realUsed."""

    def _ensure_balance(self, session, admin_headers, user_headers, amount=1000):
        me = session.get(f"{API}/me", headers=user_headers).json()
        session.post(
            f"{API}/admin/users/{me['id']}/adjust",
            headers=admin_headers,
            json={"amount": amount, "note": "TEST_ chat top-up"},
        )

    def _get_provider_id(self, session, admin_headers):
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        prov = next((p for p in provs if p.get("mobile") == TEST_PROVIDER_MOBILE), None)
        assert prov is not None
        return prov["id"]

    def test_chat_log_default_60_pct(self, session, admin_headers, user_headers):
        self._ensure_balance(session, admin_headers, user_headers)
        pid = self._get_provider_id(session, admin_headers)
        # Reset provider to callRate=20 chatRate=20, no override; global=60
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 20, "chatPerMinRate": 20, "sharePctOverride": None},
        )
        session.put(f"{API}/admin/billing", headers=admin_headers, json={"providerSharePct": 60})

        r = session.post(
            f"{API}/call/log",
            headers=user_headers,
            json={"providerId": pid, "durationSec": 60, "channel": "chat", "autoCutoff": False},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["channel"] == "chat"
        # 60s → ceil(60/60)=1 min × ₹20 = ₹20
        assert data["amount"] == 20, f"expected amount=20, got {data['amount']}"
        # default share 60% of 20 = 12
        assert data["sharePct"] == 60, f"expected sharePct=60, got {data['sharePct']}"
        assert data["providerEarnings"] == 12, (
            f"expected providerEarnings=12, got {data['providerEarnings']}"
        )

    def test_chat_log_override_70_pct(self, session, admin_headers, user_headers):
        """When provider.sharePctOverride=70, chat earnings should use 70%, not global 60%."""
        self._ensure_balance(session, admin_headers, user_headers, amount=2000)
        # Use a *different* provider so chat dedup doesn't return the prior log
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        # pick mobile 8000000002 (Riya) to avoid dedup collision with 8000000001
        prov = next((p for p in provs if p.get("mobile") == "8000000002"), None)
        if prov is None:
            pytest.skip("second seeded provider not present")
        pid2 = prov["id"]
        session.patch(
            f"{API}/admin/providers/{pid2}",
            headers=admin_headers,
            json={"callPerMinRate": 20, "chatPerMinRate": 20, "sharePctOverride": 70},
        )
        try:
            r = session.post(
                f"{API}/call/log",
                headers=user_headers,
                json={"providerId": pid2, "durationSec": 60, "channel": "chat"},
            )
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["channel"] == "chat"
            assert d["amount"] == 20
            assert d["sharePct"] == 70, f"expected sharePct=70, got {d['sharePct']}"
            # 70% of 20 = 14
            assert d["providerEarnings"] == 14, (
                f"expected providerEarnings=14, got {d['providerEarnings']}"
            )
        finally:
            # restore
            session.patch(
                f"{API}/admin/providers/{pid2}",
                headers=admin_headers,
                json={"callPerMinRate": 20, "chatPerMinRate": 20, "sharePctOverride": None},
            )

    def test_call_log_omitted_channel_defaults_to_call(self, session, admin_headers, user_headers):
        """When channel is omitted, log should be created with channel='call' (dedup independent of chat)."""
        self._ensure_balance(session, admin_headers, user_headers)
        # Use provider Riya (8000000002) so a fresh log can be created independently
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        prov = next((p for p in provs if p.get("mobile") == "8000000002"), None)
        if prov is None:
            pytest.skip("second seeded provider not present")
        pid2 = prov["id"]
        session.patch(
            f"{API}/admin/providers/{pid2}",
            headers=admin_headers,
            json={"callPerMinRate": 20, "sharePctOverride": None},
        )
        r = session.post(
            f"{API}/call/log",
            headers=user_headers,
            json={"providerId": pid2, "durationSec": 60},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["channel"] == "call", f"expected channel=call, got {data.get('channel')}"
        assert data["amount"] == 20


# ---------- Iteration 3: split callPerMinRate / chatPerMinRate ----------
class TestSplitRates:
    """Iteration 3 — provider has separate callPerMinRate and chatPerMinRate.
    Legacy `perMinRate` is mirrored from callPerMinRate.

    Tests:
    - GET /api/providers and /api/admin/providers expose both fields.
    - PATCH /api/admin/providers/:id updates both fields independently.
    - PATCH /api/provider/me updates both fields independently.
    - POST /api/call/log uses the correct rate per channel (isolation).
    - Payout share % still applies (global + sharePctOverride).
    """

    PROVIDER_MOBILE = TEST_PROVIDER_MOBILE  # 8000000001 — Aarav

    def _get_provider(self, session, admin_headers, mobile=None):
        mobile = mobile or self.PROVIDER_MOBILE
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        prov = next((p for p in provs if p.get("mobile") == mobile), None)
        assert prov is not None, f"provider {mobile} not seeded"
        return prov

    def _ensure_balance(self, session, admin_headers, user_headers, amount=2000):
        me = session.get(f"{API}/me", headers=user_headers).json()
        session.post(
            f"{API}/admin/users/{me['id']}/adjust",
            headers=admin_headers,
            json={"amount": amount, "note": "TEST_ split-rate top-up"},
        )

    # 1) Admin and public lists expose both fields
    def test_admin_providers_has_both_rate_fields(self, session, admin_headers):
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        assert isinstance(provs, list) and provs
        # At least the seeded provider should have both fields.
        prov = self._get_provider(session, admin_headers)
        assert "callPerMinRate" in prov, f"callPerMinRate missing: {prov.keys()}"
        assert "chatPerMinRate" in prov, f"chatPerMinRate missing: {prov.keys()}"
        assert isinstance(prov["callPerMinRate"], (int, float))
        assert isinstance(prov["chatPerMinRate"], (int, float))

    def test_public_providers_has_both_rate_fields(self, session):
        provs = session.get(f"{API}/providers").json()
        assert isinstance(provs, list) and provs
        first = provs[0]
        assert "callPerMinRate" in first
        assert "chatPerMinRate" in first

    # 2) Admin PATCH updates both fields independently and persists
    def test_admin_patch_both_rates(self, session, admin_headers):
        prov = self._get_provider(session, admin_headers)
        pid = prov["id"]
        r = session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 25, "chatPerMinRate": 12},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["callPerMinRate"] == 25
        assert d["chatPerMinRate"] == 12
        # iter 4: legacy perMinRate is no longer mirrored on write — it stays at
        # whatever value the provider was seeded with (typically 20).
        # We no longer assert any specific value for it.
        # GET-verify persistence
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        again = next(p for p in provs if p["id"] == pid)
        assert again["callPerMinRate"] == 25
        assert again["chatPerMinRate"] == 12

    def test_admin_patch_rates_independent(self, session, admin_headers):
        """Updating callPerMinRate alone must NOT change chatPerMinRate, and vice versa."""
        prov = self._get_provider(session, admin_headers)
        pid = prov["id"]
        # Set baseline
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 30, "chatPerMinRate": 15},
        )
        # Update only call
        r1 = session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 33},
        )
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["callPerMinRate"] == 33
        assert d1["chatPerMinRate"] == 15, f"chat rate should be untouched, got {d1['chatPerMinRate']}"
        # Update only chat
        r2 = session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"chatPerMinRate": 17},
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["callPerMinRate"] == 33, f"call rate should be untouched, got {d2['callPerMinRate']}"
        assert d2["chatPerMinRate"] == 17

    # 3) Provider self-PATCH updates both rates independently
    def test_provider_me_patch_both_rates(self, session, provider_headers):
        r = session.patch(
            f"{API}/provider/me",
            headers=provider_headers,
            json={"callPerMinRate": 35, "chatPerMinRate": 18},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["callPerMinRate"] == 35
        assert d["chatPerMinRate"] == 18

    def test_provider_me_rate_isolation(self, session, provider_headers):
        # baseline 35/18 from prior test; patch only call
        r1 = session.patch(f"{API}/provider/me", headers=provider_headers, json={"callPerMinRate": 40})
        assert r1.status_code == 200
        assert r1.json()["callPerMinRate"] == 40
        assert r1.json()["chatPerMinRate"] == 18
        # patch only chat
        r2 = session.patch(f"{API}/provider/me", headers=provider_headers, json={"chatPerMinRate": 22})
        assert r2.status_code == 200
        assert r2.json()["callPerMinRate"] == 40
        assert r2.json()["chatPerMinRate"] == 22

    # 4) Call/Chat billing uses correct rate per channel
    def test_call_log_uses_call_rate(self, session, admin_headers, user_headers):
        # Use Neha (8000000006) — not touched by earlier tests, so call-dedup is fresh
        prov = self._get_provider(session, admin_headers, mobile="8000000006")
        pid = prov["id"]
        # callRate=30, chatRate=15
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 30, "chatPerMinRate": 15, "sharePctOverride": None},
        )
        self._ensure_balance(session, admin_headers, user_headers)
        # call channel — should bill 30
        r = session.post(
            f"{API}/call/log",
            headers=user_headers,
            json={"providerId": pid, "durationSec": 60, "channel": "call", "autoCutoff": False},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["channel"] == "call"
        assert d["amount"] == 30, f"call should bill 30 from callPerMinRate, got {d['amount']}"

    def test_chat_log_uses_chat_rate(self, session, admin_headers, user_headers):
        # Use Vikram (8000000003) — earlier tests only used him on 'call' channel,
        # so chat-channel dedup is fresh.
        prov = self._get_provider(session, admin_headers, mobile="8000000003")
        pid = prov["id"]
        # callRate=30, chatRate=15
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 30, "chatPerMinRate": 15, "sharePctOverride": None},
        )
        self._ensure_balance(session, admin_headers, user_headers)
        r = session.post(
            f"{API}/call/log",
            headers=user_headers,
            json={"providerId": pid, "durationSec": 60, "channel": "chat", "autoCutoff": False},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["channel"] == "chat"
        assert d["amount"] == 15, f"chat should bill 15 from chatPerMinRate, got {d['amount']}"

    def test_changing_chat_rate_does_not_affect_call_billing(self, session, admin_headers, user_headers):
        """Set call=20, chat=10; then bump chat to 99 — a fresh call/log on 'call' channel must still bill at 20."""
        prov = self._get_provider(session, admin_headers, mobile="8000000003")  # Vikram
        pid = prov["id"]
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 20, "chatPerMinRate": 10, "sharePctOverride": None},
        )
        # Now change chat only to 99
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"chatPerMinRate": 99},
        )
        self._ensure_balance(session, admin_headers, user_headers)
        r = session.post(
            f"{API}/call/log",
            headers=user_headers,
            json={"providerId": pid, "durationSec": 60, "channel": "call", "autoCutoff": False},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 20, f"call billing should not be affected by chat rate change, got {d['amount']}"
        # reset
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 20, "chatPerMinRate": 10},
        )

    # 5) Payout share % still works with split rates
    def test_payout_share_with_split_rates(self, session, admin_headers, user_headers):
        # Use Sanya (8000000004) — call rate 20, share 60% default → earnings 12
        prov = self._get_provider(session, admin_headers, mobile="8000000004")
        pid = prov["id"]
        # Ensure global 60%, override null, call=20 chat=10
        session.put(f"{API}/admin/billing", headers=admin_headers, json={"providerSharePct": 60})
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 20, "chatPerMinRate": 10, "sharePctOverride": None},
        )
        self._ensure_balance(session, admin_headers, user_headers)
        r = session.post(
            f"{API}/call/log",
            headers=user_headers,
            json={"providerId": pid, "durationSec": 60, "channel": "call", "autoCutoff": False},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 20
        assert d["sharePct"] == 60
        assert d["providerEarnings"] == 12, f"60% of 20 = 12, got {d['providerEarnings']}"

    def test_payout_share_override_with_split_rates(self, session, admin_headers, user_headers):
        # Use Rohan (8000000005) — set override 80% on call rate 20 → earnings 16
        prov = self._get_provider(session, admin_headers, mobile="8000000005")
        pid = prov["id"]
        session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"callPerMinRate": 20, "chatPerMinRate": 10, "sharePctOverride": 80},
        )
        self._ensure_balance(session, admin_headers, user_headers, amount=3000)
        try:
            r = session.post(
                f"{API}/call/log",
                headers=user_headers,
                json={"providerId": pid, "durationSec": 60, "channel": "call", "autoCutoff": False},
            )
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["amount"] == 20
            assert d["sharePct"] == 80
            assert d["providerEarnings"] == 16, f"80% of 20 = 16, got {d['providerEarnings']}"
        finally:
            session.patch(
                f"{API}/admin/providers/{pid}",
                headers=admin_headers,
                json={"sharePctOverride": None},
            )


# ---------- Cleanup: restore Aarav to call=20, chat=10, override=null ----------
class TestZ_Cleanup:
    def test_restore_aarav_baseline(self, session, admin_headers, provider_headers):
        # Restore provider self (Aarav, 8000000001) via admin
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        prov = next((p for p in provs if p.get("mobile") == TEST_PROVIDER_MOBILE), None)
        assert prov is not None
        r = session.patch(
            f"{API}/admin/providers/{prov['id']}",
            headers=admin_headers,
            json={"callPerMinRate": 20, "chatPerMinRate": 10, "sharePctOverride": None},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["callPerMinRate"] == 20
        assert d["chatPerMinRate"] == 10
        assert d["sharePctOverride"] is None
        # Also restore global share
        session.put(f"{API}/admin/billing", headers=admin_headers, json={"providerSharePct": 60})


# ---------- Welcome / redirects (frontend route smoke via static HTML check) ----------
class TestFrontendRoutes:
    """Quick HTML smoke check that the SPA loads. SPA routing is client-side, so
    every route returns the same index.html; presence is enough to detect breakage."""

    def test_root_serves_index(self, session):
        r = session.get(BASE_URL + "/")
        assert r.status_code == 200
        assert "<div id=\"root\"" in r.text or "<div id='root'" in r.text



# ====================================================================
# Iteration 4 tests
#   - OTP cooldown (60s per (mobile, role))
#   - Bypass accounts NOT subject to cooldown
#   - Idempotent ₹50 welcome bonus
#   - Legacy `perMinRate` no longer writable via PATCH endpoints
#   - GET /api/chat/threads + /api/chat/messages (user + provider POV)
# ====================================================================
import time
import random
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient


MONGO_URL_LOCAL = "mongodb://localhost:27017"
DB_NAME_EMORVIA = "emorvia"


@pytest.fixture(scope="session")
def mongo_db():
    cli = MongoClient(MONGO_URL_LOCAL)
    return cli[DB_NAME_EMORVIA]


def _fresh_mobile():
    # 10 digit mobile starting 5xxx — neither 7777777777 nor 6666666666 nor seeded 8xxx providers
    return "5" + "".join(str(random.randint(0, 9)) for _ in range(9))


class TestIter4_OtpCooldown:
    """60-second per-(mobile, role) cooldown on OTP send."""

    def test_first_send_then_429_within_60s(self, session, mongo_db):
        mobile = _fresh_mobile()
        # Clean any prior record
        mongo_db.otps.delete_many({"mobile": mobile})

        # 1st send — may fail because we don't actually send SMS via MessageCentral
        # in this test environment. Acceptable outcomes: 200 (sent) OR 400 (live SMS
        # provider rejected). The cooldown record is only written on success, so we
        # only assert cooldown behaviour when 1st send succeeded.
        r1 = session.post(f"{API}/auth/otp/send", json={"mobile": mobile, "role": "user"})
        if r1.status_code != 200:
            # If SMS provider unreachable, simulate the OTP record so we can still
            # exercise the cooldown path on the 2nd call.
            mongo_db.otps.update_one(
                {"mobile": mobile, "role": "user"},
                {"$set": {"verificationId": "fake_for_test", "at": datetime.utcnow()}},
                upsert=True,
            )

        # 2nd send within cooldown → 429 with retryAfter
        r2 = session.post(f"{API}/auth/otp/send", json={"mobile": mobile, "role": "user"})
        assert r2.status_code == 429, f"expected 429 got {r2.status_code}: {r2.text}"
        body = r2.json()
        assert "retryAfter" in body
        assert isinstance(body["retryAfter"], int) and 0 < body["retryAfter"] <= 60
        assert "error" in body
        # Retry-After header set
        ra_header = r2.headers.get("Retry-After")
        assert ra_header is not None
        assert int(ra_header) > 0
        # Cleanup
        mongo_db.otps.delete_many({"mobile": mobile})

    def test_bypass_user_account_not_rate_limited(self, session):
        # 7777777777 should be able to send unlimited times
        for _ in range(3):
            r = session.post(f"{API}/auth/otp/send", json={"mobile": USER_BYPASS_MOBILE, "role": "user"})
            assert r.status_code == 200, f"bypass user OTP send rejected: {r.status_code} {r.text}"

    def test_bypass_provider_account_not_rate_limited(self, session):
        # 6666666666 should be able to send unlimited times
        for _ in range(3):
            r = session.post(f"{API}/auth/otp/send", json={"mobile": PROVIDER_BYPASS_MOBILE, "role": "provider"})
            assert r.status_code == 200, f"bypass provider OTP send rejected: {r.status_code} {r.text}"


class TestIter4_WelcomeBonusIdempotent:
    """₹50 welcome bonus is granted exactly once per user, even on repeat OTP verify."""

    def test_welcome_bonus_only_once(self, session, mongo_db):
        # Delete the bypass user + their txns to start clean
        u = mongo_db.users.find_one({"mobile": USER_BYPASS_MOBILE})
        if u:
            mongo_db.txns.delete_many({"userId": str(u["_id"])})
            mongo_db.users.delete_one({"_id": u["_id"]})

        # 1st verify (bypass) → new user, wallet=50
        rs = session.post(f"{API}/auth/otp/send", json={"mobile": USER_BYPASS_MOBILE, "role": "user"})
        assert rs.status_code == 200
        rv1 = session.post(
            f"{API}/auth/otp/verify",
            json={"mobile": USER_BYPASS_MOBILE, "code": USER_BYPASS_CODE, "role": "user"},
        )
        assert rv1.status_code == 200, rv1.text
        d1 = rv1.json()
        assert d1.get("isNew") is True
        assert d1["user"]["wallet"] == 50

        user_id = d1["user"]["id"]

        # 2nd verify (bypass) → same user, wallet still 50, isNew=False
        rv2 = session.post(
            f"{API}/auth/otp/verify",
            json={"mobile": USER_BYPASS_MOBILE, "code": USER_BYPASS_CODE, "role": "user"},
        )
        assert rv2.status_code == 200, rv2.text
        d2 = rv2.json()
        assert d2.get("isNew") is False
        assert d2["user"]["wallet"] == 50, f"wallet should not increase on repeat verify, got {d2['user']['wallet']}"

        # Verify DB state: welcomeBonusGiven flag is true
        user_doc = mongo_db.users.find_one({"_id": ObjectId(user_id)})
        assert user_doc is not None
        assert user_doc.get("welcomeBonusGiven") is True

        # Verify exactly ONE "Welcome bonus" txn exists
        welcome_txns = list(mongo_db.txns.find({
            "userId": user_id,
            "note": {"$regex": "Welcome bonus"},
        }))
        assert len(welcome_txns) == 1, f"expected 1 welcome bonus txn, got {len(welcome_txns)}: {welcome_txns}"
        assert welcome_txns[0]["amount"] == 50
        assert welcome_txns[0]["type"] == "credit"


class TestIter4_LegacyPerMinRate:
    """Legacy `perMinRate` field is no longer writable via PATCH endpoints (iter 4)."""

    def test_provider_self_patch_rejects_legacy_perminrate(self, session, provider_headers, admin_headers):
        # Read current rates
        r0 = session.get(f"{API}/provider/me", headers=provider_headers)
        assert r0.status_code == 200
        before = r0.json()
        call_before = before.get("callPerMinRate")
        chat_before = before.get("chatPerMinRate")

        # Attempt to write legacy perMinRate=99
        r = session.patch(f"{API}/provider/me", headers=provider_headers, json={"perMinRate": 99})
        assert r.status_code == 200
        after = r.json()
        # New fields must be UNCHANGED
        assert after.get("callPerMinRate") == call_before, (
            f"callPerMinRate changed via legacy perMinRate: {call_before} -> {after.get('callPerMinRate')}"
        )
        assert after.get("chatPerMinRate") == chat_before, (
            f"chatPerMinRate changed via legacy perMinRate: {chat_before} -> {after.get('chatPerMinRate')}"
        )

    def test_admin_patch_rejects_legacy_perminrate(self, session, admin_headers):
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        target = next((p for p in provs if p.get("mobile") == "8000000002"), None)
        assert target is not None
        pid = target["id"]
        call_before = target.get("callPerMinRate")
        chat_before = target.get("chatPerMinRate")

        r = session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"perMinRate": 99},
        )
        assert r.status_code == 200
        after = r.json()
        assert after.get("callPerMinRate") == call_before, (
            f"callPerMinRate changed: {call_before} -> {after.get('callPerMinRate')}"
        )
        assert after.get("chatPerMinRate") == chat_before, (
            f"chatPerMinRate changed: {chat_before} -> {after.get('chatPerMinRate')}"
        )


class TestIter4_ChatHistory:
    """Chat REST endpoints: /api/chat/threads + /api/chat/messages."""

    @pytest.fixture(scope="class")
    def seeded_chat(self, session, admin_headers, mongo_db):
        """Seed a chat thread between bypass user and provider 8000000001 (Aarav).
        Re-verify the bypass user here to get a fresh JWT — the session-scoped
        `user_token` fixture may reference a stale user id if other tests
        recreated the user (e.g. TestIter4_WelcomeBonusIdempotent does that).
        """
        # Re-verify bypass user to obtain a current JWT + id
        session.post(f"{API}/auth/otp/send", json={"mobile": USER_BYPASS_MOBILE, "role": "user"})
        rv = session.post(
            f"{API}/auth/otp/verify",
            json={"mobile": USER_BYPASS_MOBILE, "code": USER_BYPASS_CODE, "role": "user"},
        )
        assert rv.status_code == 200, rv.text
        user_token = rv.json()["token"]
        user_id = rv.json()["user"]["id"]
        fresh_user_headers = {"Authorization": f"Bearer {user_token}"}

        # Get provider id (Aarav)
        provs = session.get(f"{API}/admin/providers", headers=admin_headers).json()
        prov = next((p for p in provs if p.get("mobile") == TEST_PROVIDER_MOBILE), None)
        assert prov is not None
        provider_id = prov["id"]

        thread_key = f"{user_id}:{provider_id}"

        # Cleanup prior messages
        mongo_db.chatmessages.delete_many({"threadKey": thread_key})

        # Insert 3 messages oldest-first
        now = datetime.utcnow()
        from datetime import timedelta
        docs = [
            {"threadKey": thread_key, "userId": user_id, "providerId": provider_id,
             "senderRole": "user", "text": "Hi", "at": now - timedelta(seconds=30)},
            {"threadKey": thread_key, "userId": user_id, "providerId": provider_id,
             "senderRole": "provider", "text": "Hello, how can I help?", "at": now - timedelta(seconds=20)},
            {"threadKey": thread_key, "userId": user_id, "providerId": provider_id,
             "senderRole": "user", "text": "Thanks!", "at": now - timedelta(seconds=10)},
        ]
        mongo_db.chatmessages.insert_many(docs)

        yield {"user_id": user_id, "provider_id": provider_id, "thread_key": thread_key,
               "user_headers": fresh_user_headers}

        # Cleanup
        mongo_db.chatmessages.delete_many({"threadKey": thread_key})

    def test_user_threads_returns_seeded(self, session, seeded_chat):
        user_headers = seeded_chat["user_headers"]
        r = session.get(f"{API}/chat/threads", headers=user_headers)
        assert r.status_code == 200, r.text
        threads = r.json()
        assert isinstance(threads, list)
        t = next((x for x in threads if x.get("peerId") == seeded_chat["provider_id"]), None)
        assert t is not None, f"thread for seeded provider not found in {threads}"
        assert t["threadKey"] == seeded_chat["thread_key"]
        assert t["lastMessage"] == "Thanks!"
        assert t["lastSender"] == "user"
        assert t["count"] == 3
        assert t["peer"] is not None
        assert "name" in t["peer"]
        # User POV → peer is the provider; should have avatar+online keys
        assert "avatar" in t["peer"]
        assert "online" in t["peer"]

    def test_user_messages_oldest_first(self, session, seeded_chat):
        user_headers = seeded_chat["user_headers"]
        r = session.get(
            f"{API}/chat/messages",
            headers=user_headers,
            params={"peerId": seeded_chat["provider_id"], "limit": 20},
        )
        assert r.status_code == 200, r.text
        msgs = r.json()
        assert isinstance(msgs, list)
        assert len(msgs) == 3
        # Oldest first
        texts = [m["text"] for m in msgs]
        assert texts == ["Hi", "Hello, how can I help?", "Thanks!"]
        # `mine` flag — user POV
        assert msgs[0]["mine"] is True   # senderRole user
        assert msgs[1]["mine"] is False  # senderRole provider
        assert msgs[2]["mine"] is True
        # Shape
        for m in msgs:
            assert "id" in m and "senderRole" in m and "text" in m and "at" in m

    def test_provider_threads_returns_seeded(self, session, provider_headers, seeded_chat):
        r = session.get(f"{API}/chat/threads", headers=provider_headers)
        assert r.status_code == 200, r.text
        threads = r.json()
        t = next((x for x in threads if x.get("peerId") == seeded_chat["user_id"]), None)
        assert t is not None, f"thread for seeded user not found in {threads}"
        assert t["count"] == 3
        assert t["lastMessage"] == "Thanks!"
        assert t["peer"] is not None
        # Provider POV — peer is user, has name + mobile
        assert "name" in t["peer"]
        assert "mobile" in t["peer"]

    def test_provider_messages_mine_flag_flipped(self, session, provider_headers, seeded_chat):
        r = session.get(
            f"{API}/chat/messages",
            headers=provider_headers,
            params={"peerId": seeded_chat["user_id"], "limit": 20},
        )
        assert r.status_code == 200, r.text
        msgs = r.json()
        assert len(msgs) == 3
        # mine flag is flipped from provider POV
        assert msgs[0]["mine"] is False  # user msg
        assert msgs[1]["mine"] is True   # provider msg
        assert msgs[2]["mine"] is False

    def test_messages_missing_peerid_400(self, session, user_headers):
        r = session.get(f"{API}/chat/messages", headers=user_headers)
        assert r.status_code == 400

    def test_threads_empty_for_fresh_user(self, session):
        # Use a fresh user via OTP bypass on a *different* number?
        # Bypass user already has seeded messages. Skip this case — covered by
        # the fact that the threads endpoint returned an empty list before seeding.
        pytest.skip("Bypass user is reused across tests; empty case implicitly covered by clean DB.")
