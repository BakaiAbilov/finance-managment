//server/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(
  cors({  
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  })
);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- MySQL pool ----
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 100,
});

(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('MySQL connected');
  } catch (e) {
    console.error('MySQL connection failed:', e.message);
    process.exit(1);
  }
})();

// ---- utils ----
function toMysqlDatetime(d = new Date()) {
  const dt = new Date(d);

  const pad = (n) => String(n).padStart(2, '0');

  const year   = dt.getFullYear();
  const month  = pad(dt.getMonth() + 1); // 0-11 -> 1-12
  const day    = pad(dt.getDate());
  const hour   = pad(dt.getHours());
  const minute = pad(dt.getMinutes());
  const second = pad(dt.getSeconds());

  // ЛОКАЛЬНОЕ время, без UTC-сдвига
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}


function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  const toSql = (x) => x.toISOString().slice(0,19).replace('T',' ');
  return { start: toSql(start), end: toSql(end) };
}

function cryptoRandomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---- Auth middleware ----
const authMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, name }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// === Alerts (budget & balance) ===
function monthRangeUTC(d = new Date()) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const next  = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
  const fmt = x => x.toISOString().slice(0,19).replace('T',' ');
  return { start: fmt(start), end: fmt(next) };
}

app.get('/api/alerts', authMiddleware, async (req, res) => {
  try {
    const { start, end } = monthRangeUTC(new Date());

    // Бюджеты с тратами за месяц
    const [rows] = await pool.query(
      `
      SELECT 
        b.id,
        b.category,
        b.limit_amount AS limitAmount,
        IFNULL(SUM(CASE WHEN t.type='EXPENSE' THEN ABS(t.amount) ELSE 0 END),0) AS spent
      FROM budgets b
      LEFT JOIN transactions t
        ON t.user_id = b.user_id
       AND t.category = b.category
       AND t.type = 'EXPENSE'
       AND t.occurred_at >= ? AND t.occurred_at < ?
      WHERE b.user_id = ? AND b.period = 'MONTH'
      GROUP BY b.id, b.category, b.limit_amount
      `,
      [start, end, req.user.id]
    );

    const alerts = [];
    for (const r of rows) {
      const limit = Number(r.limitAmount || 0);
      const spent = Number(r.spent || 0);
      if (limit <= 0) continue;

      const pct = spent / limit;
      if (pct >= 1) {
        alerts.push({
          type: 'budget_exceeded',
          title: `Лимит превышен: ${r.category}`,
          message: `${spent.toLocaleString('ru-RU')} > ${limit.toLocaleString('ru-RU')} сом`,
          severity: 'critical',
          meta: { category: r.category, spent, limit }
        });
      } else if (pct >= 0.9) {
        alerts.push({
          type: 'budget_warning',
          title: `Почти достигнут лимит: ${r.category}`,
          message: `${Math.round(pct*100)}% от лимита`,
          severity: 'warning',
          meta: { category: r.category, spent, limit }
        });
      }
    }

    // (необязательно) Предупреждение по картам: баланс < 0
    const [cardBalances] = await pool.query(
      `
      SELECT c.nickname, c.mask, IFNULL(SUM(t.amount),0) AS balance
      FROM cards c
      LEFT JOIN transactions t ON t.card_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      `,
      [req.user.id]
    );
    for (const c of cardBalances) {
      const bal = Number(c.balance || 0);
      if (bal < 0) {
        alerts.push({
          type: 'card_negative',
          title: `Отрицательный баланс`,
          message: `${c.nickname || 'Карта'} ${c.mask || ''}: ${bal.toLocaleString('ru-RU')} сом`,
          severity: 'warning',
          meta: { mask: c.mask, balance: bal }
        });
      }
    }

    res.json({ count: alerts.length, alerts });
  } catch (e) {
    console.error('/api/alerts error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== AUTH ====================

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Поля пустые' });

  try {
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length) return res.status(400).json({ message: 'Почта уже зарегистрирован' });

    const hashed = await bcrypt.hash(password, 10);
    await pool.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [
      name, email, hashed,
    ]);
    res.json({ message: 'Успешно' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: 'Поля пустые' });

  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, password FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) return res.status(400).json({ message: 'Неправильно' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Неправильно' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== CARDS & TRANSACTIONS ====================

async function getUserCardByUid(userId, cardUid) {
  const [[card]] = await pool.execute(
    'SELECT * FROM cards WHERE user_id = ? AND card_uid = ?',
    [userId, cardUid]
  );
  return card;
}

// карты + динамический баланс (из суммы транзакций)
app.get('/api/cards', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.card_uid, c.mask, c.last4, c.expiry_month, c.expiry_year,
              c.nickname, c.currency, c.is_mock, c.created_at,
              IFNULL(SUM(t.amount), 0) AS balance
       FROM cards c
       LEFT JOIN transactions t ON t.card_id = c.id AND t.user_id = ?
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// привязка mock-карты
app.post('/api/cards/mock-link', authMiddleware, async (req, res) => {
  const raw = req.body || {};
  const nickname = raw.nickname || 'Mock карта';
  const currency = raw.currency || 'KGS';
  const last4Clean = String(raw.last4 || '').replace(/\D/g, '').slice(0, 4);
  const month = raw.expiry_month ? Number(raw.expiry_month) : null;
  const year  = raw.expiry_year  ? Number(raw.expiry_year)  : null;

  if (last4Clean.length !== 4) {
    return res.status(400).json({ message: 'Укажите корректные последние 4 цифры (last4).' });
  }

  const card_uid = cryptoRandomId();
  const mask = `**** **** **** ${last4Clean}`;

  try {
    await pool.execute(
      `INSERT INTO cards
       (user_id, card_uid, mask, last4, expiry_month, expiry_year, nickname, currency, is_mock, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
      [req.user.id, card_uid, mask, last4Clean, month, year, nickname, currency]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Mock-link error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Не удалось привязать карту' });
  }
});

// удалить карту (если есть операции — 400; ?force=1 — удаляет операции и карту)
app.delete('/api/cards/:cardUid', authMiddleware, async (req, res) => {
  const { cardUid } = req.params;
  const force = req.query.force === '1';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[card]] = await conn.execute(
      `SELECT id FROM cards WHERE user_id = ? AND card_uid = ?`,
      [req.user.id, cardUid]
    );
    if (!card) {
      await conn.rollback();
      return res.status(404).json({ message: 'Карта не найдена' });
    }

    const [[cnt]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ? AND card_id = ?`,
      [req.user.id, card.id]
    );

    if (cnt.cnt > 0 && !force) {
      await conn.rollback();
      return res.status(400).json({ message: 'Нельзя удалить карту с операциями. Удалите операции или используйте force=1.' });
    }

    if (cnt.cnt > 0 && force) {
      await conn.execute(
        `DELETE FROM transactions WHERE user_id = ? AND card_id = ?`,
        [req.user.id, card.id]
      );
    }

    await conn.execute(
      `DELETE FROM cards WHERE id = ? AND user_id = ?`,
      [card.id, req.user.id]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('DELETE /api/cards/:cardUid error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// последние операции по карте
// Последние операции по карте (НОВЫЙ КОД)
app.get('/api/cards/:cardUid/transactions', authMiddleware, async (req, res) => {
  try {
    const { cardUid } = req.params;
    const limit = Math.min(100, Number(req.query.limit) || 10);

    // 1) находим карту текущего пользователя
    const [[card]] = await pool.execute(
      'SELECT id FROM cards WHERE user_id = ? AND card_uid = ?',
      [req.user.id, cardUid]
    );
    if (!card) return res.status(404).json({ message: 'Карта не найдена' });

    // 2) отдаём операции ИМЕННО этой карты, новые сверху
    const [rows] = await pool.query(
      `SELECT t.id, t.amount, t.type, t.category, t.description, t.occurred_at, t.is_mock
         FROM transactions AS t
        WHERE t.user_id = ? AND t.card_id = ?
        ORDER BY t.occurred_at DESC, t.id DESC
        LIMIT ?`,
      [req.user.id, card.id, Number(limit)]
    );

    res.json(rows);
  } catch (err) {
    // вернём полезное сообщение, если это SQL-ошибка
    console.error('GET /api/cards/:cardUid/transactions error:', err);
    const msg = err?.sqlMessage || err?.message || 'Server error';
    res.status(500).json({ message: msg });
  }
});
// Краткая сводка по балансам: карты, наличные, всего
app.get('/api/balance-summary', authMiddleware, async (req, res) => {
  try {
    // Всё, что привязано к картам
    const [[cardsRow]] = await pool.query(
      `SELECT IFNULL(SUM(amount), 0) AS totalCards
         FROM transactions
        WHERE user_id = ? AND card_id IS NOT NULL`,
      [req.user.id]
    );

    // Всё, что считается "наличными" (операции без card_id)
    const [[cashRow]] = await pool.query(
      `SELECT IFNULL(SUM(amount), 0) AS totalCash
         FROM transactions
        WHERE user_id = ? AND card_id IS NULL`,
      [req.user.id]
    );

    const cards = Number(cardsRow.totalCards || 0);
    const cash  = Number(cashRow.totalCash || 0);
    const total = cards + cash;

    res.json({
      cards,
      cash,
      total,
    });
  } catch (err) {
    console.error('GET /api/balance-summary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



// СОЗДАТЬ транзакцию (проверка баланса для расходов, автодата)
app.post('/api/transactions', authMiddleware, async (req, res) => {
  const {
    card_uid = null,
    amount,
    type, // 'INCOME' | 'EXPENSE'
    category = null,
    description = null,
    occurred_at = null, // опционально
  } = req.body || {};

  const t = String(type || '').trim().toUpperCase();
  const amt = Number(String(amount ?? '').replace(',', '.'));

  if (t !== 'INCOME' && t !== 'EXPENSE') {
    return res.status(400).json({ message: 'type должен быть INCOME или EXPENSE' });
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ message: 'Некорректная сумма (> 0)' });
  }

  const signedAmount = t === 'EXPENSE' ? -Math.abs(amt) : Math.abs(amt);

  let cardId = null;
  if (card_uid) {
    const card = await getUserCardByUid(req.user.id, card_uid);
    if (!card) return res.status(404).json({ message: 'Карта не найдена' });
    cardId = card.id;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ===========================
    // 🔹 Проверка бюджета
    // ===========================
    if (t === 'EXPENSE' && category) {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const startNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const fmt = (dt) => dt.toISOString().slice(0, 19).replace('T', ' ');

      const [[budget]] = await conn.execute(
        `SELECT id, limit_amount FROM budgets
         WHERE user_id = ? AND category = ? AND period = 'MONTH' LIMIT 1`,
        [req.user.id, category]
      );

      if (budget) {
        const [[rowSpent]] = await conn.execute(
          `SELECT IFNULL(SUM(ABS(amount)), 0) AS spent
             FROM transactions
            WHERE user_id = ? AND type = 'EXPENSE' AND category = ?
              AND occurred_at >= ? AND occurred_at < ?`,
          [req.user.id, category, fmt(startOfMonth), fmt(startNextMonth)]
        );

        const spent = Number(rowSpent.spent || 0);
        const limit = Number(budget.limit_amount || 0);
        const newTotal = spent + amt;

        if (newTotal > limit) {
          await conn.rollback();
          return res.status(409).json({
            message: `Лимит по категории "${category}" превышен: ${newTotal} > ${limit}`,
          });
        }
      }
    }

    // ===========================
    // 🔹 Проверка баланса карты
    // ===========================
    if (cardId && t === 'EXPENSE') {
      const [[row]] = await conn.execute(
        `SELECT IFNULL(SUM(amount),0) AS balance
           FROM transactions
          WHERE user_id = ? AND card_id = ? FOR UPDATE`,
        [req.user.id, cardId]
      );
      const currentBalance = Number(row?.balance || 0);
      if (Math.abs(signedAmount) > currentBalance) {
        await conn.rollback();
        return res.status(400).json({ message: 'Недостаточно средств на карте' });
      }
    }

    // ===========================
    // 🔹 Проверка баланса НАЛИЧНЫХ
    // ===========================
    if (!cardId && t === 'EXPENSE') {
      const [[row]] = await conn.execute(
        `SELECT IFNULL(SUM(amount),0) AS balance
         FROM transactions
         WHERE user_id = ? AND card_id IS NULL FOR UPDATE`,
        [req.user.id]
      );
      const currCash = Number(row?.balance || 0);

      if (Math.abs(signedAmount) > currCash) {
        await conn.rollback();
        return res.status(400).json({ message: 'Недостаточно наличных' });
      }
    }

    // ===========================
    // 🔹 Добавляем транзакцию
    // ===========================
    const when = occurred_at ? toMysqlDatetime(new Date(occurred_at)) : null;

    await conn.execute(
      `INSERT INTO transactions
         (user_id, card_id, amount, type, category, description, occurred_at, is_mock)
       VALUES
         (?, ?, ?, ?, ?, ?, COALESCE(?, NOW(3)), 1)`,
      [req.user.id, cardId, signedAmount, t, category, description, when]
    );

    await conn.commit();
    res.status(201).json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('POST /api/transactions error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});



// УДАЛИТЬ транзакцию
app.delete('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });

    const [result] = await pool.execute(
      `DELETE FROM transactions WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Транзакция не найдена' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/transactions/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// последние операции пользователя (все карты) — новые сверху
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 20);

    const { type, category, from, to } = req.query;

    const where = ['t.user_id = ?'];
    const params = [req.user.id];

    // фильтр по типу
    if (type === 'INCOME' || type === 'EXPENSE') {
      where.push('t.type = ?');
      params.push(type);
    }

    // фильтр по категории
    if (category) {
      where.push('t.category = ?');
      params.push(category);
    }

    // фильтр по дате "с"
    if (from) {
      where.push('t.occurred_at >= ?');
      params.push(from + ' 00:00:00');
    }

    // фильтр по дате "по"
    if (to) {
      where.push('t.occurred_at <= ?');
      params.push(to + ' 23:59:59');
    }

    // лимит в конце
    params.push(limit);

    const sql = `
      SELECT 
        t.id,
        t.amount,
        t.type,
        t.category,
        t.description,
        t.occurred_at,
        t.is_mock,
        c.card_uid,
        c.mask
      FROM transactions t
      LEFT JOIN cards c ON c.id = t.card_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.occurred_at DESC, t.id DESC
      LIMIT ?
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/transactions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ==================== BUDGETS ====================

// Список бюджетов + фактически потрачено за текущий месяц по категориям
app.get('/api/budgets', authMiddleware, async (req, res) => {
  try {
    const { start, end } = monthRange(new Date());
    // агрегируем расходы по категориям за месяц
    const [spentRows] = await pool.query(
      `SELECT category, SUM(ABS(amount)) AS spent
         FROM transactions
        WHERE user_id = ? AND type = 'EXPENSE' AND occurred_at BETWEEN ? AND ?
        GROUP BY category`,
      [req.user.id, start, end]
    );
    const spentMap = Object.create(null);
    for (const r of spentRows) spentMap[r.category || ''] = Number(r.spent || 0);

    // бюджетные записи пользователя
    const [budgets] = await pool.query(
      `SELECT id, category, limit_amount, period, created_at
         FROM budgets
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );

    // обогащаем полем spent
    const out = budgets.map(b => ({
      ...b,
      spent: spentMap[b.category] || 0
    }));
    res.json(out);
  } catch (err) {
    console.error('GET /api/budgets error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

// Создать бюджет (уникален {user_id, category, period})
app.post('/api/budgets', authMiddleware, async (req, res) => {
  try {
    const { category, limit_amount, period = 'MONTH' } = req.body || {};
    const cat = String(category || '').trim();
    const lim = Number(limit_amount);
    if (!cat) return res.status(400).json({ message: 'Укажите категорию' });
    if (!Number.isFinite(lim) || lim <= 0) return res.status(400).json({ message: 'Некорректный лимит' });
    if (period !== 'MONTH') return res.status(400).json({ message: 'Поддерживается только MONTH' });

    const [r] = await pool.execute(
      `INSERT INTO budgets (user_id, category, limit_amount, period) VALUES (?, ?, ?, ?)`,
      [req.user.id, cat, lim, period]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Бюджет для категории уже существует' });
    }
    console.error('POST /api/budgets error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

// Обновить бюджет
app.patch('/api/budgets/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });

    const fields = [];
    const values = [];
    if (req.body.category != null) { fields.push('category = ?'); values.push(String(req.body.category).trim()); }
    if (req.body.limit_amount != null) {
      const lim = Number(req.body.limit_amount);
      if (!Number.isFinite(lim) || lim <= 0) return res.status(400).json({ message: 'Некорректный лимит' });
      fields.push('limit_amount = ?'); values.push(lim);
    }
    if (!fields.length) return res.status(400).json({ message: 'Нечего обновлять' });

    values.push(req.user.id, id);
    const [r] = await pool.execute(
      `UPDATE budgets SET ${fields.join(', ')} WHERE user_id = ? AND id = ?`,
      values
    );
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Бюджет не найден' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Бюджет для категории уже существует' });
    }
    console.error('PATCH /api/budgets/:id error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

// Удалить бюджет
app.delete('/api/budgets/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });

    const [r] = await pool.execute(
      `DELETE FROM budgets WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Бюджет не найден' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/budgets/:id error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});
// ==================== GOALS ====================

// Список целей + прогресс (сумма внесённых взносов)
app.get('/api/goals', authMiddleware, async (req, res) => {
  try {
    const [goals] = await pool.query(
      `SELECT id, title, target_amount, deadline, created_at
         FROM goals
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );

    const [agg] = await pool.query(
      `SELECT goal_id, SUM(amount) AS saved
         FROM goal_contributions
        WHERE user_id = ?
        GROUP BY goal_id`,
      [req.user.id]
    );
    const savedMap = Object.create(null);
    for (const r of agg) savedMap[r.goal_id] = Number(r.saved || 0);

    const out = goals.map(g => ({
      ...g,
      saved: savedMap[g.id] || 0
    }));
    res.json(out);
  } catch (err) {
    console.error('GET /api/goals error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

// Создать цель
app.post('/api/goals', authMiddleware, async (req, res) => {
  try {
    const { title, target_amount, deadline = null } = req.body || {};
    const t = String(title || '').trim();
    const target = Number(target_amount);
    if (!t) return res.status(400).json({ message: 'Укажите название цели' });
    if (!Number.isFinite(target) || target <= 0) return res.status(400).json({ message: 'Некорректная сумма цели' });

    const [r] = await pool.execute(
      `INSERT INTO goals (user_id, title, target_amount, deadline)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, t, target, deadline ? new Date(deadline) : null]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    console.error('POST /api/goals error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

// Изменить цель
app.patch('/api/goals/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });

    const set = [], vals = [];
    if (req.body.title != null) { set.push('title = ?'); vals.push(String(req.body.title).trim()); }
    if (req.body.target_amount != null) {
      const target = Number(req.body.target_amount);
      if (!Number.isFinite(target) || target <= 0) return res.status(400).json({ message: 'Некорректная сумма цели' });
      set.push('target_amount = ?'); vals.push(target);
    }
    if (req.body.deadline !== undefined) { set.push('deadline = ?'); vals.push(req.body.deadline ? new Date(req.body.deadline) : null); }
    if (!set.length) return res.status(400).json({ message: 'Нечего обновлять' });

    vals.push(req.user.id, id);
    const [r] = await pool.execute(
      `UPDATE goals SET ${set.join(', ')} WHERE user_id = ? AND id = ?`,
      vals
    );
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Цель не найдена' });
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/goals/:id error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

// Удалить цель + откатить связанные транзакции (вернуть деньги)
app.delete('/api/goals/:id', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      conn.release();
      return res.status(400).json({ message: 'Bad id' });
    }

    await conn.beginTransaction();

    // 1) забираем все tx_id связанных вкладов
    const [gcRows] = await conn.execute(
      `SELECT tx_id
         FROM goal_contributions
        WHERE user_id = ? AND goal_id = ? AND tx_id IS NOT NULL`,
      [req.user.id, id]
    );
    const txIds = gcRows.map(r => r.tx_id).filter(Boolean);

    // 2) удаляем сами вклады
    await conn.execute(
      `DELETE FROM goal_contributions WHERE user_id = ? AND goal_id = ?`,
      [req.user.id, id]
    );

    // 3) удаляем транзакции, которыми деньги уходили в цель
    if (txIds.length > 0) {
      const placeholders = txIds.map(() => '?').join(',');
      await conn.execute(
        `DELETE FROM transactions
          WHERE user_id = ? AND id IN (${placeholders})`,
        [req.user.id, ...txIds]
      );
    }

    // 4) удаляем цель
    const [r] = await conn.execute(
      `DELETE FROM goals WHERE user_id = ? AND id = ?`,
      [req.user.id, id]
    );

    await conn.commit();
    conn.release();

    if (r.affectedRows === 0) {
      return res.status(404).json({ message: 'Цель не найдена' });
    }

    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('DELETE /api/goals/:id error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

app.post('/api/goals/:id/contribute', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const { amount, create_tx = true, card_uid = null, description = 'Вклад в цель' } = req.body || {};
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      conn.release();
      return res.status(400).json({ message: 'Некорректная сумма' });
    }

    const [[goal]] = await conn.execute(
      `SELECT id FROM goals WHERE user_id = ? AND id = ?`,
      [req.user.id, id]
    );
    if (!goal) {
      conn.release();
      return res.status(404).json({ message: 'Цель не найдена' });
    }

    await conn.beginTransaction();

    // найти карту
    let cardId = null;
    if (create_tx && card_uid) {
      const [[card]] = await conn.execute(
        `SELECT id FROM cards WHERE user_id = ? AND card_uid = ?`,
        [req.user.id, card_uid]
      );
      if (!card) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: 'Карта не найдена' });
      }
      cardId = card.id;
    }

    // ===========================
    // 🔹 Проверка наличных/карты
    // ===========================
    if (create_tx) {
      const need = Math.abs(amt);

      if (cardId) {
        const [[row]] = await conn.execute(
          `SELECT IFNULL(SUM(amount),0) AS balance
           FROM transactions
           WHERE user_id = ? AND card_id = ? FOR UPDATE`,
          [req.user.id, cardId]
        );
        const bal = Number(row?.balance || 0);
        if (need > bal) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ message: 'Недостаточно средств на карте для вклада' });
        }
      } else {
        const [[row]] = await conn.execute(
          `SELECT IFNULL(SUM(amount),0) AS balance
           FROM transactions
           WHERE user_id = ? AND card_id IS NULL FOR UPDATE`,
          [req.user.id]
        );
        const bal = Number(row?.balance || 0);
        if (need > bal) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ message: 'Недостаточно наличных для вклада' });
        }
      }
    }

    // создать транзакцию (расход)
    let txId = null;
    if (create_tx) {
      const when = toMysqlDatetime(new Date());
      const [r] = await conn.execute(
        `INSERT INTO transactions
           (user_id, card_id, amount, type, category, description, occurred_at, is_mock)
         VALUES (?, ?, ?, 'EXPENSE', ?, ?, ?, 1)`,
        [req.user.id, cardId, -Math.abs(amt), 'Накопления', description, when]
      );
      txId = r.insertId;
    }

    // внести вклад
    await conn.execute(
      `INSERT INTO goal_contributions (user_id, goal_id, amount, occurred_at, tx_id)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, id, amt, toMysqlDatetime(new Date()), txId]
    );

    await conn.commit();
    conn.release();
    res.status(201).json({ ok: true });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('POST /api/goals/:id/contribute error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});


// Удалить вклад (при желании можно дополнить каскадным удалением связанной транзакции)
app.delete('/api/goals/:id/contributions/:cid', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cid = Number(req.params.cid);
    if (!Number.isFinite(id) || !Number.isFinite(cid)) return res.status(400).json({ message: 'Bad id' });
    const [r] = await pool.execute(
      `DELETE FROM goal_contributions WHERE id = ? AND goal_id = ? AND user_id = ?`,
      [cid, id, req.user.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Вклад не найден' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/goals/:id/contributions/:cid error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});
// ==================== TX TEMPLATES ====================

// Список шаблонов
app.get('/api/tx-templates', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, type, amount, category, description, card_uid, created_at
         FROM tx_templates
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/tx-templates error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

// Создать шаблон
app.post('/api/tx-templates', authMiddleware, async (req, res) => {
  try {
    const { title, type, amount, category = null, description = null, card_uid = null } = req.body || {};
    const t = String(title || '').trim();
    const ty = String(type || '').trim().toUpperCase();
    const amt = Number(amount);
    if (!t) return res.status(400).json({ message: 'Название шаблона' });
    if (ty !== 'INCOME' && ty !== 'EXPENSE') return res.status(400).json({ message: 'type: INCOME | EXPENSE' });
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Некорректная сумма' });

    await pool.execute(
      `INSERT INTO tx_templates (user_id, title, type, amount, category, description, card_uid)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, t, ty, amt, category, description, card_uid]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/tx-templates error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

// Удалить шаблон
app.delete('/api/tx-templates/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });
    const [r] = await pool.execute(
      `DELETE FROM tx_templates WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Шаблон не найден' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tx-templates/:id error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});

app.post('/api/tx-templates/:id/use', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });

    const [[tpl]] = await pool.execute(
      `SELECT * FROM tx_templates WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (!tpl) return res.status(404).json({ message: 'Шаблон не найден' });

    const type = String(req.body.type || tpl.type).toUpperCase();
    const amount = Number(req.body.amount ?? tpl.amount);
    const category = req.body.category ?? tpl.category;
    const description = req.body.description ?? tpl.description;
    const card_uid = req.body.card_uid ?? tpl.card_uid;

    if (type !== 'INCOME' && type !== 'EXPENSE')
      return res.status(400).json({ message: 'type: INCOME | EXPENSE' });
    if (!Number.isFinite(amount) || amount <= 0)
      return res.status(400).json({ message: 'Некорректная сумма' });

    let cardId = null;
    if (card_uid) {
      const [[card]] = await pool.execute(
        `SELECT id FROM cards WHERE user_id = ? AND card_uid = ?`,
        [req.user.id, card_uid]
      );
      if (!card) return res.status(404).json({ message: 'Карта не найдена' });
      cardId = card.id;
    }

    const signed = type === 'EXPENSE' ? -Math.abs(amount) : Math.abs(amount);

    // ===========================
    // 🔹 Проверка баланса
    // ===========================
    if (type === 'EXPENSE') {
      if (cardId) {
        const [[row]] = await pool.execute(
          `SELECT IFNULL(SUM(amount),0) AS balance
           FROM transactions WHERE user_id = ? AND card_id = ?`,
          [req.user.id, cardId]
        );
        const bal = Number(row?.balance || 0);
        if (Math.abs(signed) > bal) {
          return res.status(400).json({ message: 'Недостаточно средств на карте' });
        }
      } else {
        const [[row]] = await pool.execute(
          `SELECT IFNULL(SUM(amount),0) AS balance
           FROM transactions WHERE user_id = ? AND card_id IS NULL`,
          [req.user.id]
        );
        const bal = Number(row?.balance || 0);
        if (Math.abs(signed) > bal) {
          return res.status(400).json({ message: 'Недостаточно наличных' });
        }
      }
    }

    const when = toMysqlDatetime(new Date());

    const [r] = await pool.execute(
      `INSERT INTO transactions (user_id, card_id, amount, type, category, description, occurred_at, is_mock)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.user.id, cardId, signed, type, category, description, when]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    console.error('POST /api/tx-templates/:id/use error:', err);
    res.status(500).json({ message: err.sqlMessage || 'Server error' });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
