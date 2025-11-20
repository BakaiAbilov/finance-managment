// src/components/AddTransactionModal.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";   // ⬅ добавили
import api from "../api";

export default function AddTransactionModal({ onClose, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    type: "EXPENSE",
    category: "",
    amount: "",
    description: "",
    card_uid: ""
  });

  const navigate = useNavigate();                // ⬅ хук навигации

  useEffect(() => {
    api.get("/tx-templates")
      .then(res => setTemplates(res.data || []))
      .catch(() => setTemplates([]));
  }, []);

  function useTemplate(t) {
    setForm({
      type: t.type,
      category: t.category || "",
      amount: t.amount,
      description: t.description || "",
      card_uid: t.card_uid || ""
    });
  }

  // переход к странице шаблонов
  function goToTemplates() {
    onClose?.();           // аккуратно закрываем модалку
    navigate("/templates");
  }

  async function save(e) {
  e.preventDefault();
  setErrorMessage(""); // очистка старой ошибки

  const amount = Number(String(form.amount).replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) {
    setErrorMessage("Введите корректную сумму");
    return;
  }

  try {
    await api.post("/transactions", form);
    onCreated?.();
    onClose?.();
  } catch (err) {
    const msg = err.response?.data?.message || "Ошибка. Попробуйте позже.";
    setErrorMessage(msg);  // ⬅ показываем сообщение в интерфейсе
  }
  }


  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Добавить транзакцию</h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        {/* 🔹 Панель шаблонов + кнопка "Добавить шаблон" */}
        <div className="mb-4 border p-3 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Шаблоны:</div>
            <button
              type="button"
              onClick={goToTemplates}
              className="text-xs text-indigo-600 hover:underline"
            >
              Добавить шаблон
            </button>
          </div>

          {templates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => useTemplate(t)}
                  type="button"
                  className="px-3 py-1 rounded-full bg-indigo-100 text-sm hover:bg-indigo-200"
                >
                  {t.title}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              Пока нет шаблонов — создайте первый.
            </div>
          )}
        </div>

        {/* 🔹 Основная форма */}
        <form onSubmit={save} className="space-y-3">
          <select
            className="border rounded-xl p-2 w-full"
            value={form.type}
            onChange={e => setForm(s => ({ ...s, type: e.target.value }))}
          >
            <option value="EXPENSE">Расход</option>
            <option value="INCOME">Доход</option>
          </select>

          <input
            className="border rounded-xl p-2 w-full"
            placeholder="Категория"
            value={form.category}
            onChange={e => setForm(s => ({ ...s, category: e.target.value }))}
          />

          <input
            className="border rounded-xl p-2 w-full"
            placeholder="Сумма"
            value={form.amount}
            onChange={e => setForm(s => ({ ...s, amount: e.target.value }))}
          />

          <input
            className="border rounded-xl p-2 w-full"
            placeholder="Описание (необязательно)"
            value={form.description}
            onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
          />
          {errorMessage && (
            <div className="text-red-600 text-sm text-center">{errorMessage}</div>
          )}

          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl">
            Добавить
          </button>
        </form>
      </div>
    </div>
  );
}
