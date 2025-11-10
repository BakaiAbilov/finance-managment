import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from './api';
import { AuthContext } from './AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { loginWithToken } = useContext(AuthContext);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', form); // -> /api/auth/login
      loginWithToken(data.token);                            // сохраняем токен в контекст/LS
      navigate('/');                                         // редирект
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Ошибка авторизации');
    }
  };

  return (
    <form onSubmit={submit} className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-6">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Вход в аккаунт</h2>

        <div className="space-y-5">
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Введите email"
            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Введите пароль"
            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all duration-200">
            Войти
          </button>
        </div>

        <p className="text-center text-gray-600 mt-6 text-sm">
          Нет аккаунта? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Зарегистрироваться</Link>
        </p>
      </div>
    </form>
  );
}
