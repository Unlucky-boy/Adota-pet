const assert = require('node:assert/strict');
const { describe, test, before, beforeEach, after } = require('node:test');

const integrationDb = require('../helpers/integration-db');
const { anonymous, asAdmin } = require('../helpers/integration-agent');

const {
  skip, seedBaseline, resetDatabase, close, insertPet, insertAdoption, rowsOf,
} = integrationDb;

describe('adoption flow', { skip }, () => {
  let adminAgent;

  before(async () => {
    await resetDatabase();
    await seedBaseline();
    adminAgent = await asAdmin();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  after(async () => {
    await close();
  });

  test('stores a pending adoption request with its status history', async () => {
    const petId = await insertPet();

    const response = await anonymous()
      .post('/adoptions')
      .type('form')
      .send({
        pet_id: String(petId),
        adopter_name: 'Ana Silva',
        adopter_email: 'ana@example.com',
        adopter_phone: '11999999999',
        adopter_address: 'Rua A, 10',
        message: 'Quero oferecer um lar.',
      })
      .expect(302);

    assert.equal(response.headers.location, '/adoptions/success');

    const adoptions = await rowsOf('SELECT pet_id, adopter_name, status FROM adoptions');
    assert.equal(adoptions.length, 1);
    assert.equal(adoptions[0].pet_id, petId);
    assert.equal(adoptions[0].status, 'pending');

    const history = await rowsOf('SELECT new_status FROM adoption_status_history');
    assert.deepEqual(history, [{ new_status: 'pending' }]);
  });

  test('does not store a request for a reserved pet', async () => {
    const petId = await insertPet({ status: 'reserved' });

    const response = await anonymous()
      .post('/adoptions')
      .type('form')
      .send({ pet_id: String(petId), adopter_name: 'Ana Silva', adopter_email: 'ana@example.com' })
      .expect(302);

    assert.equal(response.headers.location, '/pets');
    const adoptions = await rowsOf('SELECT id FROM adoptions');
    assert.equal(adoptions.length, 0);
  });

  test('approving an adoption reserves the pet and auto rejects the competing requests', async () => {
    const petId = await insertPet();
    const approvedId = await insertAdoption(petId, { adopter_name: 'Ana Silva' });
    const losingIds = [
      await insertAdoption(petId, { adopter_name: 'Bruno Lima' }),
      await insertAdoption(petId, { adopter_name: 'Carla Souza' }),
    ];

    await adminAgent
      .post(`/admin/adoptions/${approvedId}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);

    const adoptions = await rowsOf('SELECT id, status FROM adoptions ORDER BY id');
    const byId = Object.fromEntries(adoptions.map((row) => [row.id, row.status]));
    assert.equal(byId[approvedId], 'approved');
    assert.equal(byId[losingIds[0]], 'rejected');
    assert.equal(byId[losingIds[1]], 'rejected');

    const [pet] = await rowsOf('SELECT status FROM pets WHERE id = $1', [petId]);
    assert.equal(pet.status, 'reserved');

    const autoRejected = await rowsOf(
      "SELECT adoption_id FROM adoption_status_history WHERE note = 'Outra solicitação foi aprovada para este pet' ORDER BY adoption_id",
    );
    assert.deepEqual(autoRejected.map((row) => row.adoption_id).sort(), [...losingIds].sort());
  });

  test('refuses to approve a second adoption for an already approved pet', async () => {
    const petId = await insertPet();
    const firstId = await insertAdoption(petId);
    const secondId = await insertAdoption(petId, { adopter_name: 'Bruno Lima' });

    await adminAgent
      .post(`/admin/adoptions/${firstId}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);

    // A primeira aprovação já rejeitou a concorrente; aprová-la agora deve falhar.
    await adminAgent
      .post(`/admin/adoptions/${secondId}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);

    const [second] = await rowsOf('SELECT status FROM adoptions WHERE id = $1', [secondId]);
    assert.equal(second.status, 'rejected');
    const [pet] = await rowsOf('SELECT status FROM pets WHERE id = $1', [petId]);
    assert.equal(pet.status, 'reserved');
  });

  test('rejecting an approved adoption returns the pet to the available pool', async () => {
    const petId = await insertPet();
    const adoptionId = await insertAdoption(petId);

    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);
    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/status`)
      .type('form')
      .send({ status: 'rejected' })
      .expect(302);

    const [pet] = await rowsOf('SELECT status FROM pets WHERE id = $1', [petId]);
    assert.equal(pet.status, 'available');

    const history = await rowsOf(
      'SELECT old_status, new_status FROM adoption_status_history WHERE adoption_id = $1 ORDER BY id',
      [adoptionId],
    );
    assert.deepEqual(history.at(-1), { old_status: 'approved', new_status: 'rejected' });
  });

  test('records an audit entry for every adoption status change', async () => {
    const petId = await insertPet();
    const adoptionId = await insertAdoption(petId);

    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/status`)
      .type('form')
      .send({ status: 'under_review' })
      .expect(302);

    const logs = await rowsOf(
      "SELECT action, entity_type, entity_id, metadata FROM audit_logs WHERE action = 'adoption_status_changed'",
    );
    assert.equal(logs.length, 1);
    assert.equal(logs[0].entity_type, 'adoption');
    assert.equal(logs[0].entity_id, adoptionId);
    assert.deepEqual(logs[0].metadata, { oldStatus: 'pending', newStatus: 'under_review' });
  });

  test('confirming the delivery completes the adoption and marks the pet adopted', async () => {
    const petId = await insertPet();
    const adoptionId = await insertAdoption(petId);
    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);

    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/delivery`)
      .type('form')
      .send({ signed_by: 'Ana Silva', document_reference: 'RG 12345', notes: 'Entrega na ONG' })
      .expect(302);

    const deliveries = await rowsOf('SELECT adoption_id, signed_by, document_reference FROM adoption_deliveries');
    assert.deepEqual(deliveries, [
      { adoption_id: adoptionId, signed_by: 'Ana Silva', document_reference: 'RG 12345' },
    ]);
    const [adoption] = await rowsOf('SELECT status FROM adoptions WHERE id = $1', [adoptionId]);
    assert.equal(adoption.status, 'completed');
    const [pet] = await rowsOf('SELECT status FROM pets WHERE id = $1', [petId]);
    assert.equal(pet.status, 'adopted');
  });

  test('refuses a second delivery confirmation for the same adoption', async () => {
    const petId = await insertPet();
    const adoptionId = await insertAdoption(petId);
    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);
    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/delivery`)
      .type('form')
      .send({ signed_by: 'Ana Silva' })
      .expect(302);

    // A adoção já está "completed", então a guarda barra antes da unique
    // constraint de adoption_deliveries.adoption_id.
    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/delivery`)
      .type('form')
      .send({ signed_by: 'Outra Pessoa' })
      .expect(302);

    const deliveries = await rowsOf('SELECT signed_by FROM adoption_deliveries');
    assert.deepEqual(deliveries, [{ signed_by: 'Ana Silva' }]);
  });

  test('updating the same checklist item twice keeps a single row', async () => {
    const petId = await insertPet();
    const adoptionId = await insertAdoption(petId);

    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/checklist`)
      .type('form')
      .send({ item_key: 'documents', completed: 'on', note: 'Primeira revisão' })
      .expect(302);
    await adminAgent
      .post(`/admin/adoptions/${adoptionId}/checklist`)
      .type('form')
      .send({ item_key: 'documents', note: 'Documento pendente' })
      .expect(302);

    const checklist = await rowsOf(
      'SELECT item_key, completed, note FROM adoption_checklists WHERE adoption_id = $1',
      [adoptionId],
    );
    assert.deepEqual(checklist, [
      { item_key: 'documents', completed: false, note: 'Documento pendente' },
    ]);
  });

  test('blocks an anonymous request from changing an adoption status', async () => {
    const petId = await insertPet();
    const adoptionId = await insertAdoption(petId);

    const response = await anonymous()
      .post(`/admin/adoptions/${adoptionId}/status`)
      .type('form')
      .send({ status: 'approved' })
      .expect(302);

    assert.equal(response.headers.location, '/login');
    const [adoption] = await rowsOf('SELECT status FROM adoptions WHERE id = $1', [adoptionId]);
    assert.equal(adoption.status, 'pending');
  });

  test('lists the adoptions with their pet names for an authenticated user', async () => {
    const petId = await insertPet({ name: 'Thor Integração' });
    await insertAdoption(petId);

    const response = await adminAgent.get('/admin/adoptions').expect(200);

    assert.match(response.text, /Thor Integração/);
  });
});
