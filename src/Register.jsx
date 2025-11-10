import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from './api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      alert('Заполните все поля');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      alert('Успешная регистрация');
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-6"
    >
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Регистрация
        </h2>

        <div className="space-y-5">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Введите имя"
            autoComplete="name"
            required
            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />

          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Введите email"
            autoComplete="email"
            required
            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />

          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Введите пароль"
            autoComplete="new-password"
            required
            minLength={6}
            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all duration-200 disabled:opacity-60"
          >
            {loading ? 'Отправка…' : 'Зарегистрироваться'}
          </button>
        </div>

        <p className="text-center text-gray-600 mt-6 text-sm">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </form>
  );
}
