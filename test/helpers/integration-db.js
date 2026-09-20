/**
 * Infraestrutura dos testes de integração: conexão, reset e fixtures.
 *
 * As suítes só rodam quando DB_NAME termina em "_test" (ver `skip` abaixo).
 * Isso resolve dois problemas de uma vez: pular com mensagem clara quando o
 * banco de teste não está configurado, e tornar impossível um TRUNCATE
 * acertar o banco de desenvolvimento.
 */

const bcrypt = require('bcrypt');
const db = require('../../src/backend/config/db');

const enabled = (process.env.DB_NAME || '').endsWith('_test');

const skip = enabled
  ? false
  : 'banco de integração não configurado — rode: npm run db:test:up && npm run test:integration';

/**
 * Tabelas limpas entre os testes.
 *
 * `users` e `settings` ficam de fora de propósito: o agent do supertest
 * loga uma vez por arquivo, e truncar `users` com RESTART IDENTITY
 * invalidaria o id da sessão, quebrando as FKs changed_by/user_id.
 */
const MUTABLE_TABLES = [
  'audit_logs',
  'adoption_deliveries',
  'adoption_checklists',
  'adoption_status_history',
  'visits',
  'adoptions',
  'donations',
  'adopters',
  'foster_assignments',
  'foster_homes',
  'volunteer_shifts',
  'volunteers',
  'pet_vaccinations',
  'pet_health_records',
  'expenses',
  'inventory_items',
  'pets',
];

const ADMIN = { name: 'Admin Teste', email: 'admin@teste.com', password: 'admin123' };

/** Cria o usuário admin e as settings usados pelos testes. */
async function seedBaseline() {
  const hash = await bcrypt.hash(ADMIN.password, 10);
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [ADMIN.name, ADMIN.email, hash],
  );
  await db.query(
    `INSERT INTO settings (key, value) VALUES ('pix_key', $1), ('project_email', $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ['pix@lovepatinhas.org', 'contato@lovepatinhas.org'],
  );
  return result.rows[0].id;
}

async function resetDatabase() {
  await db.query(`TRUNCATE TABLE ${MUTABLE_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

async function close() {
  await db.pool.end();
}

let petCounter = 0;

/**
 * Insere um pet. O nome é sempre distinto porque existe o índice único
 * uq_pets_seed_identity sobre (name, species, breed, age, size, gender).
 */
async function insertPet(overrides = {}) {
  petCounter += 1;
  const pet = {
    name: `Pet Teste ${petCounter}`,
    species: 'dog',
    breed: 'Vira-lata',
    age_months: 24,
    size: 'medium',
    gender: 'male',
    status: 'available',
    ...overrides,
  };
  const result = await db.query(
    `INSERT INTO pets (name, species, breed, age_months, size, gender, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'Pet de teste', $7) RETURNING id`,
    [pet.name, pet.species, pet.breed, pet.age_months, pet.size, pet.gender, pet.status],
  );
  return result.rows[0].id;
}

/** Insere uma solicitação de adoção para o pet informado. */
async function insertAdoption(petId, overrides = {}) {
  const adoption = {
    adopter_name: 'Ana Silva',
    adopter_email: 'ana@example.com',
    adopter_phone: '11999999999',
    adopter_address: 'Rua A, 10',
    message: 'Quero oferecer um lar.',
    status: 'pending',
    ...overrides,
  };
  const result = await db.query(
    `INSERT INTO adoptions (pet_id, adopter_name, adopter_email, adopter_phone, adopter_address, message, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      petId,
      adoption.adopter_name,
      adoption.adopter_email,
      adoption.adopter_phone,
      adoption.adopter_address,
      adoption.message,
      adoption.status,
    ],
  );
  return result.rows[0].id;
}

/** Insere uma doação já registrada. */
async function insertDonation(overrides = {}) {
  const donation = {
    amount: '50.00',
    payment_method: 'pix',
    donor_name: 'João Souza',
    donor_email: 'joao@example.com',
    status: 'pending_payment',
    receipt_code: 'TEST-0001',
    receipt_image: null,
    receipt_image_mime_type: null,
    ...overrides,
  };
  const result = await db.query(
    `INSERT INTO donations (amount, payment_method, donor_name, donor_email, status, receipt_code, receipt_image, receipt_image_mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      donation.amount,
      donation.payment_method,
      donation.donor_name,
      donation.donor_email,
      donation.status,
      donation.receipt_code,
      donation.receipt_image,
      donation.receipt_image_mime_type,
    ],
  );
  return result.rows[0].id;
}

/** Atalho para consultas de verificação dentro dos testes. */
async function rowsOf(text, params) {
  const result = await db.query(text, params);
  return result.rows;
}

module.exports = {
  enabled,
  skip,
  db,
  ADMIN,
  seedBaseline,
  resetDatabase,
  close,
  insertPet,
  insertAdoption,
  insertDonation,
  rowsOf,
};
