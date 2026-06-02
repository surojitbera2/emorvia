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

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://emorvia-redesign.preview.emergentagent.com").rstrip("/")
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
        # Patch perMinRate=50, sharePctOverride=70
        r1 = session.patch(
            f"{API}/admin/providers/{pid}",
            headers=admin_headers,
            json={"perMinRate": 50, "sharePctOverride": 70},
        )
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["perMinRate"] == 50
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
        r = session.patch(f"{API}/provider/me", headers=provider_headers, json={"perMinRate": 30})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["perMinRate"] == 30


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
            json={"perMinRate": 40, "sharePctOverride": None},
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
