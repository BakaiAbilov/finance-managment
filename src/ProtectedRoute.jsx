import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const { user } = useContext(AuthContext);
  const token = localStorage.getItem('token');

  if (!user && !token) return <Navigate to="/login" replace />;
  // можно показать прелоадер, пока user ещё подтягивается по токену
  if (!user && token) return <div className="p-6">Загрузка…</div>;

  return children;
}
