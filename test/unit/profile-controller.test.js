const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const { createRequest, createResponse, stubDb } = require('../helpers/controller-harness');
const dashboardController = require('../../src/backend/controllers/dashboardController');
const isAdopterAuthenticated = require('../../src/backend/middlewares/isAdopterAuthenticated');

describe('adopter profile', () => {
  let stub;

  beforeEach(() => {
    stub = stubDb();
  });

  afterEach(() => {
    stub.restore();
  });

  test('redirects a visitor without an adopter session to login', () => {
    const req = createRequest({ session: {} });
    const res = createResponse();
    let continued = false;

    isAdopterAuthenticated(req, res, () => { continued = true; });

    assert.equal(continued, false);
    assert.equal(res.redirectPath, '/login');
    assert.match(req.session.error, /logado como adotante/);
  });

  test('renders only histories selected with the logged adopter identity', async () => {
    const adopter = {
      id: 8,
      name: 'Ana Silva',
      email: 'ana@example.com',
      phone: '11999999999',
      address: 'Rua A, 10',
    };
    stub.queueResults(
      { rows: [adopter] },
      { rows: [{ id: 1, amount: '40.00', status: 'completed' }, { id: 2, amount: '10.00', status: 'pending_review' }] },
      { rows: [{ id: 3, status: 'approved', availability: 'Sábados' }] },
      { rows: [{ id: 4, status: 'pending', pet_name: 'Luna' }] },
    );
    const req = createRequest({ session: { adopter: { id: 8, email: 'ana@example.com' } } });
    const res = createResponse();

    await dashboardController.index(req, res);

    assert.equal(res.rendered.view, 'dashboard/index');
    assert.equal(res.rendered.data.adopter, adopter);
    assert.equal(res.rendered.data.totalDonated, 40);
    assert.equal(res.rendered.data.userAdoptions[0].pet_name, 'Luna');

    const historyCalls = stub.calls.filter((call) => call.text.includes('adopter_id = $1'));
    assert.equal(historyCalls.length, 3);
    historyCalls.forEach((call) => assert.deepEqual(call.params, [8, 'ana@example.com']));
  });
});
