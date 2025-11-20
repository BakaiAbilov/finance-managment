//src/pages/Transactions.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

const CATEGORIES = {
  EXPENSE: ["Супермаркет", "Кафе", "Такси", "Связь", "Транспорт", "Аренда", "Перевод"],
  INCOME:  ["Зарплата", "Подработка", "Подарок", "Проценты"],
};

export default function Transactions() {
  const [cards, setCards] = useState([]);
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState({
    type: "",
    category: "",
    from: "",
    to: ""
  });

  const [form, setForm] = useState({
    type: "EXPENSE",
    amount: "",
    category: "",
    description: "",
    occurred_at: "",        // для ручного режима
    manualDate: false,      // чекбокс "указать дату вручную"
    card_uid: "",
  });

  const categoriesForType = useMemo(
    () => (form.type === "INCOME" ? CATEGORIES.INCOME : CATEGORIES.EXPENSE),
    [form.type]
  );

  const selectedCard = useMemo(
    () => cards.find(c => c.card_uid === form.card_uid) || null,
    [cards, form.card_uid]
  );

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  async function loadCardsAndTx() {
  setLoading(true);
  setError(null);

  try {
    const [cardsRes, txRes] = await Promise.all([
      api.get("/cards"),
      api.get("/transactions", {
        params: {
          limit,
          type: filters.type || undefined,
          category: filters.category || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        }
      })
    ]);

    setCards(cardsRes.data || []);
    setTx(txRes.data || []);
  } catch (e) {
    console.error(e);
    setError(e.response?.data?.message || "Ошибка загрузки");
  } finally {
    setLoading(false);
  }
  }


  useEffect(() => {
    loadCardsAndTx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  async function addTransaction(e) {
    e.preventDefault();
    if (!form.amount) { alert("Введите сумму"); return; }
    const amountNum = Number(String(form.amount).replace(",", "."));
    if (!Number.isFinite(amountNum) || amountNum <= 0) { alert("Сумма должна быть > 0"); return; }

    // мягкая клиентская проверка «недостаточно средств»
    if (form.type === "EXPENSE" && selectedCard && amountNum > Number(selectedCard.balance || 0)) {
      alert(`Недостаточно средств на карте ${selectedCard.nickname || selectedCard.mask}`);
      return;
    }

    setSaving(true);
    try {
      await api.post("/transactions", {
        card_uid: form.card_uid || null,
        amount: amountNum,
        type: form.type,
        category: form.category || null,
        description: form.description || null,
        occurred_at:
          form.manualDate && form.occurred_at
            ? form.occurred_at
            : null,
      });


      await loadCardsAndTx();

      setForm((s) => ({
        ...s,
        amount: "",
        category: "",
        description: "",
        occurred_at: "",
        manualDate: false,
      }));
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || "Не удалось добавить транзакцию");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTx(id) {
    if (!confirm("Удалить транзакцию?")) return;
    try {
      await api.delete(`/transactions/${id}`);
      await loadCardsAndTx();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || "Не удалось удалить");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Транзакции</h1>

      {/* Форма добавления */}
      <form onSubmit={addTransaction} className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-white rounded-2xl p-4 shadow">
        <select name="type" value={form.type} onChange={onChange} className="border rounded-xl p-2 md:col-span-1">
          <option value="EXPENSE">Расход</option>
          <option value="INCOME">Доход</option>
        </select>

        <input
          name="amount"
          value={form.amount}
          onChange={(e) => setForm(s => ({ ...s, amount: e.target.value.replace(/[^\d.,]/g,"") }))}
          placeholder="Сумма"
          required
          className="border rounded-xl p-2 md:col-span-1"
        />

        <select
          name="category"
          value={form.category}
          onChange={onChange}
          className="border rounded-xl p-2 md:col-span-1"
        >
          <option value="">Категория</option>
          {categoriesForType.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <input
          name="description"
          value={form.description}
          onChange={onChange}
          placeholder="Описание (необязательно)"
          className="border rounded-xl p-2 md:col-span-2"
        />

        {/* чекбокс и опциональная дата */}
        <label className="flex items-center gap-2 md:col-span-1">
          <input
            type="checkbox"
            checked={form.manualDate}
            onChange={(e)=>setForm(s=>({
              ...s,
              manualDate: e.target.checked,
              occurred_at: e.target.checked ? new Date().toISOString().slice(0,16) : ""
            }))}
          />
          Указать дату вручную
        </label>

        {form.manualDate && (
          <input
            type="datetime-local"
            name="occurred_at"
            value={form.occurred_at}
            onChange={(e)=>setForm(s=>({...s, occurred_at: e.target.value}))}
            className="border rounded-xl p-2 md:col-span-2"
          />
        )}

        <select
          name="card_uid"
          value={form.card_uid}
          onChange={onChange}
          className="border rounded-xl p-2 md:col-span-2"
        >
          <option value="">Без карты (наличка/кошелёк)</option>
          {cards.map((c) => (
            <option key={c.card_uid} value={c.card_uid}>
              {c.nickname || "Карта"} — {c.mask} ({c.currency}) {typeof c.balance !== 'undefined' ? `— баланс: ${Number(c.balance).toFixed(2)}` : ''}
            </option>
          ))}
        </select>

        <div className="md:col-span-6">
          <button disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Сохраняем…" : "Добавить транзакцию"}
          </button>
          <p className="text-xs text-gray-500 mt-1">
            Доход/расход определяется полем “Тип”. Сумму вводи без знака.
          </p>
        </div>
      </form>

      {/* Панель управления списком */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Показывать:</label>
        <select value={limit} onChange={(e)=>setLimit(Number(e.target.value))} className="border rounded-xl p-2">
          {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {/* Фильтры по истории */}
      <div className="flex gap-3 flex-wrap mt-2">
        <select
          className="border p-2 rounded-xl"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">Тип: все</option>
          <option value="INCOME">Доход</option>
          <option value="EXPENSE">Расход</option>
        </select>

        <select
          className="border p-2 rounded-xl"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        >
          <option value="">Категория: все</option>
          {CATEGORIES.EXPENSE.concat(CATEGORIES.INCOME).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="border p-2 rounded-xl"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />

        <input
          type="date"
          className="border p-2 rounded-xl"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />

        <button
          type="button"
          onClick={loadCardsAndTx}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl"
        >
          Применить
        </button>
      </div>


      {/* Список транзакций */}
      <div className="bg-white rounded-2xl shadow divide-y">
        {loading ? (
          <div className="p-4">Загрузка…</div>
        ) : error ? (
          <div className="p-4 text-red-600">Ошибка: {error}</div>
        ) : tx.length === 0 ? (
          <div className="p-4 text-gray-500">Операций пока нет.</div>
        ) : (
          tx.map((t) => (
            <div key={t.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">
                  {t.category || (t.type === "INCOME" ? "Доход" : "Расход")}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {t.description || "—"} · {new Date(t.occurred_at).toLocaleString()}
                  {t.mask ? ` · ${t.mask}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className={`font-semibold ${Number(t.amount) < 0 || t.type === "EXPENSE" ? "text-red-600" : "text-green-600"}`}>
                  {t.type === "EXPENSE" ? "-" : "+"}{Math.abs(Number(t.amount)).toFixed(2)}
                </div>
                <button
                  onClick={()=>deleteTx(t.id)}
                  className="text-red-600 hover:text-red-700 text-sm"
                  title="Удалить"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
