# Frontend Integration Guide - Navigation API

**For Frontend Developers integrating with Fast-Track Backend**

---

## Quick Start

### 1. API Base URL
```
Development:  http://localhost:3000
Production:   https://your-domain.com
```

### 2. Authentication Flow
```
Signup → Get JWT → Store JWT → Use in API calls
Login  → Get JWT → Store JWT → Use in API calls
```

---

## Authentication Endpoints

### Register (Create Account)
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "is_active": true,
      "createdAt": "2026-03-19T12:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation Errors (422 Unprocessable Entity):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "value": "invalid-email",
      "msg": "Invalid value",
      "param": "email",
      "location": "body"
    }
  ]
}
```

**Duplicate Email (409 Conflict):**
```json
{
  "success": false,
  "error": "Email already registered"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "last_login": "2026-03-19T12:05:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Invalid Credentials (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

### Verify Current User
```http
GET /api/auth/me
Authorization: Bearer <your-jwt-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "is_active": true,
    "createdAt": "2026-03-19T12:00:00Z"
  }
}
```

**No Token (401 Unauthorized):**
```json
{
  "success": false,
  "error": "No token provided"
}
```

**Invalid Token (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

---

## JWT Token Management

### What is the JWT Token?
A JWT (JSON Web Token) proves the user is authenticated. It's a string that looks like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItaWQiLCJyb2xlIjoic1VzZXIifQ.signature
```

### Token Properties
- **Expires**: 7 days from issuance
- **Contains**: User ID + Role (no password)
- **Format**: Bearer token (prefix with `Bearer ` in Authorization header)

### How to Store the Token

**Option 1: LocalStorage (Simple, Less Secure)**
```javascript
// After login/signup
localStorage.setItem('authToken', response.data.token);

// On page load
const token = localStorage.getItem('authToken');
```

**Pros**: Persists across page refreshes  
**Cons**: Vulnerable to XSS attacks

**Option 2: SessionStorage (Session Only)**
```javascript
// After login/signup
sessionStorage.setItem('authToken', response.data.token);

// Cleared when tab closes
```

**Pros**: Cleared on tab close  
**Cons**: Lost on page refresh

**Option 3: HttpOnly Cookie (Most Secure)**
```javascript
// Backend sets via Set-Cookie header (requires backend support)
// Frontend cannot access directly
// Automatically sent with requests
```

**Pros**: Protected from XSS  
**Cons**: Requires backend configuration

**Option 4: In-Memory (Most Secure)**
```javascript
let authToken = null;

function login(credentials) {
  const response = await fetch('/api/auth/login', { ... });
  authToken = response.data.token;
  // Lost on page refresh - require re-login
}
```

**Recommendation for this project**: Use LocalStorage with refresh token strategy (implement later)

---

## Making Authenticated API Calls

### All Protected Endpoints Require JWT

Include the token in the `Authorization` header:

```javascript
const token = localStorage.getItem('authToken');

const response = await fetch('/api/route', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    origin: { lat: 36.8065, lng: 10.1815 },
    destination: { lat: 36.8190, lng: 10.1658 },
    mode: 'car'
  })
});
```

### JavaScript/Fetch Template

```javascript
class NavigationAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  getToken() {
    return localStorage.getItem('authToken');
  }

  setToken(token) {
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    localStorage.removeItem('authToken');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      this.clearToken();
      // Redirect to login
    }

    return response.json();
  }

  async signup(name, email, password) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    if (data.data?.token) {
      this.setToken(data.data.token);
    }
    return data;
  }

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.data?.token) {
      this.setToken(data.data.token);
    }
    return data;
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  async calculateRoute(origin, destination, mode = 'car', options = {}) {
    return this.request('/api/route', {
      method: 'POST',
      body: JSON.stringify({ origin, destination, mode, options })
    });
  }

  async snapPoint(lng, lat, mode = 'car') {
    return this.request(`/api/route/snap?lng=${lng}&lat=${lat}&mode=${mode}`);
  }

  async getNearbyTransitStops(lng, lat, radius = 600) {
    return this.request(`/api/route/transit-stops?lng=${lng}&lat=${lat}&radius=${radius}`);
  }

  async reportHazard(type, lat, lng, severity = 'medium', description = '') {
    return this.request('/api/hazards', {
      method: 'POST',
      body: JSON.stringify({ type, lat, lng, severity, description })
    });
  }

  async getHazards(minLng, minLat, maxLng, maxLat) {
    return this.request(
      `/api/hazards?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`
    );
  }

  async confirmHazard(hazardId) {
    return this.request(`/api/hazards/${hazardId}/confirm`, {
      method: 'POST'
    });
  }
}

