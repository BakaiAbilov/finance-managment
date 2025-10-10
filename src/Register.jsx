import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from './api';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', form);
      alert('Registered — go to login');
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
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
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Введите имя"
        className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
      />

      <input
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="Введите email"
        className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
      />

      <input
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder="Введите пароль"
        className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
      />

      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all duration-200"
      >
        Зарегистрироваться
      </button>
    </div>

    <p className="text-center text-gray-600 mt-6 text-sm">
+      Уже есть аккаунт?{' '}
+      <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Войти</Link>
+    </p>
  </div>
</form>
  );
}
