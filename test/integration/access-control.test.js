const assert = require('node:assert/strict');
const { describe, test, before, after } = require('node:test');

const bcrypt = require('bcrypt');

const integrationDb = require('../helpers/integration-db');
const { anonymous, asAdmin } = require('../helpers/integration-agent');

const {
  skip, db, ADMIN, seedBaseline, resetDatabase, close, insertPet, insertAdoption, insertDonation,
} = integrationDb;

const ADOPTER = { name: 'Ana Silva', email: 'ana@example.com', password: 'adotante123' };

describe('access control', { skip }, () => {
  before(async () => {
    await resetDatabase();
    await seedBaseline();
    const hash = await bcrypt.hash(ADOPTER.password, 10);
    await db.query(
      `INSERT INTO adopters (name, cpf, phone, email, address, password_hash)
       VALUES ($1, '529.982.247-25', '11999999999', $2, 'Rua A, 10', $3)`,
      [ADOPTER.name, ADOPTER.email, hash],
    );
  });

  after(async () => {
    await close();
  });

  test('rejects a login with an unknown email', async () => {
    const response = await anonymous()
      .post('/login')
      .type('form')
      .send({ email: 'ninguem@example.com', password: 'seja-o-que-for' })
      .expect(302);

    assert.equal(response.headers.location, '/login');
  });

  test('rejects a login with a wrong password', async () => {
    const response = await anonymous()
      .post('/login')
      .type('form')
      .send({ email: ADMIN.email, password: 'senha-errada' })
      .expect(302);

    assert.equal(response.headers.location, '/login');
  });

  test('logs an ong user in and redirects to the pet dashboard', async () => {
    const response = await anonymous()
      .post('/login')
      .type('form')
      .send({ email: ADMIN.email, password: ADMIN.password })
      .expect(302);

    assert.equal(response.headers.location, '/admin/pets');
  });

  test('logs an adopter in and redirects to the dashboard', async () => {
    const response = await anonymous()
      .post('/login')
      .type('form')
      .send({ email: ADOPTER.email, password: ADOPTER.password })
      .expect(302);

    assert.equal(response.headers.location, '/dashboard');
  });

  test('redirects an anonymous visitor away from the admin adoption routes', async () => {
    const petId = await insertPet();
    const adoptionId = await insertAdoption(petId);
    const visitor = anonymous();

    const routes = [
      ['get', '/admin/adoptions'],
      ['get', `/admin/adoptions/${adoptionId}`],
      ['post', `/admin/adoptions/${adoptionId}/status`],
      ['post', `/admin/adoptions/${adoptionId}/checklist`],
      ['post', `/admin/adoptions/${adoptionId}/delivery`],
    ];

    for (const [method, path] of routes) {
      const response = await visitor[method](path).expect(302);
      assert.equal(response.headers.location, '/login', `${method.toUpperCase()} ${path}`);
    }
  });

  test('redirects an anonymous visitor away from the admin donation routes', async () => {
    const donationId = await insertDonation({ receipt_code: 'GUARD-0001' });
    const visitor = anonymous();

    const routes = [
      ['get', '/admin/donations'],
      ['post', `/admin/donations/${donationId}/status`],
    ];

    for (const [method, path] of routes) {
      const response = await visitor[method](path).expect(302);
      assert.equal(response.headers.location, '/login', `${method.toUpperCase()} ${path}`);
    }
  });

  test('clears the session on logout', async () => {
    const agent = await asAdmin();
    await agent.get('/admin/adoptions').expect(200);

    await agent.get('/logout').expect(302);

    const response = await agent.get('/admin/adoptions').expect(302);
    assert.equal(response.headers.location, '/login');
  });
});
