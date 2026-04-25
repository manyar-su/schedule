# InScale Digital — Booking Schedule App

## Original Problem Statement
> buatkan web landing page untuk membuat schedule jasa digital dengan berbagai menu seperti jasa install openclaw via zoom atau jasa pembuatan website atau aplikasi dengan menampilkan schedule kalender available dengan ui ux 3d dan animasi realtime dan multi fllatform

## Tech & Architecture
- **Backend**: FastAPI + Motor (MongoDB), JWT cookie auth, bcrypt, Pydantic
- **Frontend**: React 18 + React Router 7, Three.js / @react-three/fiber + drei, framer-motion, Tailwind CSS, lucide-react
- **DB Collections**: `users`, `bookings`, `services`, `login_attempts`
- **Theme**: Swiss high-contrast dark — Obsidian #0A0A0A + Electric Lime #D1FF4D + Cyan #00E5FF, fonts Clash Display + Satoshi + JetBrains Mono.

## User Personas
1. **Calon klien (publik)** — UMKM/founder Indonesia mencari jasa digital, ingin booking sesi cepat tanpa drama.
2. **Admin InScale** — internal team, melihat & mengelola seluruh booking masuk.

## Core Requirements (static)
- Landing page Bahasa Indonesia, dark mode, animasi 3D realtime
- 4 layanan: Install OpenCart via Zoom, Pembuatan Website, Pembuatan Aplikasi Mobile, Konsultasi Digital
- Kalender realtime menampilkan slot tersedia
- Form booking (nama, email, WA, layanan, tanggal, jam, catatan)
- Admin login + dashboard untuk lihat/ubah/hapus booking
- Multi-platform (responsive desktop / tablet / mobile)

## What's Implemented (Apr 25, 2026)
- ✅ Landing page lengkap: Hero 3D (Three.js torusKnot, icosahedron, edge-cube), client marquee, bento service cards (3D tilt hover), schedule showcase mock, 4-step "Cara Kerja", testimonials, FAQ, final CTA, footer
- ✅ Booking flow: 4 service tiles → realtime calendar (Sundays/past disabled) → time slot chips (9 slots/hari) → form validation → POST `/api/bookings` → success card
- ✅ Admin auth: cookie-based JWT, bcrypt password, brute-force lockout (5 attempts → 15 min)
- ✅ Admin dashboard: stats (total/today/pending/confirmed/revenue), filter chips, search, table dengan aksi konfirmasi/selesai/pending/batal/hapus
- ✅ Backend tests: 29/29 pytest passed (auth, services, availability, bookings, admin endpoints, brute-force lockout)
- ✅ Frontend tests: 100% e2e flows passed (landing, booking, admin login, dashboard CRUD, responsive 390/768/1440px)
- ✅ All interactive elements have `data-testid` attributes
- ✅ `/app/memory/test_credentials.md` updated dengan kredensial admin
- ✅ `/app/auth_testing.md` siap untuk testing

## Backlog / Next Iterations
### P0 (next session)
- Tune mobile hero line-break (cosmetic em-dash dangling at <sm breakpoint)
- Lazy-mount Hero3D dengan poster fallback untuk mobile FCP

### P1
- Email konfirmasi otomatis via SendGrid/Resend setelah booking
- Reschedule/cancel link untuk klien (tokenized URL)
- Integrasi pembayaran (Midtrans/Stripe) untuk pre-payment
- Admin: ubah jadwal (drag-drop di kalender) + tambah slot blok manual

### P2
- Dual language (ID/EN switcher)
- Calendar export (.ics / Google Calendar add)
- Notifikasi WhatsApp via Twilio/WA Business API
- Multi-admin (role-based access control)
- Analytics (booking funnel, conversion per layanan)

## Endpoints Quick Reference
| Method | Path | Auth |
|---|---|---|
| GET | /api/ | – |
| GET | /api/services | – |
| GET | /api/services/{slug} | – |
| GET | /api/availability?date=YYYY-MM-DD | – |
| POST | /api/bookings | – |
| POST | /api/auth/login | – |
| GET | /api/auth/me | cookie |
| POST | /api/auth/logout | cookie |
| POST | /api/auth/refresh | refresh-cookie |
| GET | /api/admin/bookings | admin |
| PATCH | /api/admin/bookings/{id} | admin |
| DELETE | /api/admin/bookings/{id} | admin |
| GET | /api/admin/stats | admin |

## Admin Credentials (dev)
- Email: `admin@inscaledigital.id`
- Password: `AdminInscale#2026`
