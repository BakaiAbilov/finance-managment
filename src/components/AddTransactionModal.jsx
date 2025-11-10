// AddTransactionModal.jsx
import { useEffect, useState } from "react";
import api from "../api";

export default function AddTransactionModal({ onClose, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({
    type: "EXPENSE",
    category: "",
    amount: "",
    description: "",
    card_uid: ""
  });

  useEffect(() => {
    // загрузим шаблоны
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

  async function save(e) {
    e.preventDefault();
    const amount = Number(String(form.amount).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return alert("Сумма > 0");

    await api.post("/transactions", form);
    onCreated?.();
    onClose?.();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Добавить транзакцию</h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        {/* 🔹 Панель шаблонов */}
        {templates.length > 0 && (
          <div className="mb-4 border p-2 rounded-lg bg-gray-50">
            <div className="text-sm text-gray-600 mb-1">Шаблоны:</div>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => useTemplate(t)}
                  className="px-3 py-1 rounded-full bg-indigo-100 text-sm hover:bg-indigo-200"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 🔹 Основная форма */}
        <form onSubmit={save} className="space-y-3">
          <select className="border rounded-xl p-2 w-full"
            value={form.type}
            onChange={e => setForm(s => ({ ...s, type: e.target.value }))}>
            <option value="EXPENSE">Расход</option>
            <option value="INCOME">Доход</option>
          </select>

          <input className="border rounded-xl p-2 w-full"
            placeholder="Категория"
            value={form.category}
            onChange={e => setForm(s => ({ ...s, category: e.target.value }))} />

          <input className="border rounded-xl p-2 w-full"
            placeholder="Сумма"
            value={form.amount}
            onChange={e => setForm(s => ({ ...s, amount: e.target.value }))} />

          <input className="border rounded-xl p-2 w-full"
            placeholder="Описание (необязательно)"
            value={form.description}
            onChange={e => setForm(s => ({ ...s, description: e.target.value }))} />

          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl">
            Добавить
          </button>
        </form>
      </div>
    </div>
  );
}
