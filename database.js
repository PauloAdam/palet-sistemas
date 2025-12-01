import sqlite from "sqlite3";
sqlite.verbose();

const db = new sqlite.Database("./database.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT,
      color TEXT,
      products TEXT
    );
  `);

  // cria admin padrão (senha: admin123)
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const bcrypt = require("bcryptjs");
      const hash = bcrypt.hashSync("admin123", 10);
      db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        ["admin", hash, "admin"]);
      console.log("Usuário admin criado: admin / admin123");
    }
  });
});

export default db;
