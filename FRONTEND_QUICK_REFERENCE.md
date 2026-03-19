# Frontend Integration - Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Create API Client (Copy/Paste This)

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
      localStorage.removeItem('authToken');
      throw new Error('Unauthorized - Please login again');
    }

    return response.json();
  }

  signup(name, email, password) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  }

  login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  getMe() {
    return this.request('/api/auth/me');
  }

  calculateRoute(origin, destination, mode = 'car', options = {}) {
    return this.request('/api/route', {
      method: 'POST',
      body: JSON.stringify({ origin, destination, mode, options })
    });
  }

  snapPoint(lng, lat, mode = 'car') {
    return this.request(`/api/route/snap?lng=${lng}&lat=${lat}&mode=${mode}`);
  }

  getNearbyStops(lng, lat, radius = 600) {
    return this.request(`/api/route/transit-stops?lng=${lng}&lat=${lat}&radius=${radius}`);
  }

  reportHazard(type, lat, lng, severity = 'medium', description = '') {
    return this.request('/api/hazards', {
      method: 'POST',
      body: JSON.stringify({ type, lat, lng, severity, description })
    });
  }

  getHazards(minLng, minLat, maxLng, maxLat) {
    return this.request(
      `/api/hazards?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`
    );
  }

  confirmHazard(hazardId) {
    return this.request(`/api/hazards/${hazardId}/confirm`, {
      method: 'POST'
    });
  }
}

const api = new NavigationAPI();
```

### 2. Handle Signup/Login

```javascript
// Signup
async function signup() {
  try {
    const result = await api.signup('John Doe', 'john@example.com', 'Pass123!');
    if (result.success) {
      api.setToken(result.data.token);
      console.log('Signed up:', result.data.user);
      // Redirect to map
    } else {
      alert(result.error);
    }
  } catch (error) {
    alert('Signup failed: ' + error.message);
  }
}

