#!/usr/bin/env python3
"""
Backend API test suite for Emorvia FCM integration
Tests both existing endpoints (regression) and new FCM endpoints
"""

import requests
import jwt
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8001/api"
JWT_SECRET = "emorvia_jwt_secret_change_in_prod_2026"
PROVIDER_ID = "6a244cd77685a8ce233e3cbb"  # From MongoDB

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(name, passed, details=""):
    """Log test result"""
    global tests_passed, tests_failed
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    
    test_results.append({
        "name": name,
        "passed": passed,
        "details": details
    })
    
    if passed:
        tests_passed += 1
    else:
        tests_failed += 1

def create_provider_jwt(provider_id):
    """Create a JWT token for provider authentication"""
    payload = {
        "id": provider_id,
        "role": "provider",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def test_health():
    """Test health endpoint"""
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        passed = resp.status_code == 200 and resp.json().get("ok") == True
        log_test("Health check", passed, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("Health check", False, f"Error: {str(e)}")

def test_providers_list():
    """Test GET /api/providers (public endpoint)"""
    try:
        resp = requests.get(f"{BASE_URL}/providers", timeout=5)
        passed = resp.status_code == 200
        if passed:
            data = resp.json()
            passed = isinstance(data, list) and len(data) > 0
            log_test("GET /api/providers", passed, f"Returned {len(data)} providers")
        else:
            log_test("GET /api/providers", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("GET /api/providers", False, f"Error: {str(e)}")

def test_payment_settings():
    """Test GET /api/payments/settings"""
    try:
        resp = requests.get(f"{BASE_URL}/payments/settings", timeout=5)
        passed = resp.status_code == 200
        if passed:
            data = resp.json()
            log_test("GET /api/payments/settings", passed, f"Settings retrieved")
        else:
            log_test("GET /api/payments/settings", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("GET /api/payments/settings", False, f"Error: {str(e)}")

def test_vapid_key():
    """Test GET /api/push/vapid-public-key"""
    try:
        resp = requests.get(f"{BASE_URL}/push/vapid-public-key", timeout=5)
        passed = resp.status_code == 200
        if passed:
            data = resp.json()
            passed = "key" in data and len(data["key"]) > 0
            log_test("GET /api/push/vapid-public-key", passed, f"VAPID key retrieved")
        else:
            log_test("GET /api/push/vapid-public-key", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("GET /api/push/vapid-public-key", False, f"Error: {str(e)}")

def test_fcm_register_no_auth():
    """Test POST /api/push/fcm/register without auth (should fail)"""
    try:
        resp = requests.post(
            f"{BASE_URL}/push/fcm/register",
            json={"token": "test_token"},
            timeout=5
        )
        passed = resp.status_code in [401, 403]
        log_test("FCM register without auth", passed, f"Status: {resp.status_code} (expected 401/403)")
    except Exception as e:
        log_test("FCM register without auth", False, f"Error: {str(e)}")

def test_fcm_register_no_token():
    """Test POST /api/push/fcm/register with auth but no token (should fail)"""
    try:
        token = create_provider_jwt(PROVIDER_ID)
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(
            f"{BASE_URL}/push/fcm/register",
            json={},
            headers=headers,
            timeout=5
        )
        passed = resp.status_code == 400
        log_test("FCM register without token", passed, f"Status: {resp.status_code} (expected 400)")
    except Exception as e:
        log_test("FCM register without token", False, f"Error: {str(e)}")

def test_fcm_register_valid():
    """Test POST /api/push/fcm/register with valid token"""
    try:
        token = create_provider_jwt(PROVIDER_ID)
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(
            f"{BASE_URL}/push/fcm/register",
            json={
                "token": "fake_fcm_token_for_test_12345",
                "platform": "android",
                "userAgent": "Test Agent"
            },
            headers=headers,
            timeout=5
        )
        passed = resp.status_code == 200
        if passed:
            data = resp.json()
            passed = data.get("ok") == True and data.get("fcmReady") == False
            log_test("FCM register with valid token", passed, 
                    f"Response: ok={data.get('ok')}, fcmReady={data.get('fcmReady')}")
        else:
            log_test("FCM register with valid token", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("FCM register with valid token", False, f"Error: {str(e)}")

def test_fcm_unregister():
    """Test POST /api/push/fcm/unregister"""
    try:
        token = create_provider_jwt(PROVIDER_ID)
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(
            f"{BASE_URL}/push/fcm/unregister",
            json={"token": "fake_fcm_token_for_test_12345"},
            headers=headers,
            timeout=5
        )
        passed = resp.status_code == 200
        if passed:
            data = resp.json()
            passed = data.get("ok") == True
            log_test("FCM unregister", passed, f"Response: ok={data.get('ok')}")
        else:
            log_test("FCM unregister", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("FCM unregister", False, f"Error: {str(e)}")

def test_fcm_test_endpoint():
    """Test POST /api/push/fcm/test (should return 503 when FCM disabled)"""
    try:
        token = create_provider_jwt(PROVIDER_ID)
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.post(
            f"{BASE_URL}/push/fcm/test",
            json={},
            headers=headers,
            timeout=5
        )
        passed = resp.status_code == 503
        if passed:
            data = resp.json()
            passed = "error" in data and "FCM not configured" in data["error"]
            log_test("FCM test endpoint (FCM disabled)", passed, 
                    f"Status: {resp.status_code}, Error: {data.get('error')}")
        else:
            log_test("FCM test endpoint (FCM disabled)", False, 
                    f"Status: {resp.status_code} (expected 503)")
    except Exception as e:
        log_test("FCM test endpoint (FCM disabled)", False, f"Error: {str(e)}")

def test_otp_send():
    """Test POST /api/auth/otp/send (basic validation, not actual OTP)"""
    try:
        resp = requests.post(
            f"{BASE_URL}/auth/otp/send",
            json={"mobile": "9999999999", "role": "user"},
            timeout=5
        )
        # Accept 200 (success) or 4xx (validation error), but not 500
        passed = resp.status_code != 500
        log_test("POST /api/auth/otp/send", passed, f"Status: {resp.status_code} (not 500)")
    except Exception as e:
        log_test("POST /api/auth/otp/send", False, f"Error: {str(e)}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"Total tests: {tests_passed + tests_failed}")
    print(f"Passed: {tests_passed}")
    print(f"Failed: {tests_failed}")
    print(f"Success rate: {(tests_passed/(tests_passed+tests_failed)*100):.1f}%")
    print("="*60)
    
    if tests_failed > 0:
        print("\nFailed tests:")
        for result in test_results:
            if not result["passed"]:
                print(f"  - {result['name']}: {result['details']}")

def main():
    """Run all tests"""
    print("="*60)
    print("EMORVIA BACKEND API TEST SUITE")
    print("Testing FCM integration and existing endpoints")
    print("="*60)
    print()
    
    # Regression tests - existing endpoints
    print("REGRESSION TESTS (Existing Endpoints)")
    print("-"*60)
    test_health()
    test_providers_list()
    test_payment_settings()
    test_vapid_key()
    test_otp_send()
    
    print()
    print("FCM INTEGRATION TESTS (New Endpoints)")
    print("-"*60)
    
    # FCM endpoint tests
    test_fcm_register_no_auth()
    test_fcm_register_no_token()
    test_fcm_register_valid()
    test_fcm_unregister()
    test_fcm_test_endpoint()
    
    # Print summary
    print_summary()
    
    # Return exit code
    return 0 if tests_failed == 0 else 1

if __name__ == "__main__":
    exit(main())
