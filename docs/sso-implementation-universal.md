# Universal SSO Implementation Guide

This guide provides a framework-agnostic approach to implementing the SSO authentication system. It can be adapted to any web framework (React, Vue, Angular, vanilla JavaScript, etc.).

## Overview

The SSO system follows this flow:
```
External System → SSO Token → Your App → API Validation → Session Creation → Protected Routes
```

## Step-by-Step Implementation

### Step 1: Create SSO Endpoint

Create a server-side endpoint to handle SSO tokens. The exact implementation depends on your backend framework:

#### Express.js Example
```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();

router.get('/sso-login', async (req, res) => {
  const { token, nomenu } = req.query;
  
  // Test mode for development
  if (req.query.test) {
    console.log('=== SSO LOGIN TEST MODE HIT ===');
    return res.json({ 
      message: 'SSO login test successful', 
      timestamp: new Date().toISOString() 
    });
  }

  console.log('=== SSO LOGIN ROUTE HIT ===');
  console.log('SSO token received:', token);

  if (!token) {
    console.log('No token provided, redirecting to login');
    return res.redirect('/login');
  }

  try {
    // Call external API to validate token
    const apiUrl = 'https://edms.nimet.gov.ng/api/sadis/checkuser';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataencrypted: token })
    });

    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      return res.redirect('/login');
    }

    const data = await response.json();
    
    if (!data.IsSuccess) {
      console.error('API returned IsSuccess: false, Message:', data.Message);
      return res.redirect('/login');
    }

    // Authentication successful
    console.log('SSO login successful.');
    
    // Create session token
    const sessionToken = `user_${data.UserID}_${Date.now()}_${data.Username}`;
    
    // Set session cookie
    res.cookie('session', sessionToken, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    });
    
    // Redirect to home with optional hideHeader parameter
    let redirectUrl = '/';
    if (nomenu === 'yes') {
      redirectUrl += '?hideHeader=yes';
    }
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('SSO login error:', error);
    res.redirect('/login');
  }
});

module.exports = router;
```

#### PHP Example
```php
<?php
// sso-login.php
session_start();

$token = $_GET['token'] ?? null;
$noMenu = $_GET['nomenu'] ?? null;

// Test mode for development
if (isset($_GET['test'])) {
    echo json_encode([
        'message' => 'SSO login test successful',
        'timestamp' => date('c')
    ]);
    exit;
}

if (!$token) {
    header('Location: /login');
    exit;
}

try {
    // Call external API to validate token
    $apiUrl = 'https://edms.nimet.gov.ng/api/sadis/checkuser';
    $postData = json_encode(['dataencrypted' => $token]);
    
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => $postData
        ]
    ]);
    
    $response = file_get_contents($apiUrl, false, $context);
    
    if ($response === false) {
        throw new Exception('API request failed');
    }
    
    $data = json_decode($response, true);
    
    if (!$data['IsSuccess']) {
        throw new Exception('Authentication failed: ' . $data['Message']);
    }
    
    // Authentication successful
    $sessionToken = "user_{$data['UserID']}_" . time() . "_{$data['Username']}";
    
    // Set session cookie
    setcookie('session', $sessionToken, [
        'expires' => time() + (24 * 60 * 60), // 24 hours
        'path' => '/',
        'secure' => $_SERVER['HTTPS'] ?? false,
        'samesite' => 'Lax',
        'httponly' => false
    ]);
    
    // Redirect to home
    $redirectUrl = '/';
    if ($noMenu === 'yes') {
        $redirectUrl .= '?hideHeader=yes';
    }
    
    header("Location: $redirectUrl");
    exit;
    
} catch (Exception $e) {
    error_log('SSO login error: ' . $e->getMessage());
    header('Location: /login');
    exit;
}
?>
```

#### Python Flask Example
```python
# routes/auth.py
from flask import Blueprint, request, redirect, make_response, jsonify
import requests
import json
import time

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/sso-login')
def sso_login():
    token = request.args.get('token')
    no_menu = request.args.get('nomenu')
    
    # Test mode for development
    if request.args.get('test'):
        return jsonify({
            'message': 'SSO login test successful',
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
        })
    
    if not token:
        return redirect('/login')
    
    try:
        # Call external API to validate token
        api_url = 'https://edms.nimet.gov.ng/api/sadis/checkuser'
        response = requests.post(api_url, json={'dataencrypted': token})
        
        if not response.ok:
            return redirect('/login')
        
        data = response.json()
        
        if not data.get('IsSuccess'):
            return redirect('/login')
        
        # Authentication successful
        session_token = f"user_{data['UserID']}_{int(time.time())}_{data['Username']}"
        
        # Create response with redirect
        redirect_url = '/'
        if no_menu == 'yes':
            redirect_url += '?hideHeader=yes'
        
        resp = make_response(redirect(redirect_url))
        resp.set_cookie('session', session_token, max_age=24*60*60, httponly=False)
        
        return resp
        
    except Exception as e:
        print(f'SSO login error: {e}')
        return redirect('/login')
```

