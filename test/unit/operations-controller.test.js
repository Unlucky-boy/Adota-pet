const assert = require('node:assert/strict');
const { describe, test, beforeEach, afterEach } = require('node:test');

const { createRequest, createResponse, stubDb } = require('../helpers/controller-harness');
const operationsController = require('../../src/backend/controllers/operationsController');

describe('operations controller', () => {
  let stub;

  beforeEach(() => {
    stub = stubDb();
  });

  afterEach(() => {
    stub.restore();
  });

  test('rejects an expense with an invalid amount before database access', async () => {
    const req = createRequest({
      body: { category: 'Ração', description: 'Compra', amount: '0' },
      session: {},
    });
    const res = createResponse();

    await operationsController.createExpense(req, res);

    assert.equal(stub.calls.length, 0);
    assert.equal(req.session.error, 'Categoria, descrição e valor válido são obrigatórios.');
    assert.equal(res.redirectPath, '/admin/operations');
  });

  test('creates a veterinary record and its audit entry', async () => {
    stub.queueResults({ rows: [{ id: 31 }] }, { rows: [] });
    const req = createRequest({
      body: {
        pet_id: '7',
        record_type: 'Consulta',
        record_date: '2026-09-19',
        provider: 'Clínica Pet',
        description: 'Avaliação de rotina',
        cost: '120.00',
      },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await operationsController.createHealthRecord(req, res);

    const [insert] = stub.matching('INSERT INTO pet_health_records');
    assert.deepEqual(insert.params.slice(0, 5), ['7', 'Consulta', '2026-09-19', 'Clínica Pet', 'Avaliação de rotina']);
    assert.equal(stub.matching('INSERT INTO audit_logs').length, 1);
    assert.equal(req.session.success, 'Registro veterinário adicionado.');
    assert.equal(res.redirectPath, '/admin/operations');
  });

  test('requires the essential fields to schedule a volunteer shift', async () => {
    const req = createRequest({ body: { shift_date: '2026-09-20' }, session: { user: { id: 1 } } });
    const res = createResponse();

    await operationsController.createShift(req, res);

    assert.equal(stub.calls.length, 0);
    assert.equal(req.session.error, 'Data e horários do turno são obrigatórios.');
    assert.equal(res.redirectPath, '/admin/operations');
  });

  test('creates a vaccination and its audit entry', async () => {
    stub.queueResults({ rows: [{ id: 41 }] }, { rows: [] });
    const req = createRequest({
      body: {
        pet_id: '7',
        vaccine_name: 'V10',
        administered_at: '2026-09-19',
        next_due_at: '2027-09-19',
        notes: 'Dose anual',
      },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await operationsController.createVaccination(req, res);

    const [insert] = stub.matching('INSERT INTO pet_vaccinations');
    assert.deepEqual(insert.params.slice(0, 4), ['7', 'V10', '2026-09-19', '2027-09-19']);
    assert.equal(stub.matching('INSERT INTO audit_logs').length, 1);
    assert.equal(req.session.success, 'Vacinação registrada.');
  });

  test('creates an inventory item and its audit entry', async () => {
    stub.queueResults({ rows: [{ id: 51 }] }, { rows: [] });
    const req = createRequest({
      body: { name: 'Ração', category: 'alimentação', quantity: '25', unit: 'kg', minimum_quantity: '5' },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await operationsController.createInventoryItem(req, res);

    const [insert] = stub.matching('INSERT INTO inventory_items');
    assert.deepEqual(insert.params.slice(0, 5), ['Ração', 'alimentação', '25', 'kg', '5']);
    assert.equal(stub.matching('INSERT INTO audit_logs').length, 1);
    assert.equal(req.session.success, 'Item de estoque adicionado.');
  });

  test('creates a foster home and its audit entry', async () => {
    stub.queueResults({ rows: [{ id: 61 }] }, { rows: [] });
    const req = createRequest({
      body: { name: 'Lar da Ana', email: 'ana@example.com', capacity: '2' },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await operationsController.createFosterHome(req, res);

    assert.equal(stub.matching('INSERT INTO foster_homes').length, 1);
    assert.equal(stub.matching('INSERT INTO audit_logs').length, 1);
    assert.equal(req.session.success, 'Lar temporário cadastrado.');
  });

  test('rejects a foster home with an invalid phone before database access', async () => {
    const req = createRequest({
      body: { name: 'Lar da Ana', email: 'ana@example.com', phone: 'telefone', capacity: '2' },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await operationsController.createFosterHome(req, res);

    assert.equal(stub.matching('INSERT INTO foster_homes').length, 0);
    assert.equal(req.session.error, 'Telefone do lar temporário inválido.');
    assert.equal(res.redirectPath, '/admin/operations');
  });

  test('blocks a foster assignment when the home capacity is full', async () => {
    stub.queueResults({ rows: [{ capacity: 1, active_assignments: 1 }] });
    const req = createRequest({
      body: { pet_id: '7', foster_home_id: '61', start_date: '2026-09-19' },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await operationsController.createAssignment(req, res);

    assert.equal(stub.matching('INSERT INTO foster_assignments').length, 0);
    assert.equal(req.session.error, 'A capacidade deste lar temporário já foi atingida.');
    assert.equal(res.redirectPath, '/admin/operations');
  });

  test('creates a foster assignment when the home has capacity', async () => {
    stub.queueResults({ rows: [{ capacity: 2, active_assignments: 1 }] }, { rows: [{ id: 71 }] }, { rows: [] });
    const req = createRequest({
      body: { pet_id: '7', foster_home_id: '61', start_date: '2026-09-19', notes: 'Acolhimento temporário' },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await operationsController.createAssignment(req, res);

    assert.equal(stub.matching('INSERT INTO foster_assignments').length, 1);
    assert.equal(stub.matching('INSERT INTO audit_logs').length, 1);
    assert.equal(req.session.success, 'Lar temporário atribuído ao pet.');
  });

  test('creates a volunteer shift and its audit entry', async () => {
    stub.queueResults({ rows: [{ id: 81 }] }, { rows: [] });
    const req = createRequest({
      body: { volunteer_id: '4', shift_date: '2026-09-20', start_time: '08:00', end_time: '12:00' },
      session: { user: { id: 1 } },
    });
    const res = createResponse();

    await operationsController.createShift(req, res);

    assert.equal(stub.matching('INSERT INTO volunteer_shifts').length, 1);
    assert.equal(stub.matching('INSERT INTO audit_logs').length, 1);
    assert.equal(req.session.success, 'Turno agendado.');
  });

  test('loads all operation sections for the admin screen', async () => {
    stub.queueResults(
      { rows: [{ id: 7, name: 'Thor' }] },
      { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
      { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
    );
    const req = createRequest({ session: { user: { id: 1 } } });
    const res = createResponse();

    await operationsController.index(req, res);

    assert.equal(res.rendered.view, 'admin/operations');
    assert.deepEqual(res.rendered.data.pets, [{ id: 7, name: 'Thor' }]);
  });

  test('rejects invalid dates and values from operation forms', async () => {
    const cases = [
      [operationsController.createHealthRecord, { pet_id: '7', record_type: 'Consulta', description: 'x', record_date: '2026-99-99' }, 'Data ou custo do registro veterinário inválido.'],
      [operationsController.createVaccination, { pet_id: '7', vaccine_name: 'V10', administered_at: '2026-09-19', next_due_at: '2026-01-01' }, 'A próxima dose deve ter uma data válida posterior à aplicação.'],
      [operationsController.createInventoryItem, { name: 'Ração', category: 'alimentação', unit: 'kg', quantity: '-1', minimum_quantity: '0' }, 'Quantidade ou estoque mínimo inválido.'],
      [operationsController.createFosterHome, { name: 'Lar', email: 'invalido', capacity: '1' }, 'E-mail do lar temporário inválido.'],
      [operationsController.createShift, { shift_date: '2026-09-20', start_time: '12:00', end_time: '10:00' }, 'O horário final deve ser posterior ao horário inicial.'],
    ];

    for (const [handler, body, message] of cases) {
      stub.restore();
      stub = stubDb();
      const req = createRequest({ body, session: { user: { id: 1 } } });
      const res = createResponse();

      await handler(req, res);

      assert.equal(stub.calls.length, 0);
      assert.equal(req.session.error, message);
      assert.equal(res.redirectPath, '/admin/operations');
    }
  });
});
