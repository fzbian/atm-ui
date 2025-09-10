// Simple express server providing a minimal users API backed by SQLite (db.sqlite)
// Note: This is for local dev only; place it behind proper auth and validation in prod.

const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8081; // separate port from CRA dev
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.sqlite');

app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Actor-Username');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Ensure DB directory and file exist
try {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.closeSync(fs.openSync(DB_PATH, 'w'));
} catch (e) {
  console.error('Error initializing DB path:', e);
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    displayName TEXT NOT NULL,
    pin TEXT,
    role TEXT NOT NULL DEFAULT 'user'
  )`);
});

// Helpers
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, function (err, rows) {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, function (err, row) {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function getDevCount() {
  const row = await get(db, "SELECT COUNT(*) as cnt FROM users WHERE role = 'dev'");
  return row?.cnt || 0;
}

// Users API
app.get('/usuarios', async (req, res) => {
  try {
    const rows = await all(db, 'SELECT username, displayName, role FROM users ORDER BY username ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message || 'Error');
  }
});

app.post('/usuarios', async (req, res) => {
  try {
    const { username, displayName, pin, role } = req.body || {};
    if (!username || !displayName) return res.status(400).send('username y displayName requeridos');
    const exists = await get(db, 'SELECT username FROM users WHERE username = ?', [username]);
    if (exists) return res.status(409).send('Usuario ya existe');
    await run(db, 'INSERT INTO users (username, displayName, pin, role) VALUES (?,?,?,?)', [username, displayName, pin || null, role || 'user']);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).send(e.message || 'Error');
  }
});

app.put('/usuarios/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const { displayName, pin, role } = req.body || {};
    const current = await get(db, 'SELECT username, role FROM users WHERE username = ?', [username]);
    if (!current) return res.status(404).send('Usuario no encontrado');

    // If changing role away from dev, ensure at least one dev remains
    if (role != null && current.role === 'dev' && role !== 'dev') {
      const devCount = await getDevCount();
      if (devCount <= 1) {
        return res.status(400).send('Debe quedar al menos un usuario con rol dev');
      }
    }

    const sets = [];
    const params = [];
    if (displayName != null) { sets.push('displayName = ?'); params.push(displayName); }
    if (pin != null) { sets.push('pin = ?'); params.push(pin); }
    if (role != null) { sets.push('role = ?'); params.push(role); }
    if (sets.length === 0) return res.status(400).send('Nada que actualizar');
    params.push(username);
    await run(db, `UPDATE users SET ${sets.join(', ')} WHERE username = ?`, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).send(e.message || 'Error');
  }
});

app.delete('/usuarios/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const actor = req.header('x-actor-username') || req.header('X-Actor-Username') || '';
    const target = await get(db, 'SELECT username, role FROM users WHERE username = ?', [username]);
    if (!target) return res.status(404).send('Usuario no encontrado');

    if (actor && actor === username) {
      return res.status(400).send('No puedes eliminarte a ti mismo');
    }

    if (target.role === 'dev') {
      const devCount = await getDevCount();
      if (devCount <= 1) {
        return res.status(400).send('Debe quedar al menos un usuario con rol dev');
      }
    }

    await run(db, 'DELETE FROM users WHERE username = ?', [username]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).send(e.message || 'Error');
  }
});

// Login (valida PIN plano en DB)
app.post('/login', async (req, res) => {
  try {
    const { username, pin } = req.body || {};
    if (!username || !pin) return res.status(400).send('Usuario y PIN requeridos');
    const row = await get(db, 'SELECT username, displayName, role, pin FROM users WHERE username = ?', [username]);
    if (!row) return res.status(404).send('Usuario no encontrado');
    if (String(row.pin || '') !== String(pin)) return res.status(401).send('PIN incorrecto');
    return res.json({ ok: true, username: row.username, displayName: row.displayName, role: row.role });
  } catch (e) {
    res.status(500).send(e.message || 'Error');
  }
});

// Sirve el frontend (build) en producción desde el mismo servidor
try {
  const buildPath = path.resolve(__dirname, '..', 'build');
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    // Fallback para rutas del SPA (excluye endpoints de API)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/usuarios') || req.path.startsWith('/login')) return next();
      return res.sendFile(path.join(buildPath, 'index.html'));
    });
  }
} catch (_) { /* noop */ }

app.listen(PORT, () => {
  console.log(`Users server running on http://localhost:${PORT}`);
});
