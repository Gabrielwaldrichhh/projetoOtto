'use strict';

const path = require('path');
const express = require('express');

const store = require('./data/store');
const { errorHandler } = require('./middleware/errorHandler');

function createApp({ withSeed = true } = {}) {
  if (withSeed && store.all('users').length === 0) store.seed();

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/vehicles', require('./routes/vehicles'));
  app.use('/api/drivers', require('./routes/drivers'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/movements', require('./routes/movements'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/audit', require('./routes/audit'));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota nao encontrada.' }));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