### Step 2: Create Session Management Utilities

Create client-side session management functions:

```javascript
// utils/session.js
class SessionManager {
  // Set session token in localStorage
  setSessionToken(token) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('session', token);
    }
  }

  // Get session token from localStorage
  getSessionToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('session');
    }
    return null;
  }

  // Remove session token
  removeSessionToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('session');
    }
  }

  // Parse session token to extract user info
  parseSessionToken(token) {
    // Format: user_{UserID}_{timestamp}_{username}
    const parts = token.split('_');
    if (parts.length >= 4 && parts[0] === 'user') {
      return {
        userId: parts[1],
        timestamp: parseInt(parts[2]),
        username: parts.slice(3).join('_')
      };
    }
    return null;
  }

  // Check if session is valid (not expired)
  isSessionValid(token) {
    if (!token) return false;
    
    const parsed = this.parseSessionToken(token);
    if (!parsed) return false;
    
    // Check if session is older than 24 hours
    const now = Date.now();
    const sessionAge = now - parsed.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return sessionAge < maxAge;
  }

  // Get user info from session
  getUserInfo() {
    const token = this.getSessionToken();
    if (!token || !this.isSessionValid(token)) {
      return null;
    }
    return this.parseSessionToken(token);
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
```

### Step 3: Create Authentication Service

Create a service to handle authentication API calls:

```javascript
// services/authService.js
class AuthService {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
  }

  // Traditional login with username/password
  async login(credentials) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/checkuser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      });

      if (!response.ok) {
        throw new Error('Authentication server error');
      }

      const data = await response.json();

      if (!data.IsSuccess) {
        throw new Error(data.Message || 'Invalid credentials');
      }

      return {
        success: true,
        message: 'Login successful',
        user: data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'An error occurred during login'
      };
    }
  }

  // Logout (clear session)
  async logout() {
    // Clear client-side session
    sessionManager.removeSessionToken();
    
    // Optionally call server-side logout endpoint
    try {
      await fetch(`${this.apiBaseUrl}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

export const authService = new AuthService(process.env.REACT_APP_API_URL || '');
```

### Step 4: Create Authentication Context/Store

#### React Context Example
```javascript
// contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { sessionManager } from '../utils/session';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for existing session on app load
    const checkSession = () => {
      const token = sessionManager.getSessionToken();
      if (token && sessionManager.isSessionValid(token)) {
        const userInfo = sessionManager.getUserInfo();
        setUser(userInfo);
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  const login = async (credentials) => {
    const result = await authService.login(credentials);
    if (result.success) {
      const sessionToken = `user_${result.user.UserID}_${Date.now()}_${result.user.Username}`;
      sessionManager.setSessionToken(sessionToken);
      setUser(sessionManager.getUserInfo());
      setIsAuthenticated(true);
    }
    return result;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

#### Vue.js Store Example (Pinia)
```javascript
// stores/auth.js
import { defineStore } from 'pinia';
import { sessionManager } from '../utils/session';
import { authService } from '../services/authService';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    isLoading: true,
    user: null
  }),

  actions: {
    async checkSession() {
      const token = sessionManager.getSessionToken();
      if (token && sessionManager.isSessionValid(token)) {
        const userInfo = sessionManager.getUserInfo();
        this.user = userInfo;
        this.isAuthenticated = true;
      }
      this.isLoading = false;
    },

    async login(credentials) {
      const result = await authService.login(credentials);
      if (result.success) {
        const sessionToken = `user_${result.user.UserID}_${Date.now()}_${result.user.Username}`;
        sessionManager.setSessionToken(sessionToken);
        this.user = sessionManager.getUserInfo();
        this.isAuthenticated = true;
      }
      return result;
    },

    async logout() {
      await authService.logout();
      this.user = null;
      this.isAuthenticated = false;
    }
  }
});
```

### Step 5: Create Route Protection

#### React Router Example
```javascript
// components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

#### Vue Router Example
```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue')
    },
    {
      path: '/',
      name: 'Home',
      component: () => import('../views/Home.vue'),
      meta: { requiresAuth: true }
    }
  ]
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else {
    next();
  }
});

