import React, { createContext, useState, useEffect } from 'react';
import api from './api';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext({
  user: null,
  loginWithToken: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // При первом рендере пробуем подтянуть профиль
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      });
  }, []);

  const loginWithToken = async (token) => {
    try {
      localStorage.setItem('token', token);
      const { data } = await api.get('/auth/me');
      setUser(data);
      navigate('/');            // редирект на главную
    } catch {
      localStorage.removeItem('token');
      setUser(null);
      alert('Не удалось получить профиль');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
