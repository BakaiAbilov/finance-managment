// src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

// категории (как раньше)
const CATEGORIES = {
  EXPENSE: ["Супермаркет", "Кафе", "Такси", "Связь", "Транспорт", "Аренда", "Перевод"],
  INCOME: ["Зарплата", "Подработка", "Подарок", "Проценты"],
};
const ALL_CATEGORIES = [...CATEGORIES.EXPENSE, ...CATEGORIES.INCOME];

// графики
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

// pdfmake
import pdfMake from "pdfmake/build/pdfmake";
import "pdfmake/build/vfs_fonts";



const PIE_COLORS = ["#4f46e5", "#ec4899", "#f97316", "#22c55e", "#06b6d4", "#a855f7", "#facc15"];

export default function Reports() {
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(100);

  const [filters, setFilters] = useState({
    type: "",
    category: "",
    from: "",
    to: "",
  });

  const [period, setPeriod] = useState("MONTH"); // TODAY | 7D | MONTH | ALL | CUSTOM

  // пересчёт from/to при смене периодов
  useEffect(() => {
    const today = new Date();
    let from = "";
    let to = "";

    if (period === "TODAY") {
      const d = today.toISOString().slice(0, 10);
      from = d;
      to = d;
    } else if (period === "7D") {
      const toDate = today.toISOString().slice(0, 10);
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 6);
      from = fromDate.toISOString().slice(0, 10);
      to = toDate;
    } else if (period === "MONTH") {
      const year = today.getFullYear();
      const month = today.getMonth();
      const start = new Date(year, month, 1);
      const end = today;
      from = start.toISOString().slice(0, 10);
      to = end.toISOString().slice(0, 10);
    } else if (period === "ALL") {
      from = "";
      to = "";
    } else if (period === "CUSTOM") {
      return;
    }

    setFilters((prev) => ({
      ...prev,
      from,
      to,
    }));
  }, [period]);

  async function loadTx() {
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get("/transactions", {
        params: {
          limit,
          type: filters.type || undefined,
          category: filters.category || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        },
      });
      setTx(data || []);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.message || e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const totalIncome = useMemo(
    () => tx.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount || 0), 0),
    [tx]
  );
  const totalExpense = useMemo(
    () => tx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0),
    [tx]
  );

  // расходы по категориям
  const expenseByCategory = useMemo(() => {
    const map = {};
    tx.forEach((t) => {
      if (t.type !== "EXPENSE") return;
      const cat = (t.category || "Без категории").trim();
      const val = Math.abs(Number(t.amount) || 0);
      map[cat] = (map[cat] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tx]);

  // доходы/расходы по дням
  const dailyStats = useMemo(() => {
    const map = {};
    tx.forEach((t) => {
      const d = new Date(t.occurred_at);
      if (Number.isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 10);

      if (!map[key]) map[key] = { date: key, income: 0, expense: 0 };

      const amt = Number(t.amount || 0);
      if (t.type === "INCOME") {
        map[key].income += amt;
      } else if (t.type === "EXPENSE") {
        map[key].expense += Math.abs(amt);
      }
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [tx]);

  // ========= PDF ОТЧЁТ через pdfmake =========
  function exportToPdf() {
    if (!tx || tx.length === 0) {
      alert("Нет данных для отчёта");
      return;
    }

    const periodText =
      filters.from || filters.to
        ? `Период: ${filters.from || "…"} — ${filters.to || "…"}`
        : "Период: все операции";

    const body = [
      [
        { text: "Дата", bold: true },
        { text: "Тип", bold: true },
        { text: "Категория", bold: true },
        { text: "Сумма", bold: true },
        { text: "Описание", bold: true },
        { text: "Карта", bold: true },
      ],
      ...tx.map((t) => [
        new Date(t.occurred_at).toLocaleString("ru-RU"),
        t.type === "EXPENSE" ? "Расход" : "Доход",
        t.category || "",
        (t.type === "EXPENSE" ? "-" : "+") +
          Math.abs(Number(t.amount) || 0).toFixed(2),
        t.description || "",
        t.mask || "",
      ]),
    ];

    const docDefinition = {
      content: [
        { text: "FinHelper — финансовый отчёт", style: "header" },
        { text: periodText, margin: [0, 4, 0, 12] },
        {
          columns: [
            { text: `Доходы:  ${totalIncome.toFixed(2)}`, margin: [0, 0, 16, 4] },
            { text: `Расходы: ${totalExpense.toFixed(2)}`, margin: [0, 0, 16, 4] },
            { text: `Баланс:  ${(totalIncome - totalExpense).toFixed(2)}` },
          ],
        },
        { text: "Операции", style: "subheader", margin: [0, 10, 0, 4] },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "*", "auto", "*", "auto"],
            body,
          },
          layout: "lightHorizontalLines",
          fontSize: 9,
        },
      ],
      defaultStyle: {
        font: "Roboto",
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 8],
        },
        subheader: {
          fontSize: 12,
          bold: true,
        },
      },
    };

    const fileName = `finhelper_report_${filters.from || "all"}_${
      filters.to || "all"
    }.pdf`;

    pdfMake.createPdf(docDefinition).download(fileName);
  }

  // ========= RENDER =========
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-2">Отчёты</h1>

      {/* Периоды */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-600 mr-2">Период:</span>
        {[
          { id: "TODAY", label: "Сегодня" },
          { id: "7D", label: "7 дней" },
          { id: "MONTH", label: "Месяц" },
          { id: "ALL", label: "Все" },
          { id: "CUSTOM", label: "Период" },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1 rounded-xl text-sm border ${
              period === p.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"
            }`}
          >
            {p.label}
          </button>
        ))}

        <div className="flex flex-wrap gap-2 ml-4">
          <input
            type="date"
            className="border p-2 rounded-xl text-sm"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            disabled={period !== "CUSTOM"}
          />
          <input
            type="date"
            className="border p-2 rounded-xl text-sm"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            disabled={period !== "CUSTOM"}
          />
        </div>

        <button
          type="button"
          onClick={loadTx}
          className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm"
        >
          Применить
        </button>

        <button
          type="button"
          onClick={exportToPdf}
          disabled={loading || tx.length === 0}
          className="px-4 py-2 ml-2 border border-indigo-600 text-indigo-600 rounded-xl text-sm disabled:opacity-60"
        >
          Скачать PDF
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="border p-2 rounded-xl text-sm"
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="">Тип: все</option>
          <option value="INCOME">Доход</option>
          <option value="EXPENSE">Расход</option>
        </select>

        <select
          className="border p-2 rounded-xl text-sm"
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="">Категория: все</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Показывать:</span>
          <select
            className="border p-2 rounded-xl text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-xs text-gray-500">Доходы (период)</div>
          <div className="text-lg font-semibold text-green-600">
            +{totalIncome.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-xs text-gray-500">Расходы (период)</div>
          <div className="text-lg font-semibold text-red-600">
            -{totalExpense.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-xs text-gray-500">Баланс за период</div>
          <div className="text-lg font-semibold">
            {(totalIncome - totalExpense).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="font-semibold mb-2">Расходы по категориям</div>
          {expenseByCategory.length === 0 ? (
            <div className="text-sm text-gray-500">Нет расходов за выбранный период.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label={(entry) => entry.name}
                >
                  {expenseByCategory.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => v.toFixed(2)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <div className="font-semibold mb-2">Динамика по дням</div>
          {dailyStats.length === 0 ? (
            <div className="text-sm text-gray-500">
              Недостаточно данных для построения графика.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="income" name="Доход" fill="#22c55e" />
                <Bar dataKey="expense" name="Расход" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Список операций */}
      <div className="bg-white rounded-2xl shadow divide-y">
        {loading ? (
          <div className="p-4">Загрузка…</div>
        ) : error ? (
          <div className="p-4 text-red-600">Ошибка: {error}</div>
        ) : tx.length === 0 ? (
          <div className="p-4 text-gray-500">Операций за выбранный период нет.</div>
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
                <div
                  className={`font-semibold ${
                    t.type === "EXPENSE" ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {t.type === "EXPENSE" ? "-" : "+"}
                  {Math.abs(Number(t.amount)).toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
