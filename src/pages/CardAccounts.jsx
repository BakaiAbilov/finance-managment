// src/pages/CardsAccounts.jsx
import { useEffect, useState } from "react";
import api from "../api";

export default function CardsAccounts() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  // txMap: { [card_uid]: { items: Tx[], open: boolean, loading: boolean, limit: number, error: string|null } }
  const [txMap, setTxMap] = useState({});
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nickname: "",
    currency: "KGS",
    last4: "",
    expiry_month: "",
    expiry_year: "",
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  async function loadCards() {
    try {
      setLoading(true);
      setErr(null);
      const { data } = await api.get("/cards");
      setCards(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("GET /cards failed:", e);
      setErr(e.response?.data?.message || e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCards();
  }, []);

  async function linkMock(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        nickname: form.nickname || undefined,
        currency: form.currency,
        last4: String(form.last4).replace(/\D/g, '').slice(0, 4),
        expiry_month: form.expiry_month ? Number(form.expiry_month) : null,
        expiry_year: form.expiry_year ? Number(form.expiry_year) : null,
      };
      if (body.last4.length !== 4) {
        alert("Введите последние 4 цифры карты");
        return;
      }
      await api.post("/cards/mock-link", body);
      await loadCards();
      setForm({ nickname: "", currency: "KGS", last4: "", expiry_month: "", expiry_year: "" });
    } catch (e) {
      console.error("POST /cards/mock-link failed:", e);
      alert(e.response?.data?.message || "Не удалось привязать карту");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTx(card_uid) {
    // свернуть
    if (txMap[card_uid]?.open) {
      setTxMap((s) => ({ ...s, [card_uid]: { ...s[card_uid], open: false } }));
      return;
    }
    // раскрыть и загрузить
    setTxMap((s) => ({
      ...s,
      [card_uid]: { items: [], loading: true, open: true, limit: 10, error: null },
    }));
    await fetchTx(card_uid, 10);
  }

  async function fetchTx(card_uid, limit) {
  try {
    setTxMap((s) => ({ ...s, [card_uid]: { ...(s[card_uid] || {}), loading: true, error: null, open: true } }));
    const { data } = await api.get(`/cards/${card_uid}/transactions`, { params: { limit } });
    const items = Array.isArray(data) ? data : [];
    setTxMap((s) => ({
      ...s,
      [card_uid]: { items, loading: false, open: true, limit, error: null },
    }));
  } catch (e) {
    const msg = e?.response?.data?.message || e.message || "Не удалось получить операции";
    setTxMap((s) => ({
      ...s,
      [card_uid]: { ...(s[card_uid] || {}), loading: false, error: msg, open: true },
      }));
    }
  }


  async function loadMore(card_uid) {
    const next = (txMap[card_uid]?.limit || 10) + 10;
    await fetchTx(card_uid, next);
  }

  async function deleteTx(card_uid, txId) {
    if (!confirm("Удалить транзакцию?")) return;
    try {
      await api.delete(`/transactions/${txId}`);
      // Перезагрузим список карт (баланс обновится) и транзакции этой карты
      await Promise.all([loadCards(), fetchTx(card_uid, txMap[card_uid]?.limit || 10)]);
    } catch (e) {
      console.error("DELETE /transactions failed:", e);
      alert(e.response?.data?.message || "Не удалось удалить");
    }
  }

  async function deleteCard(card_uid) {
    if (!confirm("Удалить карту? Если есть операции — будет отказ.")) return;
    try {
      await api.delete(`/cards/${card_uid}`);
      await loadCards();
      setTxMap((s) => {
        const n = { ...s };
        delete n[card_uid];
        return n;
      });
    } catch (e) {
      if (e?.response?.status === 400) {
        const confirmForce = confirm("На карте есть операции. Удалить ВСЕ операции и карту?");
        if (confirmForce) {
          try {
            await api.delete(`/cards/${card_uid}?force=1`);
            await loadCards();
            setTxMap((s) => {
              const n = { ...s };
              delete n[card_uid];
              return n;
            });
          } catch (ee) {
            console.error("DELETE /cards?force failed:", ee);
            alert(ee.response?.data?.message || "Не удалось удалить карту");
          }
        }
      } else {
        console.error("DELETE /cards failed:", e);
        alert(e.response?.data?.message || "Не удалось удалить карту");
      }
    }
  }

  const fmtDateTime = (s) => {
    try { return new Date(s).toLocaleString(); } catch { return s; }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Кошельки & Счета</h1>

      {/* Форма привязки mock-карты */}
      <form onSubmit={linkMock} className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-white rounded-2xl p-4 shadow">
        <input name="nickname" value={form.nickname} onChange={onChange} placeholder="Название (необязательно)" className="border rounded-xl p-2 md:col-span-2" />
        <select name="currency" value={form.currency} onChange={onChange} className="border rounded-xl p-2">
          <option value="KGS">KGS</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <input
          name="last4"
          value={form.last4}
          onChange={(e) => setForm((s) => ({ ...s, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
          placeholder="Последние 4 цифры"
          required
          className="border rounded-xl p-2"
        />
        <input name="expiry_month" value={form.expiry_month} onChange={onChange} placeholder="MM" className="border rounded-xl p-2" />
        <input name="expiry_year" value={form.expiry_year} onChange={onChange} placeholder="YYYY" className="border rounded-xl p-2" />
        <div className="md:col-span-6">
          <button disabled={saving} className="mt-1 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Сохраняем…" : "Привязать mock-карту"}
          </button>
          <p className="text-xs text-gray-500 mt-1">Баланс считается как сумма транзакций по карте. PAN/CVV не храним.</p>
        </div>
      </form>

      {/* Контент */}
      {loading ? (
        <div>Загрузка…</div>
      ) : err ? (
        <div className="text-red-600">Ошибка: {err}</div>
      ) : cards.length === 0 ? (
        <div className="text-gray-500">Пока нет привязанных карт.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {cards.map((c) => {
            const state = txMap[c.card_uid] || { open: false, items: [], loading: false, limit: 10, error: null };
            return (
              <div key={c.card_uid} className="bg-white rounded-2xl p-4 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-medium">{c.nickname || "Mock карта"}</div>
                    <div className="text-sm text-gray-500">{c.mask} · {c.currency}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-base font-semibold ${Number(c.balance) < 0 ? "text-red-600" : "text-green-600"}`}>
                      {Number(c.balance) >= 0 ? "+" : ""}{Number(c.balance ?? 0).toFixed(2)}
                    </div>
                    <div className="flex gap-3 justify-end mt-1">
                      <button onClick={() => toggleTx(c.card_uid)} className="text-xs underline">
                        {state.open ? "Скрыть операции" : "Показать операции"}
                      </button>
                      <button onClick={() => deleteCard(c.card_uid)} className="text-xs text-red-600 underline">
                        Удалить карту
                      </button>
                    </div>
                  </div>
                </div>

                {/* Секция операций по карте */}
                {state.open && (
                  <div className="mt-3">
                    {state.loading && <div className="text-sm text-gray-500">Загрузка операций…</div>}
                    {state.error && <div className="text-sm text-red-600">Ошибка: {state.error}</div>}
                    {!state.loading && !state.error && state.items.length === 0 && (
                      <div className="text-sm text-gray-500">Операций нет.</div>
                    )}

                    {!state.loading && !state.error && state.items.length > 0 && (
                      <>
                        <ul className="divide-y">
                          {state.items.map((t) => (
                            <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium">
                                  {t.category || (t.type === "INCOME" ? "Доход" : "Расход")}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {t.description || "—"} · {fmtDateTime(t.occurred_at)}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className={`text-sm font-semibold ${Number(t.amount) < 0 || t.type === "EXPENSE" ? "text-red-600" : "text-green-600"}`}>
                                  {t.type === "EXPENSE" ? "-" : "+"}{Math.abs(Number(t.amount)).toFixed(2)}
                                </div>
                                <button
                                  onClick={() => deleteTx(c.card_uid, t.id)}
                                  className="text-xs text-red-600 hover:text-red-700"
                                  title="Удалить транзакцию"
                                >
                                  Удалить
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-2">
                          <button onClick={() => loadMore(c.card_uid)} className="text-xs underline">
                            Показать ещё
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
