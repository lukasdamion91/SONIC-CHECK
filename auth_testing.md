# SonicCheck Auth Testing

Admin auto-seeded:
- email: `admin@soniccheck.io`
- password: `Admin@Sonic2026`

JWT via httpOnly cookies (`samesite=none; secure=true`). Frontend axios uses `withCredentials: true`.

## API Smoke Tests
```bash
API="$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)/api"

# register
curl -c /tmp/c.txt -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"t1@example.com","password":"pass1234","role":"artist"}'

# /me with cookies
curl -b /tmp/c.txt "$API/auth/me"

# login
curl -c /tmp/c2.txt -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"t1@example.com","password":"pass1234"}'

# create scan
curl -b /tmp/c2.txt -X POST "$API/scans" -H "Content-Type: application/json" \
  -d '{"title":"My Track","lyrics":"hello world","region":"US"}'

# list scans
curl -b /tmp/c2.txt "$API/scans"

# regions
curl "$API/regions"
# plans
curl "$API/plans"
```
