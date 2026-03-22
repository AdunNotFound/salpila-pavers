const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pavecraft.db');
let db;

function saveDb() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, buffer);
  } catch(e) { console.error('Save error:', e); }
}

setInterval(saveDb, 30000);

function genId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, name TEXT NOT NULL, units_per_bag REAL DEFAULT 0, measure_by_bag INTEGER DEFAULT 1, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS colors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, sort_order INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS production (id TEXT PRIMARY KEY, design_id TEXT NOT NULL, color TEXT NOT NULL, bags REAL DEFAULT 0, units INTEGER NOT NULL, date TEXT NOT NULL, notes TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, design_id TEXT NOT NULL, color TEXT NOT NULL, units INTEGER NOT NULL, customer TEXT DEFAULT '', date TEXT NOT NULL, notes TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, sort_order INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS prices (id INTEGER PRIMARY KEY AUTOINCREMENT, design_id TEXT NOT NULL, color TEXT NOT NULL, location TEXT NOT NULL, price REAL DEFAULT 0, UNIQUE(design_id, color, location))`);

  const dc = db.exec("SELECT COUNT(*) FROM designs")[0]?.values[0][0] || 0;
  if (dc === 0) {
    [['d1','Zigzag',40,1],['d2','Interlock',36,1],['d3','Cobblestone',28,1],['d4','Diamond',32,1],['d5','Grass Block',0,0],['d6','Kerb Stone',0,0]].forEach(([id,name,upb,mbb]) => {
      db.run('INSERT INTO designs (id,name,units_per_bag,measure_by_bag) VALUES (?,?,?,?)', [id,name,upb,mbb]);
    });
  }
  const cc = db.exec("SELECT COUNT(*) FROM colors")[0]?.values[0][0] || 0;
  if (cc === 0) {
    ['Red','Black','Ash','White'].forEach((c,i) => db.run('INSERT INTO colors (name,sort_order) VALUES (?,?)', [c,i]));
  }
  const lc = db.exec("SELECT COUNT(*) FROM locations")[0]?.values[0][0] || 0;
  if (lc === 0) {
    ['Kalutara','Colombo'].forEach((l,i) => db.run('INSERT INTO locations (name,sort_order) VALUES (?,?)', [l,i]));
  }
  saveDb();
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// ─── Designs ───
app.get('/api/designs', (req, res) => {
  res.json(queryAll('SELECT * FROM designs ORDER BY created_at').map(r => ({
    id: r.id, name: r.name, unitsPerBag: r.units_per_bag, measureByBag: !!r.measure_by_bag, active: !!r.active,
  })));
});

app.post('/api/designs', (req, res) => {
  const { name, unitsPerBag = 0, measureByBag = true } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = genId();
  run('INSERT INTO designs (id,name,units_per_bag,measure_by_bag) VALUES (?,?,?,?)', [id, name, unitsPerBag, measureByBag ? 1 : 0]);
  res.json({ id, name, unitsPerBag, measureByBag, active: true });
});

app.put('/api/designs/:id', (req, res) => {
  const { name, unitsPerBag, measureByBag, active } = req.body;
  const e = queryOne('SELECT * FROM designs WHERE id = ?', [req.params.id]);
  if (!e) return res.status(404).json({ error: 'Not found' });
  run('UPDATE designs SET name=?, units_per_bag=?, measure_by_bag=?, active=? WHERE id=?', [
    name ?? e.name, unitsPerBag ?? e.units_per_bag,
    measureByBag !== undefined ? (measureByBag ? 1 : 0) : e.measure_by_bag,
    active !== undefined ? (active ? 1 : 0) : e.active, req.params.id,
  ]);
  res.json({ success: true });
});

app.delete('/api/designs/:id', (req, res) => {
  run('DELETE FROM designs WHERE id = ?', [req.params.id]);
  run('DELETE FROM prices WHERE design_id = ?', [req.params.id]);
  res.json({ success: true });
});

// ─── Colors ───
app.get('/api/colors', (req, res) => {
  res.json(queryAll('SELECT name FROM colors ORDER BY sort_order, id').map(r => r.name));
});

app.post('/api/colors', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const m = queryOne('SELECT MAX(sort_order) as m FROM colors')?.m || 0;
    run('INSERT INTO colors (name, sort_order) VALUES (?, ?)', [name, m + 1]);
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'Color already exists' }); }
});

app.delete('/api/colors/:name', (req, res) => {
  run('DELETE FROM colors WHERE name = ?', [req.params.name]);
  run('DELETE FROM prices WHERE color = ?', [req.params.name]);
  res.json({ success: true });
});

// ─── Locations ───
app.get('/api/locations', (req, res) => {
  res.json(queryAll('SELECT name FROM locations ORDER BY sort_order, id').map(r => r.name));
});

app.post('/api/locations', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const m = queryOne('SELECT MAX(sort_order) as m FROM locations')?.m || 0;
    run('INSERT INTO locations (name, sort_order) VALUES (?, ?)', [name, m + 1]);
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'Location already exists' }); }
});

app.delete('/api/locations/:name', (req, res) => {
  run('DELETE FROM locations WHERE name = ?', [req.params.name]);
  run('DELETE FROM prices WHERE location = ?', [req.params.name]);
  res.json({ success: true });
});

// ─── Prices ───
app.get('/api/prices', (req, res) => {
  const rows = queryAll('SELECT p.*, d.name as design_name FROM prices p LEFT JOIN designs d ON p.design_id = d.id ORDER BY d.name, p.color, p.location');
  res.json(rows.map(r => ({
    id: r.id, designId: r.design_id, designName: r.design_name,
    color: r.color, location: r.location, price: r.price,
  })));
});

app.post('/api/prices', (req, res) => {
  const { designId, color, location, price } = req.body;
  if (!designId || !color || !location || price === undefined) return res.status(400).json({ error: 'Missing fields' });
  // Upsert
  const existing = queryOne('SELECT id FROM prices WHERE design_id=? AND color=? AND location=?', [designId, color, location]);
  if (existing) {
    run('UPDATE prices SET price=? WHERE id=?', [price, existing.id]);
  } else {
    run('INSERT INTO prices (design_id, color, location, price) VALUES (?,?,?,?)', [designId, color, location, price]);
  }
  res.json({ success: true });
});

app.post('/api/prices/bulk', (req, res) => {
  const { prices } = req.body; // array of {designId, color, location, price}
  if (!prices || !Array.isArray(prices)) return res.status(400).json({ error: 'prices array required' });
  for (const p of prices) {
    const existing = queryOne('SELECT id FROM prices WHERE design_id=? AND color=? AND location=?', [p.designId, p.color, p.location]);
    if (existing) {
      db.run('UPDATE prices SET price=? WHERE id=?', [p.price, existing.id]);
    } else {
      db.run('INSERT INTO prices (design_id, color, location, price) VALUES (?,?,?,?)', [p.designId, p.color, p.location, p.price]);
    }
  }
  saveDb();
  res.json({ success: true });
});

// ─── Production ───
app.get('/api/production', (req, res) => {
  res.json(queryAll('SELECT * FROM production ORDER BY date DESC, created_at DESC').map(r => ({
    id: r.id, designId: r.design_id, color: r.color, bags: r.bags, units: r.units, date: r.date, notes: r.notes,
  })));
});

app.post('/api/production', (req, res) => {
  const { designId, color, bags = 0, units, date, notes = '' } = req.body;
  if (!designId || !color || !units || !date) return res.status(400).json({ error: 'Missing fields' });
  const id = genId();
  run('INSERT INTO production (id,design_id,color,bags,units,date,notes) VALUES (?,?,?,?,?,?,?)', [id, designId, color, bags, units, date, notes]);
  res.json({ id, designId, color, bags, units, date, notes });
});

app.delete('/api/production/:id', (req, res) => {
  run('DELETE FROM production WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ─── Sales ───
app.get('/api/sales', (req, res) => {
  res.json(queryAll('SELECT * FROM sales ORDER BY date DESC, created_at DESC').map(r => ({
    id: r.id, designId: r.design_id, color: r.color, units: r.units, customer: r.customer, date: r.date, notes: r.notes,
  })));
});

app.post('/api/sales', (req, res) => {
  const { designId, color, units, date, customer = '', notes = '' } = req.body;
  if (!designId || !color || !units || !date) return res.status(400).json({ error: 'Missing fields' });
  const id = genId();
  run('INSERT INTO sales (id,design_id,color,units,customer,date,notes) VALUES (?,?,?,?,?,?,?)', [id, designId, color, units, date, customer, notes]);
  res.json({ id, designId, color, units, customer, date, notes });
});

app.delete('/api/sales/:id', (req, res) => {
  run('DELETE FROM sales WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ─── Inventory ───
app.get('/api/inventory', (req, res) => {
  const designs = queryAll('SELECT * FROM designs WHERE active = 1 ORDER BY created_at');
  const colors = queryAll('SELECT name FROM colors ORDER BY sort_order, id').map(r => r.name);
  const pm = {}, sm = {};
  queryAll('SELECT design_id,color,SUM(units) as t FROM production GROUP BY design_id,color').forEach(r => { pm[`${r.design_id}|${r.color}`] = r.t; });
  queryAll('SELECT design_id,color,SUM(units) as t FROM sales GROUP BY design_id,color').forEach(r => { sm[`${r.design_id}|${r.color}`] = r.t; });
  const inv = [];
  designs.forEach(d => colors.forEach(c => {
    const k = `${d.id}|${c}`, p = pm[k]||0, s = sm[k]||0;
    inv.push({ designId: d.id, designName: d.name, color: c, produced: p, sold: s, stock: p - s });
  }));
  res.json(inv);
});

// ─── Stats ───
app.get('/api/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const g = (sql, p=[]) => queryOne(sql, p)?.v || 0;
  res.json({
    totalProduced: g('SELECT COALESCE(SUM(units),0) as v FROM production'),
    totalSold: g('SELECT COALESCE(SUM(units),0) as v FROM sales'),
    totalBags: g('SELECT COALESCE(SUM(bags),0) as v FROM production'),
    totalStock: g('SELECT COALESCE(SUM(units),0) as v FROM production') - g('SELECT COALESCE(SUM(units),0) as v FROM sales'),
    todayProduced: g('SELECT COALESCE(SUM(units),0) as v FROM production WHERE date=?', [today]),
    todaySold: g('SELECT COALESCE(SUM(units),0) as v FROM sales WHERE date=?', [today]),
    activeDesigns: g('SELECT COUNT(*) as v FROM designs WHERE active=1'),
    colorCount: g('SELECT COUNT(*) as v FROM colors'),
    recentProduction: queryAll(`SELECT p.*,d.name as design_name FROM production p LEFT JOIN designs d ON p.design_id=d.id ORDER BY p.date DESC,p.created_at DESC LIMIT 8`).map(r => ({
      id: r.id, designId: r.design_id, designName: r.design_name, color: r.color, bags: r.bags, units: r.units, date: r.date,
    })),
    recentSales: queryAll(`SELECT s.*,d.name as design_name FROM sales s LEFT JOIN designs d ON s.design_id=d.id ORDER BY s.date DESC,s.created_at DESC LIMIT 8`).map(r => ({
      id: r.id, designId: r.design_id, designName: r.design_name, color: r.color, units: r.units, customer: r.customer, date: r.date,
    })),
  });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Salpila Pavers running on port ${PORT}\n`);
  });
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });

process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });
