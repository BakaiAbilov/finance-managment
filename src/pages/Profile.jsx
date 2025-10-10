import { useContext } from 'react';
import { AuthContext } from '../AuthContext';

export default function Profile() {
  const { user } = useContext(AuthContext);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Личный кабинет</h1>

      <div className="bg-white rounded-2xl border p-6 grid md:grid-cols-[200px_1fr] gap-6">
        <img
          src={`https://ui-avatars.com/api/?name=${user?.name}&background=6366F1&color=fff&size=256`}
          className="w-40 h-40 rounded-2xl object-cover"
        />
        <div className="space-y-3">
          <div>
            <div className="text-sm text-gray-500">Имя</div>
            <div className="font-medium">{user?.name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Email</div>
            <div className="font-medium">{user?.email}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Дата регистрации</div>
            <div className="font-medium">{new Date(user?.created_at).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
