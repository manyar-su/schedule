# Auth Testing Playbook (Booking Schedule App)

## Step 1: MongoDB Verification
```
mongosh
use booking_schedule
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
- bcrypt hash should start with `$2b$`
- Index `users.email` must be unique
- TTL index on `password_reset_tokens.expires_at`

## Step 2: API Testing (cookie-based JWT)
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@inscaledigital.id","password":"AdminInscale#2026"}'

curl -b cookies.txt http://localhost:8001/api/auth/me
```

## Test admin credentials
- Email: admin@inscaledigital.id
- Password: AdminInscale#2026
- Role: admin

## Auth endpoints
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
