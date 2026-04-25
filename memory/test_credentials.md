# Test Credentials — InScale Digital Booking

## Admin (single account, seeded on startup)
- **Email**: `admin@inscaledigital.id`
- **Password**: `AdminInscale#2026`
- **Role**: `admin`
- **Login URL (frontend)**: `/admin/login`
- **Dashboard URL (frontend, protected)**: `/admin`

## Auth endpoints (cookie-based JWT)
- POST `/api/auth/login`  body: `{ "email", "password" }`
- POST `/api/auth/logout` (auth required)
- GET  `/api/auth/me`     (auth required)
- POST `/api/auth/refresh`

## Public endpoints
- GET  `/api/services`
- GET  `/api/services/{slug}`
- GET  `/api/availability?date=YYYY-MM-DD`
- POST `/api/bookings`

## Admin-only endpoints
- GET    `/api/admin/bookings`
- PATCH  `/api/admin/bookings/{id}` body: `{ "status": "pending|confirmed|cancelled|completed" }`
- DELETE `/api/admin/bookings/{id}`
- GET    `/api/admin/stats`

## Test scenarios
- Public booking flow: pick service → date → time → fill form → submit → success card
- Admin login → see seeded bookings → confirm/cancel/delete → stats update
- Slot collision: trying to book the same date+time twice should return 409
- Sundays disabled in calendar; past dates disabled
