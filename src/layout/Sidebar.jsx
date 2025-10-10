import { Link } from 'react-router-dom';
import { Home, List, CreditCard, PieChart, Flag, BarChart3, Settings } from 'lucide-react';

const items = [
  { to: '/', text: 'Главная', icon: Home },
  { to: '/transactions', text: 'Транзакции', icon: List },
  { to: '/accounts', text: 'Кошельки & Счета', icon: CreditCard },
  { to: '/budgets', text: 'Бюджеты', icon: PieChart },
  { to: '/goals', text: 'Цели', icon: Flag },
  { to: '/reports', text: 'Отчеты', icon: BarChart3 },
  { to: '/profile', text: 'Настройки', icon: Settings },
];

export default function Sidebar({ currentPath }) {
  return (
    <aside className="w-64 shrink-0 border-r bg-white min-h-[calc(100vh-57px)]">
      <nav className="p-3 space-y-1">
        {items.map(({to,text,icon:Icon}) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 ${
              currentPath === to ? 'bg-gray-100' : ''
            }`}
          >
            <Icon size={18}/> {text}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
