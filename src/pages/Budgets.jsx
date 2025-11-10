// src/pages/Budgets.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

const CATEGORIES = [
  "Супермаркет","Кафе","Такси","Связь","Транспорт","Аренда","Перевод",
];

function fmtMoney(n) {
  return new Intl.NumberFormat("ru-RU").format(Number(n || 0)) + " сом";
}

export default function Budgets() {
  const [items, setItems]   = useState([]);
  const [loading, setLoad]  = useState(true);
  const [err, setErr]       = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ category: "", limit_amount: "" });

  async function load() {
    try {
      setLoad(true); setErr(null);
      const { data } = await api.get("/budgets");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.response?.data?.message || e.message || "Ошибка загрузки");
    } finally {
      setLoad(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addBudget(e) {
    e.preventDefault();
    const limit = Number(String(form.limit_amount).replace(",", "."));
    if (!form.category) { alert("Выберите категорию"); return; }
    if (!Number.isFinite(limit) || limit <= 0) { alert("Лимит должен быть > 0"); return; }

    setSaving(true);
    try {
      await api.post("/budgets", { category: form.category, limit_amount: limit });
      setForm({ category: "", limit_amount: "" });
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Не удалось создать бюджет");
    } finally {
      setSaving(false);
    }
  }

  async function updateLimit(id, limit_amount) {
    const limit = Number(String(limit_amount).replace(",", "."));
    if (!Number.isFinite(limit) || limit <= 0) { alert("Лимит должен быть > 0"); return; }
    try {
      await api.patch(`/budgets/${id}`, { limit_amount: limit });
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Не удалось обновить");
    }
  }

  async function removeBudget(id) {
    if (!confirm("Удалить бюджет?")) return;
    try {
      await api.delete(`/budgets/${id}`);
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Не удалось удалить");
    }
  }

  const totalLimit = useMemo(() => items.reduce((s,b)=>s+Number(b.limit_amount||0),0), [items]);
  const totalSpent = useMemo(() => items.reduce((s,b)=>s+Number(b.spent||0),0), [items]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Бюджеты</h1>

      {/* Форма добавления */}
      <form onSubmit={addBudget} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white rounded-2xl p-4 shadow">
        <select
          className="border rounded-xl p-2 md:col-span-2"
          value={form.category}
          onChange={(e)=>setForm(s=>({...s, category: e.target.value}))}
        >
          <option value="">Категория</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          className="border rounded-xl p-2 md:col-span-2"
          placeholder="Лимит (сом)"
          value={form.limit_amount}
          onChange={(e)=>setForm(s=>({...s, limit_amount: e.target.value.replace(/[^\d.,]/g,"")}))}
        />
        <div className="md:col-span-1">
          <button disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Сохраняем…" : "Добавить"}
          </button>
        </div>
        <p className="text-xs text-gray-500 md:col-span-5">Период — текущий месяц. Категория уникальна в рамках месяца.</p>
      </form>

      {/* Сводка */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Всего лимит</div>
          <div className="text-xl font-semibold mt-1">{fmtMoney(totalLimit)}</div>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <div className="text-sm text-gray-500">Потрачено (месяц)</div>
          <div className="text-xl font-semibold mt-1">{fmtMoney(totalSpent)}</div>
        </div>
      </div>

      {/* Список */}
      <div className="bg-white rounded-2xl shadow divide-y">
        {loading ? (
          <div className="p-4">Загрузка…</div>
        ) : err ? (
          <div className="p-4 text-red-600">Ошибка: {err}</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-gray-500">Пока нет бюджетов.</div>
        ) : (
          items.map(b => {
            const spent = Number(b.spent || 0);
            const limit = Number(b.limit_amount || 0);
            const pct = limit > 0 ? Math.round((spent/limit)*100) : 0;
            const over = spent > limit;
            return (
              <div key={b.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{b.category}</div>
                    <div className="text-sm text-gray-500">
                      {fmtMoney(spent)} / {fmtMoney(limit)} ({pct}%)
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      className="border rounded-xl p-1 w-32 text-right"
                      defaultValue={limit}
                      onBlur={(e)=>updateLimit(b.id, e.target.value)}
                      title="Изменить лимит и снять фокус"
                    />
                    <button onClick={()=>removeBudget(b.id)} className="text-red-600 text-sm">Удалить</button>
                  </div>
                </div>
                <div className="mt-2 w-full h-2 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-2 ${over ? "bg-red-500" : "bg-indigo-600"}`}
                    style={{ width: `${Math.min(200, pct)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
