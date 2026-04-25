"""
InScale Digital - Booking Schedule API
FastAPI + MongoDB + JWT cookie auth + Midtrans Snap + Mock email
"""
from dotenv import load_dotenv
load_dotenv()

import os
import re
import uuid
import bcrypt
import jwt
import hashlib
import logging
import midtransclient
from datetime import datetime, timezone, timedelta, date as date_type
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response, Depends, APIRouter, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("inscale")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# ---------- Constants ----------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MIN = 60 * 12  # 12 hours
REFRESH_TOKEN_DAYS = 7
SLOT_HOURS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "19:00", "20:00"]
PENDING_PAYMENT_TTL_MIN = 30  # unpaid bookings auto-expire after 30 min


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


# ---------- Password Helpers ----------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------- JWT Helpers ----------
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MIN),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token", value=access_token, httponly=True, secure=False,
        samesite="lax", max_age=ACCESS_TOKEN_MIN * 60, path="/"
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True, secure=False,
        samesite="lax", max_age=REFRESH_TOKEN_DAYS * 86400, path="/"
    )


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


# ---------- DB ----------
mongo_client: Optional[AsyncIOMotorClient] = None
db = None

# ---------- Midtrans Snap client ----------
def _get_midtrans_snap():
    is_production = os.environ.get("MIDTRANS_PRODUCTION", "false").lower() == "true"
    return midtransclient.Snap(
        is_production=is_production,
        server_key=os.environ["MIDTRANS_SERVER_KEY"],
        client_key=os.environ["MIDTRANS_CLIENT_KEY"],
    )


def _midtrans_verify_signature(order_id: str, status_code: str, gross_amount: str, signature_key: str) -> bool:
    payload = f"{order_id}{status_code}{gross_amount}{os.environ['MIDTRANS_SERVER_KEY']}"
    digest = hashlib.sha512(payload.encode("utf-8")).hexdigest()
    return digest == (signature_key or "")


# ---------- Mock Email Service ----------
async def send_booking_email(booking: dict, kind: str = "confirmation"):
    """
    MOCKED email — logs to console + persists to db.email_logs.
    Swap this with Resend SDK once user provides API key.
    """
    subject_map = {
        "created": "Booking Anda diterima — menunggu pembayaran",
        "confirmation": "Pembayaran terkonfirmasi — sampai jumpa di sesi Anda",
        "cancelled": "Booking Anda dibatalkan",
    }
    subject = subject_map.get(kind, "Update booking")

    log_doc = {
        "id": str(uuid.uuid4()),
        "to": booking.get("email"),
        "kind": kind,
        "subject": subject,
        "booking_id": booking.get("id"),
        "service_name": booking.get("service_name"),
        "date": booking.get("date"),
        "time": booking.get("time"),
        "provider": "MOCK",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.email_logs.insert_one({**log_doc})
    except Exception as e:
        logger.warning("email_logs insert failed: %s", e)
    logger.info(
        "[MOCK EMAIL] -> to=%s kind=%s subject='%s' booking=%s",
        booking.get("email"), kind, subject, booking.get("id"),
    )


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------- Pydantic Models ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str


class Service(BaseModel):
    id: str
    slug: str
    name: str
    short_desc: str
    description: str
    price_idr: int
    duration_minutes: int
    icon: str
    color: str
    bullets: List[str] = []


class BookingCreate(BaseModel):
    service_slug: str
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=30)
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    notes: Optional[str] = ""


class BookingResponse(BaseModel):
    id: str
    service_slug: str
    service_name: str
    name: str
    email: str
    phone: str
    date: str
    time: str
    notes: str
    status: str
    payment_status: str = "pending"
    created_at: str
    snap_token: Optional[str] = None
    midtrans_client_key: Optional[str] = None
    midtrans_is_production: Optional[bool] = None
    expires_at: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: str  # confirmed | cancelled | pending | completed


class AvailabilityResponse(BaseModel):
    date: str
    slots: List[dict]  # {time, available}


