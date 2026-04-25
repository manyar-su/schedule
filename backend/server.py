"""
InScale Digital - Booking Schedule API
FastAPI + MongoDB + JWT cookie auth
"""
from dotenv import load_dotenv
load_dotenv()

import os
import re
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date as date_type
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response, Depends, APIRouter, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient

# ---------- Constants ----------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MIN = 60 * 12  # 12 hours
REFRESH_TOKEN_DAYS = 7
SLOT_HOURS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "19:00", "20:00"]


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
    created_at: str


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

    # check slot still free
    existing = await db.bookings.find_one({
        "date": payload.date, "time": payload.time,
        "status": {"$in": ["pending", "confirmed"]}
    })
    if existing:
        raise HTTPException(status_code=409, detail="Slot ini sudah dibooking")

    booking_id = str(uuid.uuid4())
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bookings.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


# ---------- Admin ----------
@api.get("/admin/bookings", response_model=List[BookingResponse])
async def admin_list_bookings(_user: dict = Depends(require_admin)):
    cursor = db.bookings.find({}, {"_id": 0}).sort([("date", -1), ("time", -1)])
    items = await cursor.to_list(length=500)
    return items


@api.patch("/admin/bookings/{booking_id}", response_model=BookingResponse)
async def admin_update_booking(
    booking_id: str,
    payload: BookingStatusUpdate,
    _user: dict = Depends(require_admin),
):
    if payload.status not in ["pending", "confirmed", "cancelled", "completed"]:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    result = await db.bookings.find_one_and_update(
        {"id": booking_id},
        {"$set": {"status": payload.status}},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Booking tidak ditemukan")
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
    today = datetime.now(timezone.utc).date().isoformat()
    today_count = await db.bookings.count_documents({"date": today})

    # revenue (sum service prices for confirmed/completed)
    pipeline = [
        {"$match": {"status": {"$in": ["confirmed", "completed"]}}},
        {"$lookup": {
            "from": "services",
            "localField": "service_slug",
            "foreignField": "slug",
            "as": "svc",
        }},
        {"$unwind": "$svc"},
        {"$group": {"_id": None, "total": {"$sum": "$svc.price_idr"}}},
    ]
    revenue = 0
    async for doc in db.bookings.aggregate(pipeline):
        revenue = doc.get("total", 0)

    return {
        "total": total,
        "pending": pending,
        "confirmed": confirmed,
        "cancelled": cancelled,
        "today": today_count,
        "revenue_idr": revenue,
    }


app.include_router(api)
