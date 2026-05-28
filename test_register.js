require('dotenv').config();
const { validateCpf, formatCpf } = require('./src/backend/utils/cpf');
const db = require('./src/backend/config/db');
const bcrypt = require('bcrypt');

async function test() {
  const req = { body: { name: 'Test User', cpf: '88280448020', phone: '11999999999', email: 'test@test.com', address: 'Test Address', password: 'password123', password_confirm: 'password123' } };
  const { name, cpf, phone, email, address, password, password_confirm } = req.body;

  if (!name || !cpf || !phone || !email || !address || !password || !password_confirm) {
    return console.log('ERROR: Missing fields');
  }
  if (password !== password_confirm) {
    return console.log('ERROR: Password mismatch');
  }
  if (password.length < 6) {
    return console.log('ERROR: Password length');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return console.log('ERROR: Email regex');
  }
  if (!validateCpf(cpf)) {
    return console.log('ERROR: Invalid CPF');
  }
  const cpfFormatted = formatCpf(cpf);

  try {
    const cpfCheck = await db.query('SELECT id FROM adopters WHERE cpf = $1', [cpfFormatted]);
    if (cpfCheck.rows.length > 0) return console.log('ERROR: Duplicate CPF');
    
    const emailCheck = await db.query('SELECT id FROM adopters WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) return console.log('ERROR: Duplicate Email');

    const passwordHash = await bcrypt.hash(password, 10);
    console.log('Would insert into db');
  } catch(e) {
    console.log('CATCH ERROR', e);
  }
  process.exit(0);
}
test();
