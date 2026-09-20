/**
 * Agents HTTP dos testes de integração.
 *
 * A autenticação é por cookie de sessão e não há CSRF, então o
 * `supertest.agent` se comporta como um browser: guarda o connect.sid e
 * o reenvia nas requisições seguintes.
 */

const request = require('supertest');
const app = require('../../src/backend/app');
const { ADMIN } = require('./integration-db');

/** Visitante sem sessão autenticada (mantém cookies entre requisições). */
function anonymous() {
  return request.agent(app);
}

/** Agent autenticado como usuário da ONG. */
async function asAdmin() {
  const agent = request.agent(app);
  await agent
    .post('/login')
    .type('form')
    .send({ email: ADMIN.email, password: ADMIN.password })
    .expect(302)
    .expect('Location', '/admin/pets');
  return agent;
}

module.exports = { app, anonymous, asAdmin };
