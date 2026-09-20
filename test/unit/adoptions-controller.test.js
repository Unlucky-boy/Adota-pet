const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const { createRequest, createResponse, stubDb } = require('../helpers/controller-harness');
const adoptionsController = require('../../src/backend/controllers/adoptionsController');

describe('adoptions controller', () => {
  let stub;

  beforeEach(() => {
    stub = stubDb();
  });

  afterEach(() => {
    stub.restore();
  });

  test('creates an adoption request for an available pet', async () => {
    stub.queueResults(
      { rows: [{ id: 7, status: 'available' }] },
      { rows: [{ id: 21 }] },
      { rows: [] },
    );
    const req = createRequest({
      body: {
        pet_id: '7',
        adopter_name: 'Ana Silva',
        adopter_email: 'ana@example.com',
        adopter_phone: '11999999999',
        adopter_address: 'Rua A, 10',
        message: 'Quero oferecer um lar.',
      },
      session: {},
    });
    const res = createResponse();

    await adoptionsController.create(req, res);

    const [insert] = stub.matching('INSERT INTO adoptions');
    assert.deepEqual(insert.params, [
      '7',
      'Ana Silva',
      'ana@example.com',
      '11999999999',
      'Rua A, 10',
      'Quero oferecer um lar.',
    ]);
    const [history] = stub.matching('INSERT INTO adoption_status_history');
    assert.deepEqual(history.params, [21]);
    assert.equal(req.session.success, 'Solicitação de adoção enviada com sucesso! Entraremos em contato.');
    assert.equal(res.redirectPath, '/adoptions/success');
  });

  test('rejects an adoption request when the pet is unavailable', async () => {
    stub.queueResults({ rows: [] });
    const req = createRequest({
      body: { pet_id: '8', adopter_name: 'Ana Silva', adopter_email: 'ana@example.com' },
      session: {},
    });
    const res = createResponse();

    await adoptionsController.create(req, res);

    assert.equal(stub.matching('INSERT INTO adoptions').length, 0);
    assert.equal(req.session.error, 'Este pet não está mais disponível para adoção.');
    assert.equal(res.redirectPath, '/pets');
  });

  test('approving an adoption reserves the related pet', async () => {
    stub.queueResults(
      { rows: [{ id: 12, pet_id: 7, adoption_status: 'pending', pet_status: 'available' }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    );
    const req = createRequest({
      body: { status: 'approved' },
      params: { id: '12' },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await adoptionsController.updateStatus(req, res);

    const [update] = stub.matching('UPDATE adoptions SET status = $1');
    assert.deepEqual(update.params, ['approved', 12]);
    const [reserve] = stub.matching("UPDATE pets SET status = 'reserved'");
    assert.deepEqual(reserve.params, [7]);
    assert.equal(req.session.success, 'Solicitação aprovada!');
    assert.equal(res.redirectPath, '/admin/adoptions');
  });

  test('does not approve an adoption for a reserved pet', async () => {
    stub.queueResults({
      rows: [{ id: 13, pet_id: 7, adoption_status: 'pending', pet_status: 'reserved' }],
    });
    const req = createRequest({
      body: { status: 'approved' },
      params: { id: '13' },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await adoptionsController.updateStatus(req, res);

    assert.equal(stub.matching('UPDATE adoptions').length, 0);
    assert.equal(stub.matching('UPDATE pets').length, 0);
    assert.equal(req.session.error, 'Este pet não está disponível para aprovação.');
    assert.equal(res.redirectPath, '/admin/adoptions');
  });
});
