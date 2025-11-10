// src/pages/Templates.jsx
import { useEffect, useState } from "react";
import api from "../api";

const CATEGORIES = ["Супермаркет","Кафе","Такси","Связь","Транспорт","Аренда","Перевод","Подарок","Зарплата","Проценты"];

function fmtMoney(n){ return new Intl.NumberFormat('ru-RU').format(Number(n||0))+' сом'; }

export default function Templates() {
  const [items, setItems] = useState([]);
  const [loading, setLoad] = useState(true);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState([]);

  const [form, setForm] = useState({
    title:"", type:"EXPENSE", amount:"", category:"", description:"", card_uid:""
  });

  async function load() {
    try {
      setLoad(true); setErr(null);
      const [tplRes, cardsRes] = await Promise.all([api.get('/tx-templates'), api.get('/cards')]);
      setItems(Array.isArray(tplRes.data) ? tplRes.data : []);
      setCards(Array.isArray(cardsRes.data) ? cardsRes.data : []);
    } catch (e) {
      setErr(e.response?.data?.message || e.message || "Ошибка загрузки");
    } finally { setLoad(false); }
  }
  useEffect(()=>{ load(); }, []);

  async function addTemplate(e){
    e.preventDefault();
    const amount = Number(String(form.amount).replace(',','.'));
    if(!form.title){ alert('Название'); return; }
    if(!Number.isFinite(amount) || amount<=0){ alert('Сумма > 0'); return; }
    setSaving(true);
    try{
      await api.post('/tx-templates', {
        title: form.title, type: form.type, amount,
        category: form.category || null, description: form.description || null,
        card_uid: form.card_uid || null
      });
      setForm({ title:"", type:"EXPENSE", amount:"", category:"", description:"", card_uid:"" });
      await load();
    }catch(e){ alert(e.response?.data?.message || 'Не удалось создать шаблон'); }
    finally{ setSaving(false); }
  }

  async function removeTemplate(id){
    if(!confirm('Удалить шаблон?')) return;
    try{ await api.delete(`/tx-templates/${id}`); await load(); }
    catch(e){ alert(e.response?.data?.message || 'Не удалось удалить'); }
  }

  async function useTemplate(t){
    const amount = prompt('Сумма (Enter — оставить из шаблона)', t.amount);
    if(amount === null) return;
    const body = { amount: amount === '' ? t.amount : Number(amount) };
    const card = prompt('UID карты (Enter — по шаблону/без карты)', t.card_uid || '');
    if(card !== null && card !== '') body.card_uid = card;
    try{
      await api.post(`/tx-templates/${t.id}/use`, body);
      alert('Операция добавлена!');
    }catch(e){ alert(e.response?.data?.message || 'Не удалось создать операцию'); }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Шаблоны операций</h1>

      {/* Форма */}
      <form onSubmit={addTemplate} className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-white rounded-2xl p-4 shadow">
        <input className="border rounded-xl p-2 md:col-span-2" placeholder="Название" value={form.title} onChange={(e)=>setForm(s=>({...s, title:e.target.value}))}/>
        <select className="border rounded-xl p-2" value={form.type} onChange={(e)=>setForm(s=>({...s, type:e.target.value}))}>
          <option value="EXPENSE">Расход</option>
          <option value="INCOME">Доход</option>
        </select>
        <input className="border rounded-xl p-2" placeholder="Сумма" value={form.amount} onChange={(e)=>setForm(s=>({...s, amount:e.target.value.replace(/[^\d.,]/g,'')}))}/>
        <select className="border rounded-xl p-2" value={form.category} onChange={(e)=>setForm(s=>({...s, category:e.target.value}))}>
          <option value="">Категория (необязательно)</option>
          {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select className="border rounded-xl p-2" value={form.card_uid} onChange={(e)=>setForm(s=>({...s, card_uid:e.target.value}))}>
          <option value="">Без карты</option>
          {cards.map(c=><option key={c.card_uid} value={c.card_uid}>{c.nickname || 'Карта'} — {c.mask}</option>)}
        </select>
        <input className="border rounded-xl p-2 md:col-span-6" placeholder="Описание (необязательно)" value={form.description} onChange={(e)=>setForm(s=>({...s, description:e.target.value}))}/>
        <div className="md:col-span-6">
          <button disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Сохраняем…' : 'Добавить шаблон'}
          </button>
        </div>
      </form>

      {/* Список */}
      <div className="bg-white rounded-2xl shadow divide-y">
        {loading ? <div className="p-4">Загрузка…</div>
        : err ? <div className="p-4 text-red-600">Ошибка: {err}</div>
        : items.length === 0 ? <div className="p-4 text-gray-500">Шаблонов нет.</div>
        : items.map(t=>(
          <div key={t.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{t.title}</div>
              <div className="text-sm text-gray-500">
                {t.type === 'EXPENSE' ? 'Расход' : 'Доход'} · {fmtMoney(t.amount)}
                {t.category ? ` · ${t.category}` : ''}{t.card_uid ? ' · привязана карта' : ''}
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <button onClick={()=>useTemplate(t)} className="text-sm underline">Использовать</button>
              <button onClick={()=>removeTemplate(t.id)} className="text-sm text-red-600">Удалить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
