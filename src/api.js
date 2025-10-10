import axios from 'axios';
const api = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// добавляем токен из localStorage в заголовки
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});


api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
     }
    }
    return Promise.reject(err);
  }
);
export default api;
