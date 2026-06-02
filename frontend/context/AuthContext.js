'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem('token');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setLoading(false);
    toast.success('Logged in successfully');
    return data;
  };

  const loginWithGoogle = async (idToken) => {
    const data = await api.post('/auth/google', { token: idToken });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setLoading(false);
    toast.success('Logged in with Google successfully');
    return data;
  };

  const register = async (username, email, password) => {
    const data = await api.post('/auth/register', { username, email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setLoading(false);
    toast.success('Account created successfully');
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.success('Logged out');
  };

  const updateProfile = async (updates) => {
    const data = await api.put('/auth/profile', updates);
    setUser(data.user);
    toast.success('Profile updated');
    return data;
  };

  const completeOnboarding = async (currentPhase) => {
    const data = await api.patch('/users/me/onboarding', { currentPhase });
    if (data.user) {
      setUser(data.user);
    } else {
      // Fallback: fetch user profile again
      const meData = await api.get('/auth/me');
      setUser(meData.user);
    }
    toast.success('Onboarding completed');
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, updateProfile, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
