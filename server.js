import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs-extra';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'nle-secret';
const DB_PATH = path.resolve('database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('.')));

async function loadDb(){
  try{
    return await fs.readJson(DB_PATH);
  }catch(err){
    if(err.code === 'ENOENT'){
      const empty = { pallets: [], users: [] };
      await fs.writeJson(DB_PATH, empty, { spaces: 2 });
      return empty;
    }
    throw err;
  }
}

async function saveDb(data){
  await fs.writeJson(DB_PATH, data, { spaces: 2 });
}

function authRequired(req, res, next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Token ausente' });
  try{
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  }catch(err){
    return res.status(403).json({ error: 'Token inválido' });
  }
}

function adminOnly(req, res, next){
  if(!req.user || req.user.role !== 'admin'){
    return res.status(403).json({ error: 'Apenas admin' });
  }
  return next();
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if(!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  const db = await loadDb();
  const user = db.users.find(u => u.username === username && u.password === password);
  if(!user) return res.status(401).json({ error: 'Credenciais inválidas' });
  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token, role: user.role });
});

app.get('/pallets', authRequired, async (req, res) => {
  const db = await loadDb();
  return res.json(db.pallets || []);
});

app.post('/pallets', authRequired, adminOnly, async (req, res) => {
  const { number, color, products } = req.body || {};
  if(!number || !Array.isArray(products)) return res.status(400).json({ error: 'Dados inválidos' });
  const db = await loadDb();
  db.pallets = db.pallets || [];
  db.pallets.push({ number, color, products });
  await saveDb(db);
  return res.status(201).json({ ok: true });
});

app.put('/pallets/:index', authRequired, adminOnly, async (req, res) => {
  const index = Number(req.params.index);
  if(!Number.isInteger(index)) return res.status(400).json({ error: 'Índice inválido' });
  const { number, color, products } = req.body || {};
  if(!number || !Array.isArray(products)) return res.status(400).json({ error: 'Dados inválidos' });
  const db = await loadDb();
  if(!db.pallets || !db.pallets[index]) return res.status(404).json({ error: 'Palete não encontrado' });
  db.pallets[index] = { number, color, products };
  await saveDb(db);
  return res.json({ ok: true });
});

app.delete('/pallets/:index', authRequired, adminOnly, async (req, res) => {
  const index = Number(req.params.index);
  if(!Number.isInteger(index)) return res.status(400).json({ error: 'Índice inválido' });
  const db = await loadDb();
  if(!db.pallets || !db.pallets[index]) return res.status(404).json({ error: 'Palete não encontrado' });
  db.pallets.splice(index, 1);
  await saveDb(db);
  return res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

function startServer(port = PORT){
  return app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

if(process.env.NODE_ENV !== 'test'){
  startServer();
}

export { app, startServer };
