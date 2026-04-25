"""
Backend tests for the Midtrans + mock-email integration added on top of the
InScale Digital booking app. Covers:
  - POST /api/bookings now returns snap_token, midtrans_client_key,
    midtrans_is_production, expires_at, payment_status, amount_idr.
  - GET /api/bookings/{id} (public) — no Midtrans secret leak.
  - POST /api/payment/notification — signature validation, state transitions
    (settlement / cancel / expire), idempotency, email_logs persistence.
  - Admin /api/admin/stats includes 'paid' + revenue_idr aggregation.
  - Admin /api/admin/bookings projection excludes Midtrans secrets.
  - PATCH /api/admin/bookings/{id} with confirmed/completed unsets expires_at.
  - TTL index on bookings.expires_at exists.
"""
import os
import sys
import uuid
import hashlib
import requests
import pytest
from datetime import datetime, timedelta, timezone

# Reuse helpers + fixtures from the iteration-1 regression file.
sys.path.insert(0, os.path.dirname(__file__))
from test_inscale_api import (  # noqa: E402
    BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD,
    _next_workday, admin_session, api,  # fixtures
)

# Read server key directly from .env to forge valid webhook signatures.
from dotenv import dotenv_values  # noqa: E402

_ENV = dotenv_values("/app/backend/.env")
SERVER_KEY = _ENV.get("MIDTRANS_SERVER_KEY") or os.environ.get("MIDTRANS_SERVER_KEY", "")
CLIENT_KEY = _ENV.get("MIDTRANS_CLIENT_KEY") or os.environ.get("MIDTRANS_CLIENT_KEY", "")
DB_NAME = _ENV.get("DB_NAME") or os.environ.get("DB_NAME", "booking_schedule")
MONGO_URL = _ENV.get("MONGO_URL") or os.environ.get("MONGO_URL", "mongodb://localhost:27017")


def _sig(order_id: str, status_code: str, gross_amount: str) -> str:
    raw = f"{order_id}{status_code}{gross_amount}{SERVER_KEY}"
    return hashlib.sha512(raw.encode("utf-8")).hexdigest()


def _unique_email() -> str:
    return f"TEST_mt_{uuid.uuid4().hex[:8]}@example.com"


def _create_booking(slot_time: str = "11:00", offset: int = 5) -> dict:
    """Helper to create a booking via the public endpoint and return JSON."""
    payload = {
        "service_slug": "digital-consulting",
        "name": "TEST_Midtrans",
        "email": _unique_email(),
        "phone": "0812345678",
        "date": _next_workday(offset),
        "time": slot_time,
        "notes": "TEST mt",
    }
    r = requests.post(f"{BASE_URL}/api/bookings", json=payload, timeout=30)
    return r


# ---------- Booking creation now hooks Midtrans ----------
class TestBookingCreateMidtrans:
    def test_booking_returns_snap_token_and_midtrans_metadata(self):
        # offset=5 to avoid colliding with iteration_1 leftover bookings
        r = _create_booking(slot_time="11:00", offset=5)
        assert r.status_code == 200, r.text
        data = r.json()
        # New fields
        assert data.get("payment_status") == "pending"
        assert data.get("status") == "pending"
        assert isinstance(data.get("snap_token"), str) and len(data["snap_token"]) > 10
        assert data.get("midtrans_client_key") == CLIENT_KEY
        assert data.get("midtrans_is_production") is True
        assert isinstance(data.get("expires_at"), str)
        # Roughly +30 min from now
        exp = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        delta_min = (exp - datetime.now(timezone.utc)).total_seconds() / 60
        assert 25 <= delta_min <= 35, f"expires_at not in TTL window: {delta_min}"
        # Cleanup after class
        TestBookingCreateMidtrans._created_id = data["id"]

    def test_invalid_service_404_no_midtrans_call(self):
        payload = {
            "service_slug": "no-such-service",
            "name": "TEST_X", "email": _unique_email(),
            "phone": "0812345678", "date": _next_workday(6), "time": "13:00",
        }
        r = requests.post(f"{BASE_URL}/api/bookings", json=payload, timeout=10)
        assert r.status_code == 404

    def test_past_date_400_no_midtrans_call(self):
        past = (datetime.now(timezone.utc).date() - timedelta(days=2)).isoformat()
        payload = {
            "service_slug": "digital-consulting",
            "name": "TEST_X", "email": _unique_email(),
            "phone": "0812345678", "date": past, "time": "10:00",
        }
        r = requests.post(f"{BASE_URL}/api/bookings", json=payload, timeout=10)
        assert r.status_code == 400


