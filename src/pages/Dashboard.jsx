// src/pages/Dashboard.jsx
import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../AuthContext";
import api from "../api";

/* ===== helpers ===== */
function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}
function fmtMoney(n, currency = "сом") {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "0 " + currency;
  return new Intl.NumberFormat("ru-RU").format(Number(n)) + " " + currency;
}
function signAmount(type, amount) {
  if (typeof amount !== "number") amount = Number(amount);
  return type === "EXPENSE" ? -Math.abs(amount) : Math.abs(amount);
}

/* ===== Goals (как было) ===== */
function GoalsWidget() {
  const [goals, setGoals] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data } = await api.get("/goals");
        if (alive) setGoals(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setErr(e.response?.data?.message || e.message || "Ошибка");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Загрузка…</div>;
  if (err) return <div className="text-sm text-red-600">Ошибка: {err}</div>;
  if (!goals.length) return <div className="text-sm text-gray-500">Целей пока нет.</div>;

  return (
    <ul className="space-y-3">
      {goals.slice(0, 3).map((g) => {
        const target = Number(g.target_amount ?? g.amount ?? 0);
        const saved = Number(g.saved_amount ?? g.saved ?? 0);
        const pct = target > 0 ? Math.min(100, Math.round((saved * 100) / target)) : 0;
        return (
          <li key={g.id} className="p-3 border rounded-xl">
            <div className="flex items-center justify-between text-sm">
              <div className="font-medium truncate">{g.title || g.name || "Цель"}</div>
              <div className="text-gray-500">
                {saved.toLocaleString("ru-RU")} / {target.toLocaleString("ru-RU")} сом
              </div>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded mt-2">
              <div className="h-2 bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">{pct}%</div>
          </li>
        );
      })}
    </ul>
  );
}

