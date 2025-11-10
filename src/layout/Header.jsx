// src/layout/Header.jsx
import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../AuthContext";
import { Bell, Plus } from "lucide-react";
import api from "../api";
import { alertsBus } from "../alertsBus";
import AddTransactionModal from "../components/AddTransactionModal";

export default function Header() {
  const { user, logout } = useContext(AuthContext);

  // Модалка «Добавить»
  const [showAddModal, setShowAddModal] = useState(false);

  // Реальные алерты (бюджеты/баланс)
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertErr, setAlertErr] = useState(null);

  async function fetchAlerts() {
    try {
      setLoadingAlerts(true);
      setAlertErr(null);
      const { data } = await api.get("/alerts");
      setAlerts(data?.alerts || []);
      setAlertCount(Number(data?.count || 0));
    } catch (e) {
      setAlertErr(e.response?.data?.message || e.message || "Ошибка");
    } finally {
      setLoadingAlerts(false);
    }
  }

  // Первичная загрузка + автообновление
  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30000);
    return () => clearInterval(id);
  }, []);

  // Подписка на «событие обнови алерты» (после добавления/удаления)
  useEffect(() => alertsBus.subscribe(fetchAlerts), []);

  return (
    <header className="sticky top-0 z-40 bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Лого */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold">F</div>
          <span className="font-semibold text-lg">FinHelper</span>
        </div>

        {/* Кнопки справа */}
        <div className="flex items-center gap-3">
          {/* Добавить */}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 active:scale-95"
          >
            <Plus size={18} /> Добавить
          </button>

          {showAddModal && (
            <AddTransactionModal
              onClose={() => setShowAddModal(false)}
              onCreated={() => {
                setShowAddModal(false);
                alertsBus.fire(); // обновим колокольчик
              }}
            />
          )}

          {/* Колокольчик с реальными уведомлениями */}
          <div className="relative">
            <button
              onClick={() => setAlertsOpen(o => !o)}
              className="relative p-2 rounded-xl hover:bg-gray-100"
              title="Оповещения"
            >
              <Bell size={20} />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div className="absolute right-0 mt-2 w-[320px] bg-white border rounded-2xl shadow-lg z-50">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-medium">Оповещения</div>
                  <button
                    onClick={fetchAlerts}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Обновить
                  </button>
                </div>

                <div className="max-h-[320px] overflow-auto">
                  {loadingAlerts ? (
                    <div className="p-3 text-sm text-gray-500">Загрузка…</div>
                  ) : alertErr ? (
                    <div className="p-3 text-sm text-red-600">Ошибка: {alertErr}</div>
                  ) : alerts.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">Нет оповещений</div>
                  ) : (
                    alerts.map((a, i) => (
                      <div key={i} className="p-3 border-b last:border-b-0">
                        <div
                          className={`text-sm font-medium ${
                            a.severity === "critical" ? "text-red-600" : "text-amber-600"
                          }`}
                        >
                          {a.title}
                        </div>
                        <div className="text-xs text-gray-500">{a.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Профиль (если нужен — оставь свою реализацию) */}
          {/* <UserMenu user={user} onLogout={logout} /> */}
        </div>
      </div>
    </header>
  );
}