# ---------- Services Catalog ----------
SERVICES_SEED = [
    {
        "id": str(uuid.uuid4()),
        "slug": "install-opencart-zoom",
        "name": "Install OpenCart via Zoom",
        "short_desc": "Setup toko online OpenCart end-to-end via sesi Zoom 1:1",
        "description": "Sesi pendampingan instalasi OpenCart pada hosting Anda — termasuk konfigurasi domain, SSL, theme, payment gateway, dan onboarding admin panel. Cocok untuk UMKM dan pemilik toko online.",
        "price_idr": 750000,
        "duration_minutes": 90,
        "icon": "ShoppingCart",
        "color": "#D1FF4D",
        "bullets": [
            "Sesi privat 1-on-1 via Zoom",
            "Instalasi & konfigurasi OpenCart terbaru",
            "Setup payment gateway (Midtrans/Xendit)",
            "Garansi 7 hari support follow-up",
        ],
    },
    {
        "id": str(uuid.uuid4()),
        "slug": "website-development",
        "name": "Pembuatan Website",
        "short_desc": "Website modern, cepat, SEO-ready untuk bisnis Anda",
        "description": "Pembuatan website company profile, landing page, atau marketplace dengan stack modern (React/Next.js + Node/Python). Termasuk hosting setup, SEO dasar, dan integrasi analytics.",
        "price_idr": 4500000,
        "duration_minutes": 60,
        "icon": "Globe",
        "color": "#00E5FF",
        "bullets": [
            "Desain custom responsive",
            "SEO friendly + Core Web Vitals optimized",
            "Hosting & domain setup",
            "1 bulan support gratis",
        ],
    },
    {
        "id": str(uuid.uuid4()),
        "slug": "mobile-app-development",
        "name": "Pembuatan Aplikasi Mobile",
        "short_desc": "Aplikasi Android & iOS cross-platform menggunakan React Native",
        "description": "Aplikasi mobile cross-platform (Android + iOS) dengan React Native / Flutter. Termasuk integrasi backend, push notification, dan deployment ke Play Store / App Store.",
        "price_idr": 12000000,
        "duration_minutes": 60,
        "icon": "Smartphone",
        "color": "#FFB800",
        "bullets": [
            "iOS + Android dari satu codebase",
            "Push notification & deep linking",
            "Backend API + database",
            "Bantuan publish ke store",
        ],
    },
    {
        "id": str(uuid.uuid4()),
        "slug": "digital-consulting",
        "name": "Konsultasi Digital",
        "short_desc": "Sesi strategi digital 60 menit untuk roadmap produk Anda",
        "description": "Sesi konsultasi 1:1 untuk membahas strategi digital, arsitektur produk, pemilihan tech stack, atau roadmap MVP. Cocok untuk founder, product manager, dan tim teknis.",
        "price_idr": 500000,
        "duration_minutes": 60,
        "icon": "Lightbulb",
        "color": "#FF3366",
        "bullets": [
            "Sesi privat 60 menit via Zoom",
            "Review arsitektur / tech stack",
            "Roadmap MVP + estimasi biaya",
            "Notulensi & action items dikirim",
        ],
    },
]


# ---------- Lifespan ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, db
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    mongo_client = AsyncIOMotorClient(mongo_url)
    db = mongo_client[db_name]

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.bookings.create_index("id", unique=True)
    await db.bookings.create_index([("date", 1), ("time", 1)])
    # TTL index on expires_at — Mongo deletes pending unpaid bookings after expiry
    await db.bookings.create_index("expires_at", expireAfterSeconds=0)
    await db.services.create_index("slug", unique=True)
    await db.login_attempts.create_index("identifier")

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@inscaledigital.id")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin InScale",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )

    # Seed services
    for svc in SERVICES_SEED:
        await db.services.update_one(
            {"slug": svc["slug"]},
            {"$setOnInsert": svc},
            upsert=True,
        )

    yield
    mongo_client.close()


app = FastAPI(title="InScale Digital Booking API", lifespan=lifespan)

# ---------- CORS ----------
import re as _re

_FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
_ALLOW_ORIGINS = [_FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOW_ORIGINS,
    allow_origin_regex=r"^https://.*\.(preview\.emergentagent\.com|emergent\.host|emergentagent\.com)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ---------- Health ----------
@api.get("/")
async def root():
    return {"status": "ok", "service": "InScale Digital Booking API"}


# ---------- Auth ----------
@api.post("/auth/login")
async def auth_login(payload: LoginRequest, request: Request, response: Response):
    email = payload.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi nanti.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        # increment attempts
        new_count = (attempt.get("count", 0) if attempt else 0) + 1
        update = {"count": new_count, "last_attempt": datetime.now(timezone.utc).isoformat()}
        if new_count >= 5:
            update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": {"identifier": identifier, **update}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email atau password salah")

    # success — clear attempts
    await db.login_attempts.delete_one({"identifier": identifier})

    access = create_access_token(user["id"], user["email"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)

    return {
        "id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"],
        "access_token": access,
    }


@api.post("/auth/logout")
async def auth_logout(response: Response, _user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}


@api.post("/auth/refresh")
async def auth_refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(user["id"], user["email"])
        response.set_cookie(
            key="access_token", value=access, httponly=True, secure=False,
            samesite="lax", max_age=ACCESS_TOKEN_MIN * 60, path="/",
        )
        return {"ok": True}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Services ----------
@api.get("/services", response_model=List[Service])
async def get_services():
    cursor = db.services.find({}, {"_id": 0})
    items = await cursor.to_list(length=100)
    # ensure order matches seed
    order = {s["slug"]: i for i, s in enumerate(SERVICES_SEED)}
    items.sort(key=lambda x: order.get(x["slug"], 99))
    return items


@api.get("/services/{slug}", response_model=Service)
async def get_service(slug: str):
    svc = await db.services.find_one({"slug": slug}, {"_id": 0})
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc


# ---------- Availability ----------
def _validate_date(date_str: str) -> date_type:
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format tanggal harus YYYY-MM-DD")
    return d


@api.get("/availability", response_model=AvailabilityResponse)
async def get_availability(date: str):
    d = _validate_date(date)
    today = datetime.now(timezone.utc).date()
    if d < today:
        return {"date": date, "slots": [{"time": t, "available": False} for t in SLOT_HOURS]}

    booked = await db.bookings.find(
        {"date": date, "status": {"$in": ["pending", "confirmed"]}},
        {"_id": 0, "time": 1}
    ).to_list(length=100)
    booked_set = {b["time"] for b in booked}

    # Sundays unavailable
    is_sunday = d.weekday() == 6

    slots = []
    for t in SLOT_HOURS:
        available = (not is_sunday) and (t not in booked_set)
        slots.append({"time": t, "available": available})
    return {"date": date, "slots": slots}