/* ===== Budgets (НОВОЕ) ===== */
function BudgetsWidget({ txAll }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) забираем бюджеты из БД
        const { data } = await api.get("/budgets"); // ожидает [{id, category, limit, ...}]
        const budgets = Array.isArray(data) ? data : (data?.items || []);

        // 2) считаем траты этого месяца по категориям
        const from = startOfMonth();
        const to = endOfMonth();

        const spentByCat = {};
        (txAll || [])
          .filter(t => {
            const dt = new Date(t.occurred_at);
            return t.type === "EXPENSE" && dt >= from && dt <= to;
          })
          .forEach(t => {
            const cat = (t.category || "").trim();
            const amt = Math.abs(Number(t.amount) || 0);
            spentByCat[cat] = (spentByCat[cat] || 0) + amt;
          });

        // 3) собираем элементы
        const mapped = budgets.map(b => {
          const cat = (b.category || "").trim();
          const rawLimit = b.limit ?? b.limit_amount ?? b.amount ?? 0;
          const limit = Number(String(rawLimit).replace(',', '.')) || 0;
          const spent = spentByCat[cat] || 0;
          return { id: b.id, category: cat || "Без категории", limit, spent };
        });

        if (alive) setItems(mapped);
      } catch (e) {
        if (alive) setErr(e.response?.data?.message || e.message || "Ошибка");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [txAll]);

  const totalLimit = items.reduce((s, it) => s + (it.limit || 0), 0);
  const totalSpent = items.reduce((s, it) => s + (it.spent || 0), 0);

  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className="font-semibold mb-3">Бюджеты (месяц)</div>

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка…</div>
      ) : err ? (
        <div className="text-sm text-red-600">Ошибка: {err}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500">Бюджеты не заданы.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border rounded-xl p-3">
              <div className="text-xs text-gray-500">Всего лимит</div>
              <div className="text-lg font-semibold">{fmtMoney(totalLimit)}</div>
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-xs text-gray-500">Потрачено (месяц)</div>
              <div className="text-lg font-semibold">{fmtMoney(totalSpent)}</div>
            </div>
          </div>

          <div className="space-y-3">
            {items.map(it => {
              const pct = it.limit > 0 ? Math.min(100, Math.round((it.spent / it.limit) * 100)) : 0;
              const over = it.limit > 0 && it.spent > it.limit;
              return (
                <div key={it.id} className="p-3 border rounded-xl">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">{it.category}</div>
                    <div className={over ? "text-red-600" : "text-gray-700"}>
                      {fmtMoney(it.spent)} / {fmtMoney(it.limit)} ({it.limit > 0 ? pct : 0}%)
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded mt-2 overflow-hidden">
                    <div
                      className={`h-2 rounded ${over ? "bg-red-500" : "bg-indigo-600"}`}
                      style={{ width: `${it.limit > 0 ? pct : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


/* ===== Dashboard ===== */
export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [tx, setTx] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
  (async () => {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: txData }, { data: budData }] = await Promise.all([
        api.get("/transactions", { params: { limit: 500 } }),
        api.get("/budgets"),                       // тянем бюджеты из БД
      ]);
      setTx(Array.isArray(txData) ? txData : []);
      setBudgets(Array.isArray(budData) ? budData : []);
    } catch (e) {
      console.error("load failed", e);
      setErr(e.response?.data?.message || e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
    })();
  }, []);

  // агрегаты за текущий месяц
  const {
  monthIncome,
  monthExpense,
  monthTx,
  spentByCat,
  totalLimit,
  totalSpent,
} = useMemo(() => {
  const from = startOfMonth();
  const to = endOfMonth();

  let income = 0;
  let expense = 0;

  const inMonth = tx.filter(t => {
    const dt = new Date(t.occurred_at);
    return dt >= from && dt <= to;
  });

  // траты по категориям за месяц
  const spentByCat = {};
  for (const t of inMonth) {
    const val = signAmount(t.type, Number(t.amount));
    if (val >= 0) {
      income += val;
    } else {
      const cat = (t.category || "Без категории").trim();
      spentByCat[cat] = (spentByCat[cat] || 0) + Math.abs(val);
      expense += Math.abs(val);
    }
  }

  // суммарный лимит из БД
  const totalLimit = budgets.reduce((s, b) => s + Number(b.limit || 0), 0);
  // суммарно потрачено (по всем категориям)
  const totalSpent = Object.values(spentByCat).reduce((s, v) => s + v, 0);

  return {
    monthIncome: income,
    monthExpense: expense,
    monthTx: inMonth
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at) || b.id - a.id)
      .slice(0, 10),
    spentByCat,
    totalLimit,
    totalSpent,
  };
}, [tx, budgets]);


  const saving = useMemo(
    () => Math.max(0, monthIncome - monthExpense),
    [monthIncome, monthExpense]
  );

  return (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold">Здравствуйте, {user?.name} 👋</h1>

    {/* KPI */}
    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl border p-4">
        <div className="text-sm text-gray-500">Расходы (месяц)</div>
        <div className="text-2xl font-semibold mt-1 text-red-600">
          {loading ? "…" : fmtMoney(monthExpense)}
        </div>
      </div>
      <div className="bg-white rounded-2xl border p-4">
        <div className="text-sm text-gray-500">Доходы (месяц)</div>
        <div className="text-2xl font-semibold mt-1 text-green-700">
          {loading ? "…" : fmtMoney(monthIncome)}
        </div>
      </div>
      <div className="bg-white rounded-2xl border p-4">
        <div className="text-sm text-gray-500">Остаток</div>
        <div className="text-2xl font-semibold mt-1">
          {loading ? "…" : fmtMoney(saving)}
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-4">
      {/* Последние транзакции */}
      <div className="bg-white rounded-2xl border p-4 lg:col-span-2">
        <div className="font-semibold mb-2">Последние транзакции</div>

        {loading ? (
          <div className="text-sm text-gray-500">Загрузка…</div>
        ) : err ? (
          <div className="text-sm text-red-600">Ошибка: {err}</div>
        ) : monthTx.length === 0 ? (
          <div className="text-sm text-gray-500">В этом месяце пока нет операций.</div>
        ) : (
          <ul className="divide-y">
            {monthTx.map((t) => {
              const val = signAmount(t.type, Number(t.amount));
              const sign = val < 0 ? "-" : "+";
              const color = val < 0 ? "text-red-600" : "text-green-700";
              return (
                <li key={t.id} className="py-2 text-sm flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {t.category || (t.type === "INCOME" ? "Доход" : "Расход")}
                    </div>
                    <div className="text-gray-500 truncate">
                      {t.description || "—"} · {new Date(t.occurred_at).toLocaleString()}
                    </div>
                  </div>
                  <div className={`shrink-0 font-semibold ${color}`}>
                    {sign}{fmtMoney(Math.abs(val))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Правая колонка: Бюджеты + Цели */}
      <div className="space-y-4">
        <BudgetsWidget txAll={tx} />
        <div className="bg-white rounded-2xl border p-4">
          <div className="font-semibold mb-2">Цели</div>
          <GoalsWidget />
        </div>
      </div>
    </div>
  </div>
  );

}