export default router;
```

### Step 6: Create Login Component

#### React Example
```javascript
// components/LoginForm.js
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginForm = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(credentials);
    
    if (!result.success) {
      setError(result.message);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Sign In</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={credentials.username}
            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={credentials.password}
            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
            required
            disabled={isLoading}
          />
        </div>
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
```

#### Vue Example
```vue
<!-- components/LoginForm.vue -->
<template>
  <div class="login-container">
    <form @submit.prevent="handleSubmit" class="login-form">
      <h2>Sign In</h2>
      
      <div v-if="error" class="error-message">{{ error }}</div>
      
      <div class="form-group">
        <label for="username">Username</label>
        <input
          type="text"
          id="username"
          v-model="credentials.username"
          required
          :disabled="isLoading"
        />
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input
          type="password"
          id="password"
          v-model="credentials.password"
          required
          :disabled="isLoading"
        />
      </div>
      
      <button type="submit" :disabled="isLoading">
        {{ isLoading ? 'Signing in...' : 'Sign In' }}
      </button>
    </form>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

export default {
  setup() {
    const authStore = useAuthStore();
    const credentials = ref({ username: '', password: '' });
    const isLoading = ref(false);
    const error = ref('');

    const handleSubmit = async () => {
      isLoading.value = true;
      error.value = '';

      const result = await authStore.login(credentials.value);
      
      if (!result.success) {
        error.value = result.message;
      }
      
      isLoading.value = false;
    };

    return {
      credentials,
      isLoading,
      error,
      handleSubmit
    };
  }
};
</script>
```

### Step 7: Handle URL Parameters

Create a utility to handle URL parameters like `hideHeader`:

```javascript
// utils/urlParams.js
class URLParamsManager {
  // Get URL parameter value
  getParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Remove parameter from URL without reload
  removeParam(name) {
    const url = new URL(window.location.href);
    url.searchParams.delete(name);
    window.history.replaceState({}, '', url.pathname + url.search);
  }

  // Handle hideHeader parameter
  handleHideHeader() {
    const hideHeader = this.getParam('hideHeader');
    if (hideHeader === 'yes') {
      // Hide header/navigation
      const header = document.querySelector('header');
      if (header) {
        header.style.display = 'none';
      }
      
      // Clean up URL
      this.removeParam('hideHeader');
    }
  }

  // Handle SSO success parameter
  handleSSOSuccess() {
    const ssoSuccess = this.getParam('sso_success');
    if (ssoSuccess === '1') {
      // Trigger SSO success handling
      window.dispatchEvent(new CustomEvent('ssoSuccess'));
      
      // Clean up URL
      this.removeParam('sso_success');
    }
  }
}

export const urlParamsManager = new URLParamsManager();
```

### Step 8: Initialize Application

#### React App Initialization
```javascript
// App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginForm from './components/LoginForm';
import Home from './components/Home';
import { urlParamsManager } from './utils/urlParams';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Handle URL parameters on app load
    urlParamsManager.handleHideHeader();
    urlParamsManager.handleSSOSuccess();
  }, []);

  if (isLoading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginForm />} 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
```

#### Vue App Initialization
```javascript
// main.js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import { useAuthStore } from './stores/auth';
import { urlParamsManager } from './utils/urlParams';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// Initialize auth store and handle URL parameters
const authStore = useAuthStore();
authStore.checkSession().then(() => {
  urlParamsManager.handleHideHeader();
  urlParamsManager.handleSSOSuccess();
});

app.mount('#app');
```

## Configuration

### Environment Variables

Create environment configuration files:

```bash
# .env
REACT_APP_API_URL=https://your-api-domain.com
NODE_ENV=development
```

### API Endpoint Configuration

Update the API URL in your SSO endpoint and auth service:

```javascript
// Update these URLs to match your authentication service
const apiUrl = 'https://your-api-domain.com/api/checkuser';
```

## Testing

### Test SSO Flow

1. **Test Mode**: Use `?test=1` parameter for development testing
2. **Manual Testing**: Test with actual SSO tokens from your external system
3. **Error Scenarios**: Test with invalid tokens, network errors, etc.

### Test URLs

```
# Test mode
https://yourdomain.com/sso-login?test=1

# With SSO token
https://yourdomain.com/sso-login?token=your_sso_token&nomenu=yes

# With hideHeader parameter
https://yourdomain.com/?hideHeader=yes
```

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **Token Validation**: Validate all tokens against your authentication service
3. **Session Security**: Use secure cookie settings
4. **Error Handling**: Don't expose sensitive information in error messages
5. **CORS**: Configure CORS properly for your API endpoints

## Deployment

### Server Configuration

Ensure your server can handle:
- Cookie setting
- Redirects
- HTTPS
- CORS headers

### Client Configuration

Ensure your client application:
- Can read cookies
- Handles redirects properly
- Manages localStorage correctly

This universal implementation can be adapted to any web framework or technology stack. The key is to maintain the same flow: token validation → session creation → client-side state management → route protection.
