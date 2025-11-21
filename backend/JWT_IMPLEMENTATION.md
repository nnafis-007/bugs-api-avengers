# JWT Implementation Documentation

## Overview

This backend implements a **production-ready JWT (JSON Web Token) authentication system** with industry best practices including:

- ✅ Access tokens (short-lived)
- ✅ Refresh tokens (long-lived)
- ✅ Token blacklisting for logout
- ✅ Comprehensive error handling
- ✅ Token expiration management
- ✅ Secure password hashing with bcrypt
- ✅ Input validation

---

## How It Works

### 1. **Token Generation (Login/Register)**

When a user logs in or registers, the system generates **two tokens**:

#### **Access Token** (Short-lived: 15 minutes by default)
```javascript
{
  userId: 123,
  email: "user@example.com",
  type: "access",
  iat: 1700000000,  // Issued at timestamp
  exp: 1700000900,  // Expiration timestamp
  iss: "bugs-api-avengers",  // Issuer
  aud: "bugs-api-client"     // Audience
}
```
- Used for API requests
- Signed with `JWT_SECRET`
- Short expiry reduces risk if compromised

#### **Refresh Token** (Long-lived: 7 days by default)
```javascript
{
  userId: 123,
  email: "user@example.com",
  type: "refresh",
  iat: 1700000000,
  exp: 1700604800,
  iss: "bugs-api-avengers",
  aud: "bugs-api-client"
}
```
- Used to obtain new access tokens
- Signed with `JWT_REFRESH_SECRET` (different from access token secret)
- Longer expiry for better UX

### 2. **Authentication Flow**

```
┌─────────┐                ┌─────────┐                ┌──────────┐
│ Client  │                │ Backend │                │ Database │
└────┬────┘                └────┬────┘                └────┬─────┘
     │                          │                          │
     │ POST /api/login          │                          │
     │ {email, password}        │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
     │                          │ Query user               │
     │                          ├─────────────────────────>│
     │                          │                          │
     │                          │ User data                │
     │                          │<─────────────────────────┤
     │                          │                          │
     │                          │ Verify password (bcrypt) │
     │                          │                          │
     │                          │ Generate JWT tokens      │
     │                          │                          │
     │ {accessToken, refreshToken}                         │
     │<─────────────────────────┤                          │
     │                          │                          │
     │ GET /api/profile         │                          │
     │ Authorization: Bearer <accessToken>                 │
     ├─────────────────────────>│                          │
     │                          │                          │
     │                          │ Verify JWT               │
     │                          │ Check blacklist          │
     │                          │                          │
     │                          │ Query user profile       │
     │                          ├─────────────────────────>│
     │                          │                          │
     │ {user: {...}}            │                          │
     │<─────────────────────────┤                          │
```

### 3. **Token Refresh Flow**

When the access token expires (after 15 minutes), the client can use the refresh token:

```
┌─────────┐                ┌─────────┐
│ Client  │                │ Backend │
└────┬────┘                └────┬────┘
     │                          │
     │ POST /api/refresh        │
     │ {refreshToken}           │
     ├─────────────────────────>│
     │                          │
     │                          │ Verify refresh token
     │                          │ Check blacklist
     │                          │ Generate new access token
     │                          │
     │ {accessToken}            │
     │<─────────────────────────┤
```

### 4. **Logout & Token Blacklisting**

```javascript
POST /api/logout
Authorization: Bearer <accessToken>
Body: { refreshToken: "<refresh_token>" }
```

- Adds both tokens to an in-memory blacklist
- Prevents reuse of logged-out tokens
- **Production Note**: Use Redis or database for distributed systems

---

## API Endpoints

### 1. **POST /api/register**
Register a new user and receive tokens immediately.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "15m",
  "tokenType": "Bearer",
  "message": "Registration successful. You are now logged in."
}
```

**Validation:**
- Email must be valid format
- Password must be at least 8 characters
- Email must not already exist

---

### 2. **POST /api/login**
Authenticate and receive access + refresh tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "15m",
  "tokenType": "Bearer",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

---

### 3. **POST /api/refresh**
Get a new access token using a refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "15m",
  "tokenType": "Bearer"
}
```

---

