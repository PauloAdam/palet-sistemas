import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import fs from "fs-extra";

const app = express();
const PORT = process.env.PORT || 10000;
const SECRET = process.env.JWT_SECRET || "segredo123";

// Caminho do "banco"
const DB_FILE = "./database.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeJSONSync(DB_FILE, {
    pallets: [],
    users: [
      { username: "admin", password: "admin123", role: "admin" },
      { username: "func", password: "func123", role: "funcionario" }
    ]
  });
}

app.use(cors());
app.use(express.json());

const loadDB = () => fs.readJSONSync(DB_FILE);
const saveDB = (db) => fs.writeJSONSync(DB_FILE, db, { spaces: 2 });

// ------------------------------ LOGIN ----------------------------------
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const db = loadDB();
  const user = db.users.find(
    u => u.username === username && u.password === password
  );

  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

  const token = jwt.sign(
    { username: user.username, role: user.role },
    SECRET,
    { expiresIn: "12h" }
  );

  res.json({ token, role: user.role });
});

// ------------------------------ AUTH MIDDLEWARE ------------------------
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token ausente" });

  const token = header.split(" ")[1];

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user;
    next();
  });
}

// ------------------------------ PALETES --------------------------------
app.get("/pallets", auth, (req, res) => {
  res.json(loadDB().pallets);
});

app.post("/pallets", auth, (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Somente admin" });

  const db = loadDB();
  db.pallets.push(req.body);
  saveDB(db);

  res.json({ ok: true });
});

app.put("/pallets/:id", auth, (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Somente admin" });

  const db = loadDB();
  db.pallets[req.params.id] = req.body;
  saveDB(db);

  res.json({ ok: true });
});

app.delete("/pallets/:id", auth, (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Somente admin" });

  const db = loadDB();
  db.pallets.splice(req.params.id, 1);
  saveDB(db);

  res.json({ ok: true });
});

app.listen(PORT, () =>
  console.log("Servidor rodando na porta " + PORT)
);
