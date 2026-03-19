// frontend/app.js

const API_BASE_URL = 'http://localhost:3001'; // adjust for production

// ====== Token helpers ======
function getToken() {
  return localStorage.getItem('authToken');
}

function setToken(token) {
  localStorage.setItem('authToken', token);
}

function clearToken() {
  localStorage.removeItem('authToken');
}

// ====== Generic request helper ======
async function apiRequest(endpoint, options = {}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );

  const token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const response = await fetch(API_BASE_URL + endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    throw new Error('Unauthorized - Please login again');
  }

  return response.json();
}

// ====== DOM refs ======
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');

const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

const signupNameInput = document.getElementById('signup-name');
const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const signupBtn = document.getElementById('signup-btn');
const signupError = document.getElementById('signup-error');

const userNameSpan = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

const modeSelect = document.getElementById('mode-select');
const originLatInput = document.getElementById('origin-lat');
const originLngInput = document.getElementById('origin-lng');
const destLatInput = document.getElementById('dest-lat');
const destLngInput = document.getElementById('dest-lng');
const routeBtn = document.getElementById('route-btn');
const routeError = document.getElementById('route-error');
const routeSummary = document.getElementById('route-summary');
const hazardsList = document.getElementById('hazards-list');

// ====== Auth flow ======
async function fetchCurrentUser() {
  try {
    const res = await apiRequest('/api/auth/me');
    if (res.success) {
      return res.data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function showAuth() {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

function showApp(user) {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  userNameSpan.textContent = user.name || user.email || 'User';
}

// On page load: if token exists, try to get user
window.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    showAuth();
    return;
  }

  const user = await fetchCurrentUser();
  if (user) {
    showApp(user);
  } else {
    clearToken();
    showAuth();
  }

  // optional: set some default coords
  originLatInput.value = 36.8065;
  originLngInput.value = 10.1815;
  destLatInput.value = 36.819;
  destLngInput.value = 10.1658;
});

// Login
loginBtn.addEventListener('click', async () => {
  loginError.textContent = '';
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;

  if (!email || !password) {
    loginError.textContent = 'Please enter email and password';
    return;
  }

  try {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!res.success) {
      loginError.textContent = res.error || 'Login failed';
      return;
    }

    setToken(res.data.token);
    const user = res.data.user;
    showApp(user);
  } catch (e) {
    loginError.textContent = e.message;
  }
});

// Signup
signupBtn.addEventListener('click', async () => {
  signupError.textContent = '';
  const name = signupNameInput.value.trim();
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;

  if (!name || !email || !password) {
    signupError.textContent = 'Fill all fields';
    return;
  }

  try {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.success) {
      signupError.textContent = res.error || 'Signup failed';
      return;
    }

    setToken(res.data.token);
    const user = res.data.user;
    showApp(user);
  } catch (e) {
    signupError.textContent = e.message;
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  clearToken();
  showAuth();
});

// ====== Route handling ======
routeBtn.addEventListener('click', async () => {
  routeError.textContent = '';
  routeSummary.classList.add('hidden');
  routeSummary.innerHTML = '';
  hazardsList.innerHTML = '';

  const originLat = parseFloat(originLatInput.value);
  const originLng = parseFloat(originLngInput.value);
  const destLat = parseFloat(destLatInput.value);
  const destLng = parseFloat(destLngInput.value);
  const mode = modeSelect.value;

  if (
    isNaN(originLat) ||
    isNaN(originLng) ||
    isNaN(destLat) ||
    isNaN(destLng)
  ) {
    routeError.textContent = 'Please enter valid coordinates';
    return;
  }

  try {
      const res = await apiRequest('/api/route', {
        method: 'POST',
        body: JSON.stringify({
          origin: { lat: originLat, lng: originLng },
          destination: { lat: destLat, lng: destLng },
          mode,
          options: { avoidHazards: true },
        }),
      });

      console.log('RAW /api/route RESPONSE:', res);

      if (!res.success) {
        routeError.textContent = res.error || 'Route error';
        return;
      }

      const route = res.data.route;
      const hazards = res.data.hazards?.hazards || [];

      console.log('ROUTE FROM API:', route);
      console.log('HAZARDS FROM API:', hazards);

    // show summary
    routeSummary.classList.remove('hidden');
    routeSummary.innerHTML = `
      <div><strong>Mode:</strong> ${route.mode}</div>
      <div><strong>Distance:</strong> ${(route.distance / 1000).toFixed(
        2
      )} km</div>
      <div><strong>Duration:</strong> ${(route.duration / 60).toFixed(
        1
      )} min</div>
      <div><strong>Hazards:</strong> ${hazards.length}</div>
    `;

    // show hazards list
    hazards.forEach((h) => {
      const div = document.createElement('div');
      div.className = 'hazard-item';
      div.innerHTML = `
        <div><strong>${h.type}</strong> (${h.severity})</div>
        <div>Confirmations: ${h.confirmation_count || 0}</div>
        <div>Lat: ${h.lat?.toFixed?.(5) ?? ''}, Lng: ${
        h.lng?.toFixed?.(5) ?? ''
      }</div>
      `;
      hazardsList.appendChild(div);
    });

    // later: draw route.geometry.coordinates on a real map
  } catch (e) {
    routeError.textContent = e.message;
  }
});
