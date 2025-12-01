import express from "express";
import cors from "cors";
import db from "./database.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { auth, adminOnly } from "./auth.js";

const app = express();
app.use(cors());
app.use(express.json());

// LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      "SEGREDO_SUPER_SEGURO",
      { expiresIn: "8h" }
    );

    res.json({ token, role: user.role });
  });
});

// =================== PALLETES ===================

// listar paletes (todos podem)
app.get("/pallets", auth, (req, res) => {
  db.all("SELECT * FROM pallets", [], (err, rows) => {
    res.json(rows.map(r => ({
      id: r.id,
      number: r.number,
      color: r.color,
      products: JSON.parse(r.products)
    })));
  });
});

// criar palete (admin only)
app.post("/pallets", auth, adminOnly, (req, res) => {
  const { number, color, products } = req.body;
  db.run(
    "INSERT INTO pallets (number, color, products) VALUES (?, ?, ?)",
    [number, color, JSON.stringify(products)],
    function () {
      res.json({ id: this.lastID });
    }
  );
});

// editar palete
app.put("/pallets/:id", auth, adminOnly, (req, res) => {
  const { number, color, products } = req.body;
  db.run(
    "UPDATE pallets SET number=?, color=?, products=? WHERE id=?",
    [number, color, JSON.stringify(products), req.params.id],
    () => res.json({ ok: true })
  );
});

// deletar palete
app.delete("/pallets/:id", auth, adminOnly, (req, res) => {
  db.run("DELETE FROM pallets WHERE id=?", [req.params.id], () => {
    res.json({ ok: true });
  });
});

// SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