# ---------- Bookings ----------
@api.post("/bookings", response_model=BookingResponse)
async def create_booking(payload: BookingCreate):
    # validate date/time
    d = _validate_date(payload.date)
    if d < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Tanggal sudah lewat")
    if not re.match(r"^\d{2}:\d{2}$", payload.time) or payload.time not in SLOT_HOURS:
        raise HTTPException(status_code=400, detail="Slot waktu tidak valid")
    if d.weekday() == 6:
        raise HTTPException(status_code=400, detail="Hari Minggu tidak tersedia")

    # validate service
    svc = await db.services.find_one({"slug": payload.service_slug}, {"_id": 0})
    if not svc:
        raise HTTPException(status_code=404, detail="Layanan tidak ditemukan")

    # check slot still free (any active pending/confirmed counts)
    existing = await db.bookings.find_one({
        "date": payload.date, "time": payload.time,
        "status": {"$in": ["pending", "confirmed"]}
    })
    if existing:
        raise HTTPException(status_code=409, detail="Slot ini sudah dibooking")

    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=PENDING_PAYMENT_TTL_MIN)

    doc = {
        "id": booking_id,
        "service_slug": payload.service_slug,
        "service_name": svc["name"],
        "name": payload.name.strip(),
        "email": payload.email.lower().strip(),
        "phone": payload.phone.strip(),
        "date": payload.date,
        "time": payload.time,
        "notes": (payload.notes or "").strip(),
        "status": "pending",
        "payment_status": "pending",
        "amount_idr": int(svc["price_idr"]),
        "created_at": now.isoformat(),
        "expires_at": expires_at,  # MongoDB TTL — auto-delete unpaid bookings
        "snap_token": None,
        "midtrans_transaction_id": None,
    }
    await db.bookings.insert_one(doc)

    # Create Midtrans Snap transaction
    snap_token = None
    midtrans_error = None
    try:
        snap = _get_midtrans_snap()
        tx_payload = {
            "transaction_details": {"order_id": booking_id, "gross_amount": int(svc["price_idr"])},
            "customer_details": {
                "first_name": payload.name.strip(),
                "email": payload.email.lower().strip(),
                "phone": payload.phone.strip(),
            },
            "item_details": [{
                "id": svc["slug"],
                "price": int(svc["price_idr"]),
                "quantity": 1,
                "name": svc["name"][:50],
            }],
            "enabled_payments": [
                "qris", "gopay", "shopeepay", "bca_va", "bni_va", "bri_va",
                "permata_va", "other_va", "credit_card", "indomaret", "alfamart",
            ],
            "expiry": {"unit": "minutes", "duration": PENDING_PAYMENT_TTL_MIN},
        }
        result = snap.create_transaction(tx_payload)
        snap_token = result.get("token")
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {"snap_token": snap_token, "midtrans_redirect_url": result.get("redirect_url")}},
        )
    except Exception as e:
        midtrans_error = str(e)
        logger.error("Midtrans create_transaction failed for %s: %s", booking_id, e)
        # Cleanup the held slot — the user won't be able to pay
        await db.bookings.delete_one({"id": booking_id})
        raise HTTPException(status_code=502, detail=f"Gagal terhubung ke Midtrans: {midtrans_error}")

    # MOCK email: booking received (awaiting payment)
    await send_booking_email(doc, kind="created")

    is_production = os.environ.get("MIDTRANS_PRODUCTION", "false").lower() == "true"

    return {
        "id": booking_id,
        "service_slug": doc["service_slug"],
        "service_name": doc["service_name"],
        "name": doc["name"],
        "email": doc["email"],
        "phone": doc["phone"],
        "date": doc["date"],
        "time": doc["time"],
        "notes": doc["notes"],
        "status": doc["status"],
        "payment_status": doc["payment_status"],
        "created_at": doc["created_at"],
        "snap_token": snap_token,
        "midtrans_client_key": os.environ["MIDTRANS_CLIENT_KEY"],
        "midtrans_is_production": is_production,
        "expires_at": expires_at.isoformat(),
    }


@api.get("/bookings/{booking_id}")
async def get_booking_public(booking_id: str):
    """Public endpoint to poll booking status after Midtrans payment."""
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0, "midtrans_transaction_id": 0, "snap_token": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    # serialize datetime
    if isinstance(b.get("expires_at"), datetime):
        b["expires_at"] = b["expires_at"].isoformat()
    return b


# ---------- Midtrans Webhook ----------
class MidtransNotification(BaseModel):
    order_id: str
    status_code: str
    gross_amount: str
    signature_key: str
    transaction_status: str
    transaction_id: Optional[str] = None
    fraud_status: Optional[str] = None
    payment_type: Optional[str] = None


