'use strict';

const jwt = require('jsonwebtoken');
const store = require('../data/store');

const SECRET = process.env.JWT_SECRET || 'dev-secret-nao-use-em-producao';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: EXPIRES_IN });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Nao autenticado.' });

  try {
    const payload = jwt.verify(token, SECRET);
    const user = store.find('users', payload.sub);
    if (!user || !user.active) return res.status(401).json({ error: 'Usuario inativo ou inexistente.' });
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  return next();
}

module.exports = { sign, authenticate, requireAdmin, SECRET };
