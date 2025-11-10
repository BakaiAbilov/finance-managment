// src/pages/Goals.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

function fmt(n) { return new Intl.NumberFormat("ru-RU").format(Number(n||0)) + " сом"; }

export default function Goals() {
  const [items, setItems] = useState([]);
  const [loading, setLoad] = useState(true);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ title: "", target_amount: "", deadline: "" });
  const [contrib, setContrib] = useState({}); // { [goalId]: { amount:'', card_uid:'', create_tx:true } }
  const [cards, setCards] = useState([]);

  async function load() {
    try {
      setLoad(true); setErr(null);
      const [goalsRes, cardsRes] = await Promise.all([
        api.get("/goals"),
        api.get("/cards"),
      ]);
      setItems(Array.isArray(goalsRes.data) ? goalsRes.data : []);
      setCards(Array.isArray(cardsRes.data) ? cardsRes.data : []);
    } catch (e) {
      setErr(e.response?.data?.message || e.message || "Ошибка загрузки");
    } finally { setLoad(false); }
  }
  useEffect(()=>{ load(); }, []);

  async function addGoal(e) {
    e.preventDefault();
    const target = Number(String(form.target_amount).replace(',', '.'));
    if (!form.title) { alert("Название цели"); return; }
    if (!Number.isFinite(target) || target <= 0) { alert("Сумма > 0"); return; }
    setSaving(true);
    try {
      await api.post("/goals", { title: form.title, target_amount: target, deadline: form.deadline || null });
      setForm({ title:"", target_amount:"", deadline:"" });
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Не удалось создать цель");
    } finally { setSaving(false); }
  }

  async function contribute(goalId) {
    const g = contrib[goalId] || {};
    const amount = Number(String(g.amount).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { alert("Сумма > 0"); return; }
    try {
      await api.post(`/goals/${goalId}/contribute`, {
        amount,
        create_tx: g.create_tx !== false,
        card_uid: g.card_uid || null,
        description: "Вклад в цель"
      });
      setContrib(s => ({ ...s, [goalId]: { amount:"", card_uid:"", create_tx:true } }));
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Не удалось внести вклад");
    }
  }

  async function removeGoal(id) {
    if (!confirm("Удалить цель и все её взносы?")) return;
    try { await api.delete(`/goals/${id}`); await load(); }
    catch (e) { alert(e.response?.data?.message || "Не удалось удалить цель"); }
  }

  const totalTarget = useMemo(()=>items.reduce((s,g)=>s+Number(g.target_amount||0),0),[items]);
  const totalSaved  = useMemo(()=>items.reduce((s,g)=>s+Number(g.saved||0),0),[items]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Цели</h1>

      {/* Форма добавления цели */}
      <form onSubmit={addGoal} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white rounded-2xl p-4 shadow">
        <input className="border rounded-xl p-2 md:col-span-2" placeholder="Название цели" value={form.title} onChange={(e)=>setForm(s=>({...s, title:e.target.value}))}/>
        <input className="border rounded-xl p-2" placeholder="Сумма (сом)" value={form.target_amount} onChange={(e)=>setForm(s=>({...s, target_amount:e.target.value.replace(/[^\d.,]/g,'')}))}/>
        <input className="border rounded-xl p-2" type="date" value={form.deadline} onChange={(e)=>setForm(s=>({...s, deadline:e.target.value}))}/>
        <div className="md:col-span-1">
          <button disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Сохраняем…" : "Добавить цель"}
          </button>
        </div>
      </form>

      {/* Сводка */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-4"><div className="text-sm text-gray-500">Итого цели</div><div className="text-xl font-semibold mt-1">{fmt(totalTarget)}</div></div>
        <div className="bg-white rounded-2xl border p-4"><div className="text-sm text-gray-500">Накоплено</div><div className="text-xl font-semibold mt-1">{fmt(totalSaved)}</div></div>
      </div>

      {/* Список целей */}
      <div className="bg-white rounded-2xl shadow divide-y">
        {loading ? <div className="p-4">Загрузка…</div>
        : err ? <div className="p-4 text-red-600">Ошибка: {err}</div>
        : items.length === 0 ? <div className="p-4 text-gray-500">Целей пока нет.</div>
        : items.map(g=>{
            const saved = Number(g.saved||0);
            const target = Number(g.target_amount||0);
            const pct = target>0 ? Math.min(200, Math.round((saved/target)*100)) : 0;
            const near = target>0 ? Math.round((saved/target)*100) : 0;
            return (
              <div key={g.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{g.title}</div>
                    <div className="text-sm text-gray-500">
                      {fmt(saved)} / {fmt(target)} ({near}%){g.deadline ? ` · дедлайн ${g.deadline}` : ""}
                    </div>
                  </div>
                  <button onClick={()=>removeGoal(g.id)} className="text-red-600 text-sm">Удалить</button>
                </div>
                <div className="mt-2 w-full h-2 bg-gray-100 rounded overflow-hidden">
                  <div className="h-2 bg-indigo-600" style={{ width: `${pct}%` }}/>
                </div>

                {/* Вклад */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    className="border rounded-xl p-2"
                    placeholder="Сумма вклада"
                    value={contrib[g.id]?.amount || ""}
                    onChange={(e)=>setContrib(s=>({ ...s, [g.id]: { ...(s[g.id]||{}), amount: e.target.value.replace(/[^\d.,]/g,'') } }))}
                  />
                  <select
                    className="border rounded-xl p-2"
                    value={contrib[g.id]?.card_uid || ""}
                    onChange={(e)=>setContrib(s=>({ ...s, [g.id]: { ...(s[g.id]||{}), card_uid: e.target.value } }))}
                  >
                    <option value="">Без карты</option>
                    {cards.map(c=><option key={c.card_uid} value={c.card_uid}>{c.nickname || "Карта"} — {c.mask}</option>)}
                  </select>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={contrib[g.id]?.create_tx !== false}
                      onChange={(e)=>setContrib(s=>({ ...s, [g.id]: { ...(s[g.id]||{}), create_tx: e.target.checked } }))}
                    />
                    Создать транзакцию расхода
                  </label>
                  <button onClick={()=>contribute(g.id)} className="px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700">
                    Внести вклад
                  </button>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
}
