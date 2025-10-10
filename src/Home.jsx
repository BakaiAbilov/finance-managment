import { useContext } from "react";
import { AuthContext } from "./AuthContext";

export default function Home() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-6">
  <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 text-center">
    <h1 className="text-3xl font-bold text-gray-800 mb-2">
      Добро пожаловать, <span className="text-indigo-600">{user?.name}</span>!
    </h1>

    <p className="text-gray-600 mb-8 text-sm">
      Email: <span className="font-semibold">{user?.email}</span>
    </p>

    <div className="flex justify-center mb-8">
      <img
        src={`https://ui-avatars.com/api/?name=${user?.name}&background=6366F1&color=fff&size=100`}
        alt="Аватар пользователя"
        className="rounded-full shadow-md border-4 border-indigo-500"
      />
    </div>

    <button
      onClick={logout}
      className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all duration-200"
    >
      Выйти
    </button>
  </div>
</div>
  );
}