// Usage
const api = new NavigationAPI();

// Signup
await api.signup('John Doe', 'john@example.com', 'Pass123!');

// Login
await api.login('john@example.com', 'Pass123!');

// Use API
const me = await api.getMe();
const route = await api.calculateRoute(
  { lat: 36.8065, lng: 10.1815 },
  { lat: 36.8190, lng: 10.1658 },
  'car'
);
```

### Using Axios (Alternative)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000'
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Usage
const response = await api.post('/api/auth/login', {
  email: 'john@example.com',
  password: 'Pass123!'
});

localStorage.setItem('authToken', response.data.data.token);
```

### Using React (with Context API)

```javascript
import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('authToken', data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
        return data;
      } else {
        throw new Error(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email, password) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('authToken', data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
        return data;
      } else {
        throw new Error(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Usage in component
function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      // Navigate to app
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  );
}
```

---

## Routing Endpoints (Protected - Requires JWT)

### Calculate Route
```http
POST /api/route
Authorization: Bearer <token>
Content-Type: application/json

{
  "origin": { "lat": 36.8065, "lng": 10.1815 },
  "destination": { "lat": 36.8190, "lng": 10.1658 },
  "mode": "car",
  "options": {
    "avoidHazards": true,
    "steps": true
  }
}
```

**Available Modes:**
- `car` - Driving
- `foot` - Walking
- `bike` - Cycling
- `transit` - Public transit
- `multimodal` - Walking + Transit

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "route": {
      "mode": "car",
      "distance": 2340,
      "duration": 420,
      "geometry": {
        "type": "LineString",
        "coordinates": [[10.1815, 36.8065], [10.1700, 36.8100], [10.1658, 36.8190]]
      },
      "legs": [...]
    },
    "hazards": {
      "hasHazards": true,
      "hasCriticalHazards": false,
      "hazards": [
        {
          "id": "hazard-uuid",
          "type": "pothole",
          "severity": "medium",
          "lat": 36.81,
          "lng": 10.18,
          "distance_to_route": 45.2
        }
      ]
    }
  }
}
```

### Snap Point to Road
```http
GET /api/route/snap?lng=10.18&lat=36.80&mode=car
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lng": 10.1815,
    "lat": 36.8065,
    "snapDistance": 3.2,
    "snapped": true
  }
}
```

### Get Nearby Transit Stops
```http
GET /api/route/transit-stops?lng=10.18&lat=36.80&radius=600
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stops": [
      {
        "id": "stop-1",
        "name": "Central Station",
        "lat": 36.8065,
        "lng": 10.1815,
        "distance": 250
      }
    ],
    "count": 1
  }
}
```

---

## Hazard Management Endpoints

### Create Hazard Report (Protected)
```http
POST /api/hazards
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "pothole",
  "severity": "medium",
  "lat": 36.81,
  "lng": 10.18,
  "radius_meters": 50,
  "description": "Large pothole on main street"
}
```

**Hazard Types:**
- `road_closure`
- `flooding`
- `construction`
- `accident`
- `pothole`
- `landslide`
- `unsafe_area`
- `other`

**Severity Levels:**
- `low`
- `medium`
- `high`
- `critical`

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "hazard-uuid",
    "type": "pothole",
    "severity": "medium",
    "location": { "type": "Point", "coordinates": [10.18, 36.81] },
    "radius_meters": 50,
    "confirmation_count": 0,
    "createdAt": "2026-03-19T12:00:00Z"
  }
}
```

### Get Hazards in Area (No Auth)
```http
GET /api/hazards?minLng=10.15&minLat=36.80&maxLng=10.20&maxLat=36.85
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "hazard-1",
      "type": "pothole",
      "severity": "medium",
      "lat": 36.81,
      "lng": 10.18,
      "confirmation_count": 5,
      "distance_to_route": null
    }
  ],
  "count": 1
}
```

### Confirm Hazard (Protected)
```http
POST /api/hazards/{id}/confirm
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Hazard confirmed"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Route calculated |
| 201 | Created | User registered |
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | No token / expired token |
| 403 | Forbidden | Not admin (for DELETE) |
| 404 | Not Found | User/hazard not found |
| 409 | Conflict | Duplicate email |
| 422 | Validation Failed | Invalid email format |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Database error |

### Standard Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "param": "email",
      "msg": "Invalid email format",
      "value": "invalid-email"
    }
  ]
}
```

