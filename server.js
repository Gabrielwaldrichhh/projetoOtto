'use strict';

require('dotenv').config();

const { createApp } = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log('');
  console.log('  Controle de Portaria - MVP (dados em memoria)');
  console.log(`  Servidor: http://localhost:${PORT}`);
  console.log('');
  console.log('  Acessos de teste:');
  console.log('    admin / admin123   (ADMIN)');
  console.log('    joao  / 123456     (VIGILANTE)');
  console.log('    pedro / 123456     (VIGILANTE)');
  console.log('');
  console.log('  Atencao: os dados sao reiniciados a cada restart do servidor.');
  console.log('');
});
