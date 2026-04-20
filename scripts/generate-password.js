/**
 * Script utilitário para gerar hash bcrypt da senha do admin.
 * Uso: node scripts/generate-password.js <senha>
 */
const bcrypt = require('bcrypt');

const password = process.argv[2] || 'admin123';
const SALT_ROUNDS = 10;

bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
  if (err) {
    console.error('Erro ao gerar hash:', err);
    process.exit(1);
  }
  console.log(`Senha: ${password}`);
  console.log(`Hash:  ${hash}`);
  console.log('\nCopie o hash acima e atualize o seed.sql ou a tabela users no banco.');
});
