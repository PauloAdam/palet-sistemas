import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token ausente" });

  try {
    const decoded = jwt.verify(token, "SEGREDO_SUPER_SEGURO");
    req.user = decoded;
    next();
  } catch (e) {
    res.status(403).json({ error: "Token inválido" });
  }
}

export function adminOnly(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Acesso somente admin" });
  next();
}
