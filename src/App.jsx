// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import Transactions from "./pages/Transactions";
import CardsAccounts from "./pages/CardAccounts";
import Register from "./Register";
import Login from "./Login";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Templates from "./pages/Templates";
import Reports from "./pages/Reports";


export default function App() {
  return (
    <Routes>
      {/* Публичные */}
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />

      {/* Приватные под общим лейаутом */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="accounts" element={<CardsAccounts />} /> 
        <Route path="transactions" element={<Transactions />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="goals" element={<Goals />} />
        <Route path="templates" element={<Templates />} />
        <Route path="reports" element={<Reports />} />
      </Route>

      {/* Фолбэк */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
