# JWT Quick Reference Card

## 🚀 Quick Start

### 1. Generate Secrets
```bash
node generate-jwt-secrets.js
```

### 2. Update .env File
```bash
JWT_SECRET=<generated-secret>
JWT_REFRESH_SECRET=<generated-refresh-secret>
```

### 3. Test the Implementation
```bash
node test-jwt.js
```

---

## 📋 API Endpoints Summary

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/api/register` | POST | ❌ No | Create account & get tokens |
| `/api/login` | POST | ❌ No | Login & get tokens |
| `/api/refresh` | POST | ❌ No | Get new access token |
| `/api/logout` | POST | ✅ Yes | Invalidate tokens |
| `/api/profile` | GET | ✅ Yes | Get user profile |

---

## 🔑 Token Types

### Access Token (15 minutes)
- For API requests
- Short-lived
- Send in `Authorization: Bearer <token>` header

### Refresh Token (7 days)
- For getting new access tokens
- Long-lived
- Send in request body to `/api/refresh`

---

## 💻 Usage Examples

### Register
```bash
curl -X POST http://localhost:4000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Access Protected Route
```bash
curl http://localhost:4000/api/profile \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Refresh Token
```bash
curl -X POST http://localhost:4000/api/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

### Logout
```bash
curl -X POST http://localhost:4000/api/logout \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

---

## 🔒 Security Features

✅ **Password Hashing**: bcrypt with 10 salt rounds
✅ **Token Signing**: HMAC SHA-256
✅ **Token Expiration**: Configurable expiry times
✅ **Token Blacklisting**: Logout invalidates tokens
✅ **Input Validation**: Email format & password strength
✅ **Error Handling**: Detailed error messages
✅ **Separate Secrets**: Different keys for access & refresh tokens

---

## ⚠️ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Token expired` | Access token past 15 min | Use refresh endpoint |
| `Token revoked` | Token was logged out | Login again |
| `Invalid token` | Malformed token | Check token format |
| `Missing authorization` | No header sent | Add `Authorization: Bearer <token>` |

---

## 🛠️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `devsecret` | Access token secret (change in production!) |
| `JWT_REFRESH_SECRET` | `devrefreshsecret` | Refresh token secret (change in production!) |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |

---

## 📦 Dependencies

```json
{
  "jsonwebtoken": "^9.0.0",  // JWT creation & verification
  "bcrypt": "^5.1.0",        // Password hashing
  "dotenv": "^16.0.0",       // Environment variables
  "express": "^4.18.2"       // Web framework
}
```

---

## 🎯 JWT Token Structure

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDkwMCwiaXNzIjoiYnVncy1hcGktYXZlbmdlcnMiLCJhdWQiOiJidWdzLWFwaS1jbGllbnQifQ.signature

  HEADER            |                    PAYLOAD                                    |  SIGNATURE
```

**Header**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload**
```json
{
  "userId": 1,
  "email": "user@example.com",
  "type": "access",
  "iat": 1700000000,
  "exp": 1700000900,
  "iss": "bugs-api-avengers",
  "aud": "bugs-api-client"
}
```

---

## 📚 More Info

See `JWT_IMPLEMENTATION.md` for comprehensive documentation.
