import { createContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Restore session on initial application load via GET /api/auth/me
  // JWT is held exclusively in HttpOnly cookie; state lives in React memory only.
  const checkAuth = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUser(data.data.user);
        } else {
          setUser(null);
        }
      } else {
        // 401 or other non-200 responses mean unauthenticated, which is normal on fresh visit
        setUser(null);
      }
    } catch (err) {
      // Network or offline error
      console.warn('Authentication check failed:', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Student Registration
  const register = async (studentData) => {
    setAuthError(null);
    const payload = {
      ...studentData,
      accountType: 'student' // Enforce student account type
    };

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errorMsg = data.errors && data.errors.length > 0
        ? data.errors.map(e => e.message || e.msg).join(' ')
        : (data.message || 'Registration failed');
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      setAuthError(errorMsg);
      throw err;
    }

    setUser(data.data.user);
    return data.data.user;
  };

  // Student/User Login
  const login = async (email, password) => {
    setAuthError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errorMsg = data.errors && data.errors.length > 0
        ? data.errors.map(e => e.message || e.msg).join(' ')
        : (data.message || 'Authentication failed');
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      setAuthError(errorMsg);
      throw err;
    }

    setUser(data.data.user);
    return data.data.user;
  };

  // Logout
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
    } catch (err) {
      console.warn('Logout network notice:', err.message);
    } finally {
      // Clear React in-memory user state
      setUser(null);
      setAuthError(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        setAuthError,
        login,
        register,
        logout,
        checkAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
export { useAuth } from './useAuth';