# ---------- GET /api/bookings/{id} (public) ----------
class TestPublicBookingGet:
    def test_public_get_returns_payment_status_and_no_secrets(self):
        r = _create_booking(slot_time="14:00", offset=7)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        g = requests.get(f"{BASE_URL}/api/bookings/{bid}", timeout=10)
        assert g.status_code == 200
        b = g.json()
        assert b["id"] == bid
        assert b["payment_status"] == "pending"
        assert b["amount_idr"] == 500000  # digital-consulting price
        assert "snap_token" not in b
        assert "midtrans_transaction_id" not in b
        # expires_at is ISO string
        assert isinstance(b.get("expires_at"), str)

    def test_public_get_unknown_404(self):
        r = requests.get(f"{BASE_URL}/api/bookings/{uuid.uuid4()}", timeout=10)
        assert r.status_code == 404


# ---------- /api/payment/notification webhook ----------
class TestMidtransWebhook:
    def test_webhook_invalid_signature_403(self):
        # Need a real booking so we don't mask the signature check with 'not found'
        r = _create_booking(slot_time="15:00", offset=8)
        assert r.status_code == 200
        bid = r.json()["id"]
        body = {
            "order_id": bid, "status_code": "200", "gross_amount": "500000.00",
            "signature_key": "deadbeef" * 16, "transaction_status": "settlement",
            "transaction_id": str(uuid.uuid4()), "payment_type": "qris",
        }
        n = requests.post(f"{BASE_URL}/api/payment/notification", json=body, timeout=10)
        assert n.status_code == 403

    def test_webhook_settlement_marks_paid_and_confirmed(self):
        r = _create_booking(slot_time="16:00", offset=9)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        gross = "500000.00"
        body = {
            "order_id": bid, "status_code": "200", "gross_amount": gross,
            "signature_key": _sig(bid, "200", gross),
            "transaction_status": "settlement",
            "transaction_id": str(uuid.uuid4()), "payment_type": "qris",
        }
        n = requests.post(f"{BASE_URL}/api/payment/notification", json=body, timeout=15)
        assert n.status_code == 200, n.text
        # GET public — should now be paid+confirmed, expires_at unset
        g = requests.get(f"{BASE_URL}/api/bookings/{bid}", timeout=10).json()
        assert g["payment_status"] == "paid"
        assert g["status"] == "confirmed"
        assert "paid_at" in g
        assert g.get("expires_at") in (None, "")  # unset
        # email_logs should have 'created' + 'confirmation' for this booking
        from pymongo import MongoClient
        client = MongoClient(MONGO_URL)
        kinds = {d["kind"] for d in client[DB_NAME].email_logs.find({"booking_id": bid})}
        client.close()
        assert {"created", "confirmation"} <= kinds

        # Idempotency: send same settlement again -> ok already-paid
        n2 = requests.post(f"{BASE_URL}/api/payment/notification", json=body, timeout=10)
        assert n2.status_code == 200
        body_json = n2.json()
        assert body_json.get("ok") is True
        assert body_json.get("note") == "already-paid"

    @pytest.mark.parametrize("ts,exp_pay,exp_status", [
        ("cancel", "failed", "cancelled"),
        ("expire", "failed", "cancelled"),
    ])
    def test_webhook_cancel_or_expire_marks_failed(self, ts, exp_pay, exp_status):
        # different slots so we don't collide
        slot_map = {"cancel": "19:00", "expire": "20:00"}
        r = _create_booking(slot_time=slot_map[ts], offset=10)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        gross = "500000.00"
        body = {
            "order_id": bid, "status_code": "202", "gross_amount": gross,
            "signature_key": _sig(bid, "202", gross),
            "transaction_status": ts,
            "transaction_id": str(uuid.uuid4()), "payment_type": "qris",
        }
        n = requests.post(f"{BASE_URL}/api/payment/notification", json=body, timeout=10)
        assert n.status_code == 200, n.text
        g = requests.get(f"{BASE_URL}/api/bookings/{bid}", timeout=10).json()
        assert g["payment_status"] == exp_pay
        assert g["status"] == exp_status
        # email_logs should contain 'cancelled' for failed terminal state
        from pymongo import MongoClient
        client = MongoClient(MONGO_URL)
        kinds = {d["kind"] for d in client[DB_NAME].email_logs.find({"booking_id": bid})}
        client.close()
        assert "cancelled" in kinds


