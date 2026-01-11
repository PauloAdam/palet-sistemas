import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs-extra';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'paletes-secret';
const DB_PATH = path.resolve('database.json');

app.use(cors());
app.use(express.json());

async function readDb() {
  const exists = await fs.pathExists(DB_PATH);
  if (!exists) {
    const seed = { pallets: [], users: [] };
    await fs.writeJSON(DB_PATH, seed, { spaces: 2 });
    return seed;
  }
  return fs.readJSON(DB_PATH);
}

async function writeDb(data) {
  await fs.writeJSON(DB_PATH, data, { spaces: 2 });
}

function createToken(user) {
  return jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas admin' });
  }
  return next();
}

app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Credenciais obrigatórias' });
  const db = await readDb();
  const user = (db.users || []).find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  const token = createToken(user);
  return res.json({ token, role: user.role });
});

app.get('/pallets', auth, async (_req, res) => {
  const db = await readDb();
  res.json(db.pallets || []);
});

app.post('/pallets', auth, async (req, res) => {
  const { number, color, products } = req.body || {};
  if (!number || !Array.isArray(products)) {
    return res.status(400).json({ error: 'Número e produtos são obrigatórios' });
  }
  const db = await readDb();
  db.pallets = db.pallets || [];
  db.pallets.push({ number, color, products });
  await writeDb(db);
  res.status(201).json({ ok: true });
});

app.put('/pallets/:index', auth, async (req, res) => {
  const idx = Number(req.params.index);
  if (Number.isNaN(idx)) return res.status(400).json({ error: 'Índice inválido' });
  const { number, color, products } = req.body || {};
  if (!number || !Array.isArray(products)) {
    return res.status(400).json({ error: 'Número e produtos são obrigatórios' });
  }
  const db = await readDb();
  db.pallets = db.pallets || [];
  if (!db.pallets[idx]) return res.status(404).json({ error: 'Palete não encontrado' });
  db.pallets[idx] = { number, color, products };
  await writeDb(db);
  res.json({ ok: true });
});

app.delete('/pallets/:index', auth, requireAdmin, async (req, res) => {
  const idx = Number(req.params.index);
  if (Number.isNaN(idx)) return res.status(400).json({ error: 'Índice inválido' });
  const db = await readDb();
  db.pallets = db.pallets || [];
  if (!db.pallets[idx]) return res.status(404).json({ error: 'Palete não encontrado' });
  db.pallets.splice(idx, 1);
  await writeDb(db);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
