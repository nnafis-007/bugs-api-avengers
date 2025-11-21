# Frontend JWT Implementation Guide

## 🎯 What Was Fixed

The frontend now properly handles JWT authentication with:

✅ **Token Persistence**: Tokens stored in `localStorage`
✅ **Auto-Login**: Checks for existing token on page load
✅ **Automatic Redirect**: Logged-in users see profile page immediately
✅ **Token Refresh**: Automatically refreshes expired access tokens
✅ **Proper Logout**: Clears tokens and notifies backend
✅ **Updated API Format**: Uses new `accessToken` and `refreshToken` fields

---

## 🔄 How It Works Now

### **1. Page Load Flow**

```
User visits "/" 
    ↓
useEffect runs on mount
    ↓
Check localStorage for accessToken
    ↓
Token Found? ──NO──→ Show login form
    ↓ YES
Verify token with /api/profile
    ↓
Valid? ──NO──→ Try refresh token ──NO──→ Show login form
    ↓ YES           ↓ YES
Show profile page   Show profile page with new token
```

### **2. Login/Register Flow**

```
User enters credentials
    ↓
Call /api/login or /api/register
    ↓
Receive: { accessToken, refreshToken, user }
    ↓
Store in localStorage + React state
    ↓
Set isAuthenticated = true
    ↓
Automatically redirect to profile view
    ↓
Auto-load products
```

### **3. Token Refresh Flow**

```
User makes request with expired access token
    ↓
API returns 401 with "Token expired" error
    ↓
Frontend calls /api/refresh with refreshToken
    ↓
Receive new accessToken
    ↓
Update localStorage + state
    ↓
Retry original request with new token
```

### **4. Logout Flow**

```
User clicks "Logout"
    ↓
Call /api/logout with both tokens
    ↓
Clear localStorage
    ↓
Clear React state
    ↓
Show login form
```

---

## 📦 Token Storage

### **localStorage Keys**

```javascript
localStorage.setItem('accessToken', 'eyJhbGc...')
localStorage.setItem('refreshToken', 'eyJhbGc...')
```

### **Why localStorage?**

✅ Persists across page refreshes
✅ Survives browser restarts
✅ Simple to implement

⚠️ **Production Note**: Consider using `httpOnly` cookies for better security against XSS attacks.

---

## 🎨 UI States

### **Loading State**
```
┌─────────────────────┐
│  Loading...         │
│  Checking auth...   │
└─────────────────────┘
```
Shown while verifying token on initial page load.

### **Not Authenticated**
```
┌─────────────────────────────┐
│  Login App                  │
├─────────────────────────────┤
│  Please Login or Register   │
│  [email input]              │
│  [password input]           │
│  [Register] [Login]         │
└─────────────────────────────┘
```

### **Authenticated**
```
┌─────────────────────────────────────────┐
│  Login App   ✓ Logged in: user@mail.com │ [Logout]
├─────────────────────────────────────────┤
│  Your Profile                            │
│  [View Profile Details] [Refresh Products]│
│                                          │
│  Welcome back, user@example.com!        │
└─────────────────────────────────────────┘
```

---

## 🔑 Key Features

### **1. Automatic Authentication Check**
```javascript
useEffect(() => {
  const storedAccessToken = localStorage.getItem('accessToken')
  if (storedAccessToken) {
    verifyAndLoadProfile(storedAccessToken)
  }
}, [])
```
Runs once on component mount to check for existing session.

### **2. Token Verification**
```javascript
async function verifyAndLoadProfile(token, refresh) {
  const res = await fetch('/api/profile', {
    headers: { Authorization: `Bearer ${token}` }
  })
  
  if (res.ok) {
    // Token valid, show profile
    setIsAuthenticated(true)
  } else if (res.status === 401) {
    // Token expired, try refresh
    await refreshAccessToken(refresh)
  }
}
```

### **3. Automatic Token Refresh**
```javascript
async function refreshAccessToken(refresh) {
  const res = await fetch('/api/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refresh })
  })
  
  if (res.ok) {
    const { accessToken } = await res.json()
    localStorage.setItem('accessToken', accessToken)
    // Retry with new token
  } else {
    // Refresh failed, logout
    handleLogout()
  }
}
```

### **4. Secure Logout**
```javascript
async function handleLogout() {
  // Notify backend to blacklist tokens
  await fetch('/api/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ refreshToken })
  })
  
  // Clear local storage
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  
  // Reset state
  setIsAuthenticated(false)
}
```

---

## 🧪 Testing the Changes

### **Test 1: Fresh Login**
1. Open browser in incognito/private mode
2. Go to `http://localhost` (or your domain)
3. Should see login form
4. Enter credentials and login
5. Should see profile page with user email

