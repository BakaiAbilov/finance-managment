// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Register from "./Register";
import Login from "./Login";
import ProtectedRoute from "./ProtectedRoute";
import { AuthProvider } from "./AuthContext";

import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Публичные страницы */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* Приватные страницы под общим лейаутом */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Главная (Дашборд) */}
            <Route index element={<Dashboard />} />
            {/* Личный кабинет / Настройки */}
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Редирект на главную для неизвестных путей */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