@api.post("/payment/notification")
async def midtrans_notification(request: Request):
    body = await request.json()
    order_id = body.get("order_id", "")
    status_code = body.get("status_code", "")
    gross_amount = body.get("gross_amount", "")
    signature_key = body.get("signature_key", "")
    transaction_status = body.get("transaction_status", "")
    fraud_status = body.get("fraud_status", "")
    transaction_id = body.get("transaction_id")
    payment_type = body.get("payment_type")

    logger.info("[Midtrans webhook] order=%s status=%s tx=%s pay=%s", order_id, transaction_status, transaction_id, payment_type)

    if not _midtrans_verify_signature(order_id, status_code, gross_amount, signature_key):
        logger.warning("[Midtrans webhook] BAD signature for order=%s", order_id)
        raise HTTPException(status_code=403, detail="Invalid signature")

    booking = await db.bookings.find_one({"id": order_id})
    if not booking:
        logger.warning("[Midtrans webhook] booking not found: %s", order_id)
        return {"ok": True}

    # Idempotent: if already paid, ignore
    if booking.get("payment_status") == "paid" and transaction_status in ("settlement", "capture"):
        return {"ok": True, "note": "already-paid"}

    # Map Midtrans status -> our payment_status / status
    update = {
        "midtrans_transaction_id": transaction_id,
        "midtrans_payment_type": payment_type,
        "midtrans_last_status": transaction_status,
    }
    new_status = booking.get("status")
    new_payment_status = booking.get("payment_status")

    if transaction_status in ("settlement",) or (transaction_status == "capture" and (fraud_status in ("accept", None))):
        new_payment_status = "paid"
        new_status = "confirmed"
        update["paid_at"] = datetime.now(timezone.utc).isoformat()
        # Unset TTL so this slot is no longer auto-expired
        await db.bookings.update_one({"id": order_id}, {"$unset": {"expires_at": ""}})
    elif transaction_status == "pending":
        new_payment_status = "pending"
    elif transaction_status in ("deny", "cancel", "expire", "failure"):
        new_payment_status = "failed"
        new_status = "cancelled"

    update["status"] = new_status
    update["payment_status"] = new_payment_status
    await db.bookings.update_one({"id": order_id}, {"$set": update})

    # Trigger MOCK email on terminal states
    fresh = await db.bookings.find_one({"id": order_id}, {"_id": 0})
    if new_payment_status == "paid":
        await send_booking_email(fresh, kind="confirmation")
    elif new_payment_status == "failed":
        await send_booking_email(fresh, kind="cancelled")

    return {"ok": True}


# ---------- Admin ----------
@api.get("/admin/bookings")
async def admin_list_bookings(_user: dict = Depends(require_admin)):
    cursor = db.bookings.find(
        {},
        {"_id": 0, "snap_token": 0, "midtrans_transaction_id": 0, "midtrans_redirect_url": 0}
    ).sort([("date", -1), ("time", -1)])
    items = await cursor.to_list(length=500)
    for it in items:
        if isinstance(it.get("expires_at"), datetime):
            it["expires_at"] = it["expires_at"].isoformat()
    return items


@api.patch("/admin/bookings/{booking_id}")
async def admin_update_booking(
    booking_id: str,
    payload: BookingStatusUpdate,
    _user: dict = Depends(require_admin),
):
    if payload.status not in ["pending", "confirmed", "cancelled", "completed"]:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    update = {"status": payload.status}
    # On confirm/complete via admin: unset TTL (don't auto-expire), and clear payment "pending"
    unset = {}
    if payload.status in ("confirmed", "completed"):
        unset["expires_at"] = ""
    result = await db.bookings.find_one_and_update(
        {"id": booking_id},
        {"$set": update, **({"$unset": unset} if unset else {})},
        return_document=True,
        projection={"_id": 0, "snap_token": 0, "midtrans_transaction_id": 0, "midtrans_redirect_url": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    if isinstance(result.get("expires_at"), datetime):
        result["expires_at"] = result["expires_at"].isoformat()
    return result


@api.delete("/admin/bookings/{booking_id}")
async def admin_delete_booking(booking_id: str, _user: dict = Depends(require_admin)):
    res = await db.bookings.delete_one({"id": booking_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(_user: dict = Depends(require_admin)):
    total = await db.bookings.count_documents({})
    pending = await db.bookings.count_documents({"status": "pending"})
    confirmed = await db.bookings.count_documents({"status": "confirmed"})
    cancelled = await db.bookings.count_documents({"status": "cancelled"})
    paid = await db.bookings.count_documents({"payment_status": "paid"})
    today = datetime.now(timezone.utc).date().isoformat()
    today_count = await db.bookings.count_documents({"date": today})

    # revenue = sum of amount_idr for paid bookings (fallback to service join for legacy)
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_idr"}}},
    ]
    revenue = 0
    async for doc in db.bookings.aggregate(pipeline):
        revenue = doc.get("total", 0) or 0

    return {
        "total": total,
        "pending": pending,
        "confirmed": confirmed,
        "cancelled": cancelled,
        "paid": paid,
        "today": today_count,
        "revenue_idr": revenue,
    }


app.include_router(api)