// Login
async function login() {
  try {
    const result = await api.login('john@example.com', 'Pass123!');
    if (result.success) {
      api.setToken(result.data.token);
      console.log('Logged in:', result.data.user);
      // Redirect to map
    } else {
      alert(result.error);
    }
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
}

// Logout
function logout() {
  localStorage.removeItem('authToken');
  // Redirect to login
}

// Check if logged in
function isLoggedIn() {
  return !!localStorage.getItem('authToken');
}
```

### 3. Calculate Route

```javascript
async function getRoute(originLat, originLng, destLat, destLng) {
  try {
    const result = await api.calculateRoute(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
      'car' // or 'foot', 'transit', 'multimodal'
    );

    if (result.success) {
      const route = result.data.route;
      console.log('Distance:', route.distance, 'meters');
      console.log('Duration:', route.duration, 'seconds');
      console.log('Coordinates:', route.geometry.coordinates);
      
      if (result.data.hazards?.hasCriticalHazards) {
        alert('⚠️ Critical hazards detected!');
        console.log('Hazards:', result.data.hazards.hazards);
      }
      
      return route;
    }
  } catch (error) {
    console.error('Route error:', error);
  }
}
```

### 4. Report Hazard

```javascript
async function reportHazard(lat, lng) {
  try {
    const result = await api.reportHazard(
      'pothole',      // type
      lat,
      lng,
      'medium',       // severity: low, medium, high, critical
      'Large hole'    // description
    );

    if (result.success) {
      console.log('Hazard reported:', result.data);
      alert('Thanks for reporting! ✓');
    }
  } catch (error) {
    alert('Error reporting hazard: ' + error.message);
  }
}
```

### 5. Show Hazards on Map

```javascript
async function loadHazards(minLng, minLat, maxLng, maxLat) {
  try {
    const result = await api.getHazards(minLng, minLat, maxLng, maxLat);
    
    if (result.success) {
      result.data.forEach(hazard => {
        // Add marker to map
        addMarker(hazard.lng, hazard.lat, {
          type: hazard.type,
          severity: hazard.severity,
          confirmations: hazard.confirmation_count
        });
      });
    }
  } catch (error) {
    console.error('Error loading hazards:', error);
  }
}
```

---

## 📋 API Endpoints Cheat Sheet

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | **Yes** | Get current user |
| POST | `/api/route` | **Yes** | Calculate route |
| GET | `/api/route/snap` | No | Snap to road |
| GET | `/api/route/transit-stops` | No | Nearby transit |
| GET | `/api/hazards` | No | Get hazards in area |
| POST | `/api/hazards` | **Yes** | Report hazard |
| POST | `/api/hazards/:id/confirm` | **Yes** | Confirm hazard |
| DELETE | `/api/hazards/:id` | **Yes** (admin) | Remove hazard |

---

## 🔐 Authentication Flow

```
┌─────────────────┐
│   Signup Form   │
│  (name, email,  │
│    password)    │
└────────┬────────┘
         │
         ├─ Validate input
         │  • email format
         │  • password ≥8 chars
         │
         ├─ POST /api/auth/register
         │
         ├─ Response: { token, user }
         │
         ├─ localStorage.setItem('authToken', token)
         │
         └─→ Redirect to Map
```

---

## 🗂️ Request Template (All Endpoints)

### No Auth Required
```javascript
const response = await fetch('http://localhost:3000/api/hazards', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
```

### Auth Required
```javascript
const token = localStorage.getItem('authToken');
const response = await fetch('http://localhost:3000/api/route', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`  // ← Must include token
  },
  body: JSON.stringify({
    origin: { lat: 36.8065, lng: 10.1815 },
    destination: { lat: 36.8190, lng: 10.1658 },
    mode: 'car'
  })
});
const data = await response.json();
```

---

## 🚨 Error Handling Quick Reference

```javascript
async function safeRequest(fn) {
  try {
    const result = await fn();

    if (!result.success) {
      console.error('API Error:', result.error);
      if (result.details) {
        result.details.forEach(d => console.error(`  - ${d.param}: ${d.msg}`));
      }
      return null;
    }

    return result.data;
  } catch (error) {
    if (error.message === 'Unauthorized - Please login again') {
      // Token expired - redirect to login
      window.location.href = '/login';
    } else {
      console.error('Network Error:', error);
    }
    return null;
  }
}

// Usage
const user = await safeRequest(() => api.getMe());
```

---

## 📍 Coordinate Format

```javascript
// Always use: { lat: number, lng: number }
origin: {
  lat: 36.8065,    // Latitude (-90 to 90)
  lng: 10.1815     // Longitude (-180 to 180)
}
```

---

## 🛣️ Routing Modes

```javascript
// Car (default)
api.calculateRoute(origin, destination, 'car')

// Walking
api.calculateRoute(origin, destination, 'foot')

// Biking
api.calculateRoute(origin, destination, 'bike')

// Public Transit
api.calculateRoute(origin, destination, 'transit')

// Walking + Transit
api.calculateRoute(origin, destination, 'multimodal')
```

---

## ⚠️ Hazard Types & Severity

**Types:**
```javascript
'road_closure'   // Street blocked
'flooding'       // Water hazard
'construction'   // Work zone
'accident'       // Collision
'pothole'        // Road damage
'landslide'      // Geological
'unsafe_area'    // Safety concern
'other'          // Unknown
```

**Severity:**
```javascript
'low'            // Minor inconvenience
'medium'         // Moderate disruption
'high'           // Significant hazard
'critical'       // Severe danger
```

---

## 📱 React Example

```jsx
import React, { useState, useEffect } from 'react';

const api = new NavigationAPI();

function App() {
  const [user, setUser] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(false);

  // Check if logged in on mount
  useEffect(() => {
    if (api.getToken()) {
      loadUser();
    }
  }, []);

  async function loadUser() {
    const result = await api.getMe();
    if (result.success) {
      setUser(result.data);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  async function handleCalculateRoute() {
    if (!origin || !destination) return;
    
    setLoading(true);
    const result = await api.calculateRoute(origin, destination, 'car');
    if (result.success) {
      setRoute(result.data.route);
      setHazards(result.data.hazards?.hazards || []);
    }
    setLoading(false);
  }

  async function handleReportHazard(type, lat, lng) {
    const result = await api.reportHazard(type, lat, lng, 'medium', '');
    if (result.success) {
      alert('Hazard reported!');
    }
  }

  if (!user) {
    return <LoginPage onLogin={loadUser} />;
  }

  return (
    <div>
      <h1>Navigation</h1>
      <p>Welcome, {user.name}!</p>
      
      <div>
        <input 
          placeholder="Origin"
          onChange={(e) => setOrigin({ lat: 36.8065, lng: 10.1815 })}
        />
        <input 
          placeholder="Destination"
          onChange={(e) => setDestination({ lat: 36.8190, lng: 10.1658 })}
        />
        <button onClick={handleCalculateRoute} disabled={loading}>
          Calculate Route
        </button>
      </div>

      {route && (
        <div>
          <p>Distance: {route.distance}m</p>
          <p>Duration: {route.duration}s</p>
        </div>
      )}

      {hazards.length > 0 && (
        <div>
          <h3>Hazards ({hazards.length})</h3>
          {hazards.map(h => (
            <div key={h.id}>
              {h.type} ({h.severity}) - {h.confirmation_count} confirmations
            </div>
          ))}
        </div>
      )}

      <button onClick={() => {
        localStorage.removeItem('authToken');
        setUser(null);
      }}>
        Logout
      </button>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    const result = await api.login(email, password);
    if (result.success) {
      api.setToken(result.data.token);
      onLogin();
    } else {
      alert(result.error);
    }
  }

  return (
    <div>
      <input 
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input 
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}

export default App;
```

---

## 🐛 Debugging Tips

**Check if token exists:**
```javascript
console.log(localStorage.getItem('authToken'));
```

**Inspect network request:**
1. Open DevTools (F12)
2. Go to Network tab
3. Make API call
4. Click request
5. Check Headers (Authorization: Bearer...) and Response

**Mock API Response:**
```javascript
// Fake response for testing UI
const mockRoute = {
  distance: 2340,
  duration: 420,
  geometry: {
    type: 'LineString',
    coordinates: [[10.1815, 36.8065], [10.1658, 36.8190]]
  }
};
setRoute(mockRoute);
```

---

## ✅ Testing Checklist

- [ ] Signup works
- [ ] Can't signup with duplicate email (409)
- [ ] Can't signup with weak password (422)
- [ ] Login works
- [ ] Token stored in localStorage
- [ ] GET /api/auth/me returns user
- [ ] Token included in all protected requests
- [ ] Calculate route works
- [ ] Hazards displayed on map
- [ ] Can report hazard
- [ ] Can confirm hazard
- [ ] Logout clears token
- [ ] Can't access protected endpoints after logout
- [ ] 401 errors redirect to login

---

## 📞 Support

**Backend Running?**
```bash
curl http://localhost:3000/api/health
# Should return: { status: 'ok' }
```

**Token Valid?**
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/auth/me
# Should return user data
```

**Check CORS?**
```bash
# If you see CORS errors, backend must be running
# and API URL must match exactly
```

---

**Last Updated**: March 19, 2026  
**For Frontend Developers**