### Error Handling Template
```javascript
async function makeRequest(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      } else if (response.status === 429) {
        throw new Error('Too many requests. Please try again later.');
      } else if (response.status === 422) {
        // Validation errors
        const messages = data.details
          .map(d => `${d.param}: ${d.msg}`)
          .join('\n');
        throw new Error(messages);
      } else {
        throw new Error(data.error || 'Something went wrong');
      }
    }

    return data.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

---

## Rate Limiting

### Limits
- **Auth endpoints**: 20 requests per 15 minutes
- **All other endpoints**: 100 requests per 15 minutes

### Response When Rate Limited (429)
```json
{
  "success": false,
  "error": "Too many requests, please slow down."
}
```

### How to Handle
```javascript
if (response.status === 429) {
  // Wait before retrying (exponential backoff)
  setTimeout(() => retryRequest(), 5000);
}
```

---

## CORS & Security

### CORS Headers (Configured on Backend)
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

If you get CORS errors:
1. Ensure backend is running
2. Check API URL matches exactly
3. For local dev: use `http://localhost:3000`

### Security Notes
- Never store sensitive info in tokens
- Always use HTTPS in production
- Validate input on frontend too (for UX)
- Never commit tokens to Git
- Clear token on logout

---

## Testing the API

### Using cURL

**Signup:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Verify User (with token):**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Using Postman
1. Create new requests for each endpoint
2. For protected endpoints:
   - Go to "Authorization" tab
   - Select "Bearer Token"
   - Paste JWT token
3. Send requests

### Using Insomnia
Similar to Postman - use Authorization tab for Bearer tokens

---

## Deployment Checklist

### Frontend
- [ ] Update API base URL for production
- [ ] Remove console.logs
- [ ] Implement proper error handling
- [ ] Test on actual mobile devices
- [ ] Enable HTTPS only
- [ ] Implement token refresh (optional)

### Backend (Already Configured)
- [ ] Set JWT_SECRET in environment
- [ ] Set CORS_ORIGIN to frontend domain
- [ ] Use HTTPS
- [ ] Database backups configured
- [ ] Error logging in place

---

## Common Issues & Solutions

### Issue: "No token provided"
**Cause**: Missing or malformed Authorization header  
**Solution**: 
```javascript
// WRONG
headers: { 'Authorization': 'eyJhbGciOiJ...' }

// CORRECT
headers: { 'Authorization': 'Bearer eyJhbGciOiJ...' }
```

### Issue: "Invalid or expired token"
**Cause**: Token expired or from wrong secret  
**Solution**: 
- Clear localStorage and login again
- Check JWT_SECRET matches frontend and backend

### Issue: "Too many requests"
**Cause**: Exceeded rate limit (20/15min for auth)  
**Solution**: 
- Implement exponential backoff
- Wait before retrying

### Issue: CORS Error
**Cause**: Frontend and backend origins don't match  
**Solution**: 
- Check API URL is correct
- Ensure backend has CORS enabled
- Check browser console for exact error

### Issue: 404 on /api/auth/me
**Cause**: Token valid but user not found in DB  
**Solution**: 
- User may have been deleted
- Check database
- Ask user to signup again

---

## Example UI Flow

```
[Signup/Login Page]
        ↓
    [Get JWT Token]
        ↓
    [Store in LocalStorage]
        ↓
[Main App (Map View)]
        ↓
    [GET /api/hazards] → Show hazards on map
    [POST /api/route] → Calculate route
    [POST /api/hazards] → Report hazard
        ↓
    [Refresh Token Monthly or on 401]
        ↓
    [Logout → Clear Token]
```

---

## Key Takeaways for Frontend Developers

1. **JWT tokens must be included** in every protected request's Authorization header
2. **Store JWT securely** (localStorage or HttpOnly cookie)
3. **Handle 401 responses** by clearing token and redirecting to login
4. **Validate input** before sending (good UX)
5. **Use HTTPS** in production (never send JWT over HTTP)
6. **Respect rate limits** (implement exponential backoff)
7. **Test all error cases** (missing token, expired token, 404, etc.)
8. **Test full auth flow** (signup → login → use API → logout)
9. **Handle network errors** gracefully
10. **Never expose token in URLs** (always use headers)

---

## Resources

**API Documentation:**
- Base: http://localhost:3000
- Root: GET / (lists all endpoints)
- Health: GET /api/health

**Frontend Tools:**
- Postman (API testing)
- Insomnia (API testing)
- React DevTools (debugging)
- Network tab in DevTools (inspect requests)

**Common Libraries:**
- Fetch API (native, no dependencies)
- Axios (Promise-based, popular)
- React Query (data fetching, caching)
- SWR (data fetching, caching)
- TanStack Query (advanced caching)

---

**Generated**: March 19, 2026  
**For**: Frontend Integration with Navigation Backend  
**Version**: 1.0.0
