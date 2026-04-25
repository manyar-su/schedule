"""
Backend regression tests for InScale Digital Booking API.
Tests all endpoints: health, services, availability, bookings (public),
auth (login/me/logout), and admin (bookings CRUD, stats).
"""
import os
import re
import uuid
import requests
import pytest
from datetime import datetime, timedelta, timezone

BASE_URL = "http://localhost:8001"
ADMIN_EMAIL = "admin@inscaledigital.id"
ADMIN_PASSWORD = "AdminInscale#2026"

EXPECTED_SERVICE_ORDER = [
    "install-opencart-zoom",
    "website-development",
    "mobile-app-development",
    "digital-consulting",
]


# ---------- Helpers ----------
def _next_workday(offset_days: int = 1) -> str:
    """Return a YYYY-MM-DD that's not a Sunday and is in the future."""
    d = datetime.now(timezone.utc).date() + timedelta(days=offset_days)
    while d.weekday() == 6:
        d += timedelta(days=1)
    return d.isoformat()


def _next_sunday() -> str:
    d = datetime.now(timezone.utc).date() + timedelta(days=1)
    while d.weekday() != 6:
        d += timedelta(days=1)
    return d.isoformat()


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_session():
    """A separate session that holds admin auth cookies."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    assert "access_token" in s.cookies
    assert "refresh_token" in s.cookies
    return s


@pytest.fixture(scope="session")
def created_booking_ids():
    return []


# ---------- Health ----------
class TestHealth:
    def test_root_health(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "service" in data


# ---------- Services ----------
class TestServices:
    def test_list_services_order(self, api):
        r = api.get(f"{BASE_URL}/api/services")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 4
        slugs = [s["slug"] for s in data]
        assert slugs == EXPECTED_SERVICE_ORDER
        # validate fields
        for svc in data:
            assert {"id", "slug", "name", "price_idr", "duration_minutes", "bullets"} <= svc.keys()
            assert isinstance(svc["price_idr"], int)
            assert isinstance(svc["bullets"], list)

    def test_get_service_existing(self, api):
        r = api.get(f"{BASE_URL}/api/services/install-opencart-zoom")
        assert r.status_code == 200
        data = r.json()
        assert data["slug"] == "install-opencart-zoom"
        assert data["name"] == "Install OpenCart via Zoom"

    def test_get_service_missing_returns_404(self, api):
        r = api.get(f"{BASE_URL}/api/services/openclaw-booking-hub")
        assert r.status_code == 404


# ---------- Availability ----------
class TestAvailability:
    def test_availability_workday_returns_9_slots(self, api):
        date_str = _next_workday(2)
        r = api.get(f"{BASE_URL}/api/availability", params={"date": date_str})
        assert r.status_code == 200
        data = r.json()
        assert data["date"] == date_str
        assert len(data["slots"]) == 9
        # at least some slots should be available
        assert any(s["available"] for s in data["slots"])

    def test_availability_sunday_all_unavailable(self, api):
        sunday = _next_sunday()
        r = api.get(f"{BASE_URL}/api/availability", params={"date": sunday})
        assert r.status_code == 200
        data = r.json()
        assert len(data["slots"]) == 9
        assert all(not s["available"] for s in data["slots"])

    def test_availability_past_date_all_unavailable(self, api):
        past = (datetime.now(timezone.utc).date() - timedelta(days=2)).isoformat()
        r = api.get(f"{BASE_URL}/api/availability", params={"date": past})
        assert r.status_code == 200
        data = r.json()
        assert all(not s["available"] for s in data["slots"])

    def test_availability_invalid_date_400(self, api):
        r = api.get(f"{BASE_URL}/api/availability", params={"date": "2026/01/01"})
        assert r.status_code == 400


# ---------- Bookings (public) ----------
class TestBookings:
    def test_create_booking_valid(self, api, created_booking_ids):
        date_str = _next_workday(3)
        payload = {
            "service_slug": "digital-consulting",
            "name": "TEST_User_Valid",
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "phone": "0812345678",
            "date": date_str,
            "time": "10:00",
            "notes": "TEST booking",
        }
        r = api.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert data["status"] == "pending"
        assert data["service_slug"] == "digital-consulting"
        assert data["service_name"]
        assert data["date"] == date_str
        assert data["time"] == "10:00"
        created_booking_ids.append(data["id"])

    def test_create_booking_invalid_date_format(self, api):
        payload = {
            "service_slug": "digital-consulting",
            "name": "TEST_User",
            "email": "t@example.com",
            "phone": "0812345678",
            "date": "01-01-2026",
            "time": "10:00",
        }
        r = api.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code == 400

    def test_create_booking_past_date(self, api):
        past = (datetime.now(timezone.utc).date() - timedelta(days=3)).isoformat()
        payload = {
            "service_slug": "digital-consulting",
            "name": "TEST_User",
            "email": "t@example.com",
            "phone": "0812345678",
            "date": past,
            "time": "10:00",
        }
        r = api.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code == 400

    def test_create_booking_sunday(self, api):
        payload = {
            "service_slug": "digital-consulting",
            "name": "TEST_User",
            "email": "t@example.com",
            "phone": "0812345678",
            "date": _next_sunday(),
            "time": "10:00",
        }
        r = api.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code == 400

    def test_create_booking_invalid_slot(self, api):
        payload = {
            "service_slug": "digital-consulting",
            "name": "TEST_User",
            "email": "t@example.com",
            "phone": "0812345678",
            "date": _next_workday(2),
            "time": "07:30",
        }
        r = api.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code == 400

    def test_create_booking_unknown_service(self, api):
        payload = {
            "service_slug": "no-such-service",
            "name": "TEST_User",
            "email": "t@example.com",
            "phone": "0812345678",
            "date": _next_workday(2),
            "time": "11:00",
        }
        r = api.post(f"{BASE_URL}/api/bookings", json=payload)
        assert r.status_code == 404

    def test_create_booking_conflict_409(self, api, created_booking_ids):
        date_str = _next_workday(4)
        base = {
            "service_slug": "website-development",
            "name": "TEST_User_Conflict",
            "email": f"conflict_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "0812345678",
            "date": date_str,
            "time": "14:00",
        }
        r1 = api.post(f"{BASE_URL}/api/bookings", json=base)
        assert r1.status_code == 200, r1.text
        created_booking_ids.append(r1.json()["id"])
        r2 = api.post(f"{BASE_URL}/api/bookings", json={**base, "email": "other@example.com"})
        assert r2.status_code == 409


# ---------- Auth ----------
class TestAuth:
    def test_login_success_sets_cookies(self, api):
        # use an isolated session so it doesn't pollute admin_session
        s = requests.Session()
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "id" in data
        # cookies set
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies
        # httpOnly check via raw header
        set_cookie = r.headers.get("set-cookie", "").lower()
        assert "httponly" in set_cookie

    def test_me_with_cookie(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"

    def test_me_without_cookie_401(self, api):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_login_wrong_password_401(self):
        # use unique email to avoid lockout pollution
        s = requests.Session()
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent_xyz@example.com", "password": "wrong"},
        )
        assert r.status_code == 401

    def test_brute_force_lockout_429(self):
        """5 failed attempts on a unique fake email should trigger 429."""
        s = requests.Session()
        unique = f"brute_{uuid.uuid4().hex[:8]}@example.com"
        statuses = []
        for _ in range(6):
            r = s.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": unique, "password": "wrong"},
            )
            statuses.append(r.status_code)
        # last one should be 429
        assert 429 in statuses, f"Expected 429 within attempts, got {statuses}"

    def test_logout_clears_cookies(self):
        s = requests.Session()
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200
        r2 = s.post(f"{BASE_URL}/api/auth/logout")
        assert r2.status_code == 200
        # after logout, /me should fail
        r3 = s.get(f"{BASE_URL}/api/auth/me")
        assert r3.status_code == 401


# ---------- Admin ----------
class TestAdmin:
    def test_admin_bookings_unauth_401(self, api):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/admin/bookings")
        assert r.status_code == 401

    def test_admin_bookings_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/bookings")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # there should be at least one booking from earlier tests
        assert len(data) >= 1
        # ensure no _id leaks
        for b in data:
            assert "_id" not in b
            assert "id" in b

    def test_admin_update_booking_confirm(self, admin_session, created_booking_ids):
        if not created_booking_ids:
            pytest.skip("no booking created")
        bid = created_booking_ids[0]
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/bookings/{bid}",
            json={"status": "confirmed"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "confirmed"

    def test_admin_update_booking_invalid_status(self, admin_session, created_booking_ids):
        if not created_booking_ids:
            pytest.skip("no booking created")
        bid = created_booking_ids[0]
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/bookings/{bid}",
            json={"status": "weird-status"},
        )
        assert r.status_code == 400

    def test_admin_update_booking_missing_404(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/admin/bookings/{uuid.uuid4()}",
            json={"status": "confirmed"},
        )
        assert r.status_code == 404

    def test_admin_stats(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 200
        data = r.json()
        for k in ["total", "pending", "confirmed", "cancelled", "today", "revenue_idr"]:
            assert k in data
            assert isinstance(data[k], int)

    def test_admin_delete_booking(self, admin_session, created_booking_ids):
        # delete every TEST booking we created
        for bid in created_booking_ids[:]:
            r = admin_session.delete(f"{BASE_URL}/api/admin/bookings/{bid}")
            assert r.status_code == 200
            created_booking_ids.remove(bid)

    def test_admin_delete_booking_missing_404(self, admin_session):
        r = admin_session.delete(f"{BASE_URL}/api/admin/bookings/{uuid.uuid4()}")
        assert r.status_code == 404


# ---------- Cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def _cleanup_login_attempts():
    """After all tests, clear login_attempts for the real admin to avoid lockout."""
    yield
    try:
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "booking_schedule")
        client = MongoClient(mongo_url)
        client[db_name].login_attempts.delete_many({})
        client.close()
    except Exception as e:
        print(f"cleanup failed: {e}")