### **Test 2: Page Refresh (Token Persistence)**
1. After logging in, refresh the page (F5)
2. Should **NOT** show login form
3. Should immediately show profile page
4. Should see "Welcome back, [email]" message

### **Test 3: New Tab (Same Session)**
1. After logging in, open new tab
2. Go to `http://localhost`
3. Should automatically show profile page
4. No login required

### **Test 4: Browser Restart (Session Persistence)**
1. Login to the app
2. Close all browser windows
3. Reopen browser and go to `http://localhost`
4. Should still be logged in (tokens in localStorage)

### **Test 5: Token Expiration (Auto-Refresh)**
1. Login to the app
2. Wait 15+ minutes (access token expires)
3. Click "View Profile Details" or "Refresh Products"
4. Should automatically refresh token in background
5. Request should succeed without re-login

### **Test 6: Logout**
1. Click "Logout" button
2. Should see login form
3. Refresh page - should still see login form
4. Old tokens should not work (blacklisted)

---

## 🔧 Configuration

### **API Base URL**
```javascript
const apiBase = '' // Uses same-origin (behind nginx proxy)
```

For direct backend access (development):
```javascript
const apiBase = 'http://localhost:4000'
```

### **Token Expiry Times**
Configured in backend `.env`:
```env
JWT_EXPIRES_IN=15m          # Access token
JWT_REFRESH_EXPIRES_IN=7d   # Refresh token
```

---

## 🚀 What's Different From Before

### **Before**
- ❌ Token only in React state (lost on refresh)
- ❌ Always showed login form on page load
- ❌ No automatic authentication check
- ❌ Used old `token` field (not `accessToken`)
- ❌ No token refresh mechanism
- ❌ No logout functionality

### **After**
- ✅ Tokens in localStorage (persists across refreshes)
- ✅ Auto-redirects to profile if logged in
- ✅ Checks authentication on every page load
- ✅ Uses new `accessToken` and `refreshToken` fields
- ✅ Automatically refreshes expired tokens
- ✅ Full logout with token blacklisting

---

## 🛡️ Security Considerations

### **Current Implementation (localStorage)**
✅ Simple and works across tabs
✅ Persists across browser restarts
⚠️ Vulnerable to XSS attacks

### **Production Recommendations**

1. **Use httpOnly Cookies**
   ```javascript
   // Backend sets cookies instead of returning tokens
   res.cookie('accessToken', token, { 
     httpOnly: true, 
     secure: true, 
     sameSite: 'strict' 
   })
   ```

2. **Add CSRF Protection**
   - Use CSRF tokens for state-changing operations
   - Implement `sameSite` cookie attribute

3. **Content Security Policy**
   - Add CSP headers to prevent XSS
   - Restrict script sources

4. **Token Rotation**
   - Issue new refresh token on each use
   - Invalidate old refresh tokens

---

## 📱 User Experience Improvements

### **Smooth Auto-Login**
```javascript
if (loading) {
  return <div>Loading... Checking authentication status...</div>
}
```
Shows loading state while verifying token (prevents flash of login form).

### **Welcome Back Message**
```javascript
setMessage(`Welcome back, ${data.user.email}!`)
```
Friendly message for returning users.

### **Auto-Load Products**
```javascript
if (res.ok) {
  setIsAuthenticated(true)
  await fetchProducts() // Automatically load data
}
```
Logged-in users see products immediately.

### **Persistent Login Indicator**
```javascript
<span style={{ color: '#38a169' }}>
  ✓ Logged in as: {user.email}
</span>
```
Always shows who's logged in.

---

## 🎓 How to Extend

### **Add Protected Routes**
```javascript
{isAuthenticated && (
  <div>
    <h3>Protected Content</h3>
    <p>Only logged-in users see this!</p>
  </div>
)}
```

### **Add Remember Me**
```javascript
// Store preference
localStorage.setItem('rememberMe', true)

// On logout, check preference
if (!localStorage.getItem('rememberMe')) {
  localStorage.removeItem('accessToken')
}
```

### **Add Token Expiry Warning**
```javascript
// Decode JWT to check expiry
const payload = JSON.parse(atob(accessToken.split('.')[1]))
const expiresIn = payload.exp * 1000 - Date.now()

if (expiresIn < 60000) { // Less than 1 minute
  showWarning('Your session will expire soon')
}
```

---

## ✅ Summary

Your frontend now properly implements JWT authentication with:

1. ✅ **Token persistence** in localStorage
2. ✅ **Automatic login** for returning users
3. ✅ **Profile redirect** when already logged in
4. ✅ **Token refresh** when access token expires
5. ✅ **Proper logout** with backend notification
6. ✅ **Better UX** with loading states and user feedback

**Result**: When you visit `/` and you're already logged in, you'll go straight to your profile page! 🎉