### 4. **POST /api/logout**
Invalidate current tokens (requires authentication).

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "message": "Logged out successfully",
  "note": "Your tokens have been invalidated"
}
```

---

### 5. **GET /api/profile**
Get authenticated user's profile (requires authentication).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Security Features

### 1. **Password Security**
- Passwords hashed using `bcrypt` with salt rounds of 10
- Never stored in plain text
- Compared using constant-time comparison

### 2. **Token Security**
- Signed using HMAC SHA-256 algorithm
- Contains expiration timestamp (`exp` claim)
- Includes issuer (`iss`) and audience (`aud`) claims for validation
- Different secrets for access and refresh tokens

### 3. **Error Handling**
Comprehensive error messages for different scenarios:
- Token expired
- Invalid token format
- Missing authorization header
- Token revoked/blacklisted
- Invalid credentials

### 4. **Token Blacklisting**
- Prevents reuse of logged-out tokens
- In-memory Set for development
- **Recommended for production**: Redis with TTL expiration

---

## Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
PORT=4000
DATABASE_URL=postgresql://postgres:123@db:5432/login_db

# Generate secure secrets with: node generate-jwt-secrets.js
JWT_SECRET=<64-byte-hex-string>
JWT_REFRESH_SECRET=<different-64-byte-hex-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Generate Secure Secrets

```bash
node generate-jwt-secrets.js
```

Or manually:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Client Implementation Example

### JavaScript/Fetch Example

```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:4000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
});

const { accessToken, refreshToken } = await loginResponse.json();

// Store tokens (use httpOnly cookies in production for better security)
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// 2. Make authenticated request
const profileResponse = await fetch('http://localhost:4000/api/profile', {
  headers: { 
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}` 
  }
});

// 3. Handle token expiration and refresh
async function fetchWithAuth(url, options = {}) {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    }
  });

  // If token expired, refresh it
  if (response.status === 401) {
    const errorData = await response.json();
    if (errorData.error === 'Token expired') {
      const refreshResponse = await fetch('http://localhost:4000/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
      });

      if (refreshResponse.ok) {
        const { accessToken } = await refreshResponse.json();
        localStorage.setItem('accessToken', accessToken);
        
        // Retry original request with new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`
          }
        });
      } else {
        // Refresh token also expired, redirect to login
        window.location.href = '/login';
        return null;
      }
    }
  }

  return response;
}

// 4. Logout
async function logout() {
  await fetch('http://localhost:4000/api/logout', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    },
    body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') })
  });

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}
```

---

## Production Checklist

- [ ] Generate strong, unique JWT secrets (minimum 256 bits)
- [ ] Store secrets in environment variables or secret manager (AWS Secrets Manager, HashiCorp Vault)
- [ ] Use HTTPS only (never send tokens over HTTP)
- [ ] Implement Redis for token blacklisting in distributed systems
- [ ] Consider shorter access token expiry (5-15 minutes)
- [ ] Implement rate limiting on login endpoint
- [ ] Add CORS configuration for specific origins
- [ ] Enable httpOnly, secure, sameSite cookies for token storage
- [ ] Implement token rotation (issue new refresh token on each refresh)
- [ ] Add monitoring for failed authentication attempts
- [ ] Consider adding 2FA for sensitive operations
- [ ] Implement account lockout after multiple failed login attempts

---

## Testing the Implementation

### Using cURL

```bash
# 1. Register
curl -X POST http://localhost:4000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Login
curl -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 3. Access protected route (replace TOKEN with actual token)
curl http://localhost:4000/api/profile \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# 4. Refresh token
curl -X POST http://localhost:4000/api/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'

# 5. Logout
curl -X POST http://localhost:4000/api/logout \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

---

## Why This Is Real JWT (Not Dummy)

1. **Cryptographically Signed**: Uses HMAC SHA-256 with secret keys
2. **Standard Claims**: Includes `iat`, `exp`, `iss`, `aud` per JWT RFC 7519
3. **Token Verification**: Validates signature, expiration, and blacklist status
4. **Secure Secrets**: Requires strong, random secrets (warns if weak)
5. **Industry Pattern**: Implements access/refresh token pattern used by OAuth 2.0
6. **Production Ready**: Includes error handling, validation, and security best practices

---

## Common Issues & Solutions

### Issue: "Token expired"
**Solution**: Use the refresh token endpoint to get a new access token.

### Issue: "Invalid token"
**Solution**: Ensure the token is sent in the correct format: `Authorization: Bearer <token>`

### Issue: "Token revoked"
**Solution**: User has logged out. Login again to get new tokens.

### Issue: "Using weak JWT_SECRET" warning
**Solution**: Run `node generate-jwt-secrets.js` and update your `.env` file.

---

## Technical Details

### JWT Structure

A JWT consists of three parts separated by dots:
```
header.payload.signature
```

Example decoded:
```javascript
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "userId": 1,
  "email": "user@example.com",
  "type": "access",
  "iat": 1700000000,
  "exp": 1700000900,
  "iss": "bugs-api-avengers",
  "aud": "bugs-api-client"
}

// Signature
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  JWT_SECRET
)
```

### Algorithm: HS256
- HMAC with SHA-256
- Symmetric key algorithm
- Same secret used for signing and verification
- Fast and secure for server-to-server communication

---

## License & Credits

Implemented as part of the bugs-api-avengers project.