# ---------- Admin endpoints ----------
class TestAdminWithMidtrans:
    def test_admin_stats_includes_paid_and_revenue(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 200
        data = r.json()
        for k in ["total", "pending", "confirmed", "cancelled", "paid", "today", "revenue_idr"]:
            assert k in data and isinstance(data[k], int), f"missing/typed key: {k}"
        # We just paid one digital-consulting (500_000) — revenue >= 500_000.
        assert data["paid"] >= 1
        assert data["revenue_idr"] >= 500000

    def test_admin_bookings_excludes_midtrans_secrets_and_serializes_expires_at(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/bookings")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        for b in items:
            assert "_id" not in b
            assert "snap_token" not in b
            assert "midtrans_transaction_id" not in b
            assert "midtrans_redirect_url" not in b
            if "expires_at" in b and b["expires_at"] is not None:
                # must be ISO string, not raw datetime
                assert isinstance(b["expires_at"], str)
                # parseable
                datetime.fromisoformat(b["expires_at"].replace("Z", "+00:00"))

    def test_admin_patch_confirmed_unsets_expires_at(self, admin_session):
        # create a fresh pending booking
        r = _create_booking(slot_time="09:00", offset=11)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        # before: expires_at is set
        before = requests.get(f"{BASE_URL}/api/bookings/{bid}", timeout=10).json()
        assert before.get("expires_at")

        p = admin_session.patch(
            f"{BASE_URL}/api/admin/bookings/{bid}",
            json={"status": "confirmed"},
        )
        assert p.status_code == 200
        body = p.json()
        assert body["status"] == "confirmed"
        assert body.get("expires_at") in (None, "")

        # confirmed via admin (no Midtrans payment), so payment_status remains 'pending'
        after = requests.get(f"{BASE_URL}/api/bookings/{bid}", timeout=10).json()
        assert "expires_at" not in after or after.get("expires_at") in (None, "")


# ---------- Indexes ----------
class TestMongoIndexes:
    def test_bookings_has_ttl_index_on_expires_at(self):
        from pymongo import MongoClient
        client = MongoClient(MONGO_URL)
        idx = client[DB_NAME].bookings.index_information()
        client.close()
        # Find any index on expires_at with expireAfterSeconds
        ttl_indexes = [
            (name, info) for name, info in idx.items()
            if any(k == "expires_at" for k, _ in info.get("key", []))
        ]
        assert ttl_indexes, f"No index on expires_at found. Got: {list(idx.keys())}"
        assert any(
            "expireAfterSeconds" in info for _, info in ttl_indexes
        ), f"expires_at index has no TTL: {ttl_indexes}"


# ---------- Cleanup (TEST_ data) ----------
@pytest.fixture(scope="module", autouse=True)
def _cleanup_test_bookings():
    yield
    try:
        from pymongo import MongoClient
        client = MongoClient(MONGO_URL)
        # Remove TEST_ bookings + their email logs to keep DB tidy
        bookings = client[DB_NAME].bookings
        ids = [b["id"] for b in bookings.find({"name": {"$regex": "^TEST_"}}, {"id": 1})]
        if ids:
            bookings.delete_many({"id": {"$in": ids}})
            client[DB_NAME].email_logs.delete_many({"booking_id": {"$in": ids}})
        client[DB_NAME].login_attempts.delete_many({})
        client.close()
    except Exception as e:
        print(f"cleanup failed: {e}")
