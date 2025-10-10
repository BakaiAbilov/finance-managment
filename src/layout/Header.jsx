import { useContext, useState } from 'react';
import { AuthContext } from '../AuthContext';
import { Bell, Plus, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  const [openNotif, setOpenNotif] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  const notifications = [
    { id: 1, text: "Вы превысили лимит по «Кафе»" },
    { id: 2, text: "Цель «Новый ноутбук» выполнена на 50%" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold">F</div>
          <span className="font-semibold text-lg">FinHelper</span>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 active:scale-95">
            <Plus size={18}/> Добавить
          </button>

          <div className="relative">
            <button onClick={() => setOpenNotif(v=>!v)} className="p-2 rounded-xl hover:bg-gray-100">
              <Bell size={22}/>
            </button>
            {openNotif && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border p-2">
                <div className="px-2 py-1 text-sm text-gray-500">Уведомления</div>
                <ul className="max-h-64 overflow-auto">
                  {notifications.map(n => (
                    <li key={n.id} className="px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                      {n.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setOpenUser(v=>!v)} className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-gray-100">
              <img
                src={`https://ui-avatars.com/api/?name=${user?.name}&background=6366F1&color=fff&size=64`}
                alt="avatar"
                className="w-8 h-8 rounded-full"
              />
              <span className="font-medium hidden sm:block">{user?.name}</span>
              <ChevronDown size={16}/>
            </button>
            {openUser && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border p-1">
                <Link to="/profile" className="block px-3 py-2 rounded-lg hover:bg-gray-50 text-sm">Настройки</Link>
                <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm">Выйти</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
