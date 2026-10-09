'use strict';

const store = require('../data/store');

function log({ userId, action, entity, entityId, description }) {
  return store.insert('auditLogs', {
    user_id: userId || null,
    action,
    entity,
    entity_id: entityId || null,
    description: description || '',
  });
}

function list() {
  const users = store.all('users');
  return store
    .all('auditLogs')
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((row) => ({
      ...row,
      user_name: (users.find((u) => u.id === row.user_id) || {}).name || 'Sistema',
    }));
}

module.exports = { log, list };
