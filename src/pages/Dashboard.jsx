import { useContext } from 'react';
import { AuthContext } from '../AuthContext';

export default function Dashboard() {
  const { user } = useContext(AuthContext);

  const kpis = [
    { label: 'Расходы (месяц)', value: '45 200 Сом' },
    { label: 'Доходы (месяц)', value: '120 000 Сом' },
    { label: 'Экономия', value: '74 800 сом' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Здравствуйте, {user?.name} 👋</h1>

      <div className="grid md:grid-cols-3 gap-4">
        {kpis.map((k)=>(
          <div key={k.label} className="bg-white rounded-2xl border p-4">
            <div className="text-sm text-gray-500">{k.label}</div>
            <div className="text-2xl font-semibold mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-4 lg:col-span-2">
          <div className="font-semibold mb-2">Последние транзакции</div>
          <ul className="divide-y">
            {['Кафе -1 200 сом','Зарплата +120 000 сом','Такси -900 сом'].map((t,i)=>(
              <li key={i} className="py-2 text-sm">{t}</li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <div className="font-semibold mb-2">Бюджеты (месяц)</div>
          <div className="text-sm text-gray-600">Кафе: 1200 / 1000 Cом (120%)</div>
          <div className="w-full h-2 bg-gray-100 rounded mt-2">
            <div className="h-2 bg-indigo-600 rounded" style={{width:'120%'}} />
          </div>
        </div>
      </div>
    </div>
  );
}
