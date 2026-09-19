const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const db = require('../src/backend/config/db');
const adoptionsController = require('../src/backend/controllers/adoptionsController');
const donationsController = require('../src/backend/controllers/donationsController');
const operationsController = require('../src/backend/controllers/operationsController');

function createResponse() {
  return {
    redirectPath: null,
    rendered: null,
    statusCode: 200,
    body: null,
    redirect(path) {
      this.redirectPath = path;
    },
    render(view, data) {
      this.rendered = { view, data };
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
    },
    set() {},
  };
}

function mockQueries(...responses) {
  const calls = [];
  db.query = async (text, params) => {
    calls.push({ text, params });
    return responses.shift() || { rows: [] };
  };
  return calls;
}

function mockTransaction(...responses) {
  const calls = [];
  db.transaction = async (callback) => callback({
    query: async (text, params) => {
      calls.push({ text, params });
      return responses.shift() || { rows: [] };
    },
  });
  return calls;
}

beforeEach(() => {
  db.query = async () => ({ rows: [] });
  db.transaction = async () => ({ rows: [] });
});

test('creates an adoption request for an available pet', async () => {
  const calls = mockQueries(
    { rows: [{ id: 7, status: 'available' }] },
    { rows: [{ id: 21 }] },
    { rows: [] },
  );
  const req = {
    body: {
      pet_id: '7',
      adopter_name: 'Ana Silva',
      adopter_email: 'ana@example.com',
      adopter_phone: '11999999999',
      adopter_address: 'Rua A, 10',
      message: 'Quero oferecer um lar.',
    },
    session: {},
  };
  const res = createResponse();

  await adoptionsController.create(req, res);

  assert.equal(calls.length, 3);
  assert.match(calls[0].text, /status = 'available'/);
  assert.deepEqual(calls[1].params, [
    '7',
    'Ana Silva',
    'ana@example.com',
    '11999999999',
    'Rua A, 10',
    'Quero oferecer um lar.',
  ]);
  assert.equal(req.session.success, 'Solicitação de adoção enviada com sucesso! Entraremos em contato.');
  assert.equal(res.redirectPath, '/adoptions/success');
});

test('rejects an adoption request when the pet is unavailable', async () => {
  const calls = mockQueries({ rows: [] });
  const req = {
    body: { pet_id: '8', adopter_name: 'Ana Silva', adopter_email: 'ana@example.com' },
    session: {},
  };
  const res = createResponse();

  await adoptionsController.create(req, res);

  assert.equal(calls.length, 1);
  assert.equal(req.session.error, 'Este pet não está mais disponível para adoção.');
  assert.equal(res.redirectPath, '/pets');
});

test('approving an adoption reserves the related pet', async () => {
  const calls = mockTransaction(
    { rows: [{ id: 12, pet_id: 7, adoption_status: 'pending', pet_status: 'available' }] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
  );
  const req = { body: { status: 'approved' }, params: { id: '12' }, session: { user: { id: 1 } } };
  const res = createResponse();

  await adoptionsController.updateStatus(req, res);

  assert.match(calls[0].text, /FOR UPDATE OF a, p/);
  assert.deepEqual(calls[1].params, [7, 12]);
  assert.match(calls[2].text, /UPDATE adoptions SET status = \$1/);
  assert.match(calls[3].text, /UPDATE pets SET status = 'reserved'/);
  assert.deepEqual(calls[3].params, [7]);
  assert.equal(req.session.success, 'Solicitação aprovada!');
  assert.equal(res.redirectPath, '/admin/adoptions');
});

test('does not approve an adoption for a reserved pet', async () => {
  const calls = mockTransaction({
    rows: [{ id: 13, pet_id: 7, adoption_status: 'pending', pet_status: 'reserved' }],
  });
  const req = { body: { status: 'approved' }, params: { id: '13' }, session: {} };
  const res = createResponse();

  await adoptionsController.updateStatus(req, res);

  assert.equal(calls.length, 1);
  assert.equal(req.session.error, 'Este pet não está disponível para aprovação.');
  assert.equal(res.redirectPath, '/admin/adoptions');
});

test('rejects invalid donation amounts before touching the database', async () => {
  const calls = mockQueries();
  const req = {
    body: { amount: '0', payment_method: 'pix' },
    session: {},
  };
  const res = createResponse();

  await donationsController.donate(req, res);

  assert.equal(calls.length, 0);
  assert.equal(req.session.error, 'Informe um valor válido para a doação.');
  assert.equal(res.redirectPath, '/donate');
  assert.deepEqual(req.session.formData, {
    amount: '0',
    payment_method: 'pix',
    donor_name: undefined,
    donor_email: undefined,
  });
});

test('records a PIX donation with a receipt for review', async () => {
  const calls = mockQueries({ rows: [] });
  const req = {
    body: {
      amount: '125.5',
      payment_method: 'pix',
      donor_name: ' João Souza ',
      donor_email: 'JOAO@EXAMPLE.COM',
    },
    file: { buffer: Buffer.from('receipt'), mimetype: 'image/png' },
    session: {},
  };
  const res = createResponse();

  await donationsController.donate(req, res);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params.slice(0, 5), [
    '125.50',
    'pix',
    'João Souza',
    'joao@example.com',
    'pending_review',
  ]);
  assert.equal(calls[0].params[6].toString(), 'receipt');
  assert.equal(calls[0].params[7], 'image/png');
  assert.match(res.redirectPath, /^\/donate\/receipt\/[A-Z0-9]+-[A-Z0-9]+$/);
  assert.equal(req.session.formData, undefined);
  assert.match(req.session.success, /comprovante/);
});

test('rejects an invalid donor email before inserting a donation', async () => {
  const calls = mockQueries();
  const req = {
    body: { amount: '50', payment_method: 'pix', donor_email: 'invalid-email' },
    session: {},
  };
  const res = createResponse();

  await donationsController.donate(req, res);

  assert.equal(calls.length, 0);
  assert.equal(req.session.error, 'E-mail do doador inválido.');
  assert.equal(res.redirectPath, '/donate');
});

test('uploads a PIX receipt and moves the donation to review', async () => {
  const calls = mockQueries({ rows: [{ id: 3 }] });
  const req = {
    params: { code: 'ABCD-123' },
    file: { buffer: Buffer.from('receipt'), mimetype: 'application/pdf' },
    session: {},
  };
  const res = createResponse();

  await donationsController.uploadReceipt(req, res);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [Buffer.from('receipt'), 'application/pdf', 'ABCD-123']);
  assert.equal(req.session.success, 'Comprovante enviado com sucesso! Aguarde a confirmação da ONG.');
  assert.equal(res.redirectPath, '/donate/receipt/ABCD-123');
});

test('rejects an expense with an invalid amount before database access', async () => {
  const calls = mockQueries();
  const req = { body: { category: 'Ração', description: 'Compra', amount: '0' }, session: {} };
  const res = createResponse();

  await operationsController.createExpense(req, res);

  assert.equal(calls.length, 0);
  assert.equal(req.session.error, 'Categoria, descrição e valor válido são obrigatórios.');
  assert.equal(res.redirectPath, '/admin/operations');
});

test('creates a veterinary record and its audit entry', async () => {
  const calls = mockQueries({ rows: [{ id: 31 }] }, { rows: [] });
  const req = {
    body: {
      pet_id: '7',
      record_type: 'Consulta',
      record_date: '2026-09-19',
      provider: 'Clínica Pet',
      description: 'Avaliação de rotina',
      cost: '120.00',
    },
    session: { user: { id: 1 } },
  };
  const res = createResponse();

  await operationsController.createHealthRecord(req, res);

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /INSERT INTO pet_health_records/);
  assert.deepEqual(calls[0].params.slice(0, 5), ['7', 'Consulta', '2026-09-19', 'Clínica Pet', 'Avaliação de rotina']);
  assert.match(calls[1].text, /INSERT INTO audit_logs/);
  assert.equal(req.session.success, 'Registro veterinário adicionado.');
  assert.equal(res.redirectPath, '/admin/operations');
});

test('requires the essential fields to schedule a volunteer shift', async () => {
  const calls = mockQueries();
  const req = { body: { shift_date: '2026-09-20' }, session: { user: { id: 1 } } };
  const res = createResponse();

  await operationsController.createShift(req, res);

  assert.equal(calls.length, 0);
  assert.equal(req.session.error, 'Data e horários do turno são obrigatórios.');
  assert.equal(res.redirectPath, '/admin/operations');
});

test('creates a vaccination and its audit entry', async () => {
  const calls = mockQueries({ rows: [{ id: 41 }] }, { rows: [] });
  const req = {
    body: { pet_id: '7', vaccine_name: 'V10', administered_at: '2026-09-19', next_due_at: '2027-09-19', notes: 'Dose anual' },
    session: { user: { id: 1 } },
  };
  const res = createResponse();

  await operationsController.createVaccination(req, res);

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /INSERT INTO pet_vaccinations/);
  assert.deepEqual(calls[0].params.slice(0, 4), ['7', 'V10', '2026-09-19', '2027-09-19']);
  assert.match(calls[1].text, /INSERT INTO audit_logs/);
  assert.equal(req.session.success, 'Vacinação registrada.');
});

test('creates an inventory item and its audit entry', async () => {
  const calls = mockQueries({ rows: [{ id: 51 }] }, { rows: [] });
  const req = {
    body: { name: 'Ração', category: 'alimentação', quantity: '25', unit: 'kg', minimum_quantity: '5' },
    session: { user: { id: 1 } },
  };
  const res = createResponse();

  await operationsController.createInventoryItem(req, res);

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /INSERT INTO inventory_items/);
  assert.deepEqual(calls[0].params.slice(0, 5), ['Ração', 'alimentação', '25', 'kg', '5']);
  assert.equal(req.session.success, 'Item de estoque adicionado.');
});

test('creates a foster home and its audit entry', async () => {
  const calls = mockQueries({ rows: [{ id: 61 }] }, { rows: [] });
  const req = {
    body: { name: 'Lar da Ana', email: 'ana@example.com', capacity: '2' },
    session: { user: { id: 1 } },
  };
  const res = createResponse();

  await operationsController.createFosterHome(req, res);

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /INSERT INTO foster_homes/);
  assert.equal(req.session.success, 'Lar temporário cadastrado.');
});

test('blocks a foster assignment when the home capacity is full', async () => {
  const calls = mockQueries({ rows: [{ capacity: 1, active_assignments: 1 }] });
  const req = {
    body: { pet_id: '7', foster_home_id: '61', start_date: '2026-09-19' },
    session: { user: { id: 1 } },
  };
  const res = createResponse();

  await operationsController.createAssignment(req, res);

  assert.equal(calls.length, 1);
  assert.equal(req.session.error, 'A capacidade deste lar temporário já foi atingida.');
  assert.equal(res.redirectPath, '/admin/operations');
});

test('creates a foster assignment when the home has capacity', async () => {
  const calls = mockQueries({ rows: [{ capacity: 2, active_assignments: 1 }] }, { rows: [{ id: 71 }] }, { rows: [] });
  const req = {
    body: { pet_id: '7', foster_home_id: '61', start_date: '2026-09-19', notes: 'Acolhimento temporário' },
    session: { user: { id: 1 } },
  };
  const res = createResponse();

  await operationsController.createAssignment(req, res);

  assert.equal(calls.length, 3);
  assert.match(calls[1].text, /INSERT INTO foster_assignments/);
  assert.match(calls[2].text, /INSERT INTO audit_logs/);
  assert.equal(req.session.success, 'Lar temporário atribuído ao pet.');
});

test('creates a volunteer shift and its audit entry', async () => {
  const calls = mockQueries({ rows: [{ id: 81 }] }, { rows: [] });
  const req = {
    body: { volunteer_id: '4', shift_date: '2026-09-20', start_time: '08:00', end_time: '12:00' },
    session: { user: { id: 1 } },
  };
  const res = createResponse();

  await operationsController.createShift(req, res);

  assert.equal(calls.length, 2);
  assert.match(calls[0].text, /INSERT INTO volunteer_shifts/);
  assert.equal(req.session.success, 'Turno agendado.');
});

test('loads all operation sections for the admin screen', async () => {
  const calls = mockQueries(
    { rows: [{ id: 7, name: 'Thor' }] },
    { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
    { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] },
  );
  const req = { session: { user: { id: 1 } } };
  const res = createResponse();

  await operationsController.index(req, res);

  assert.equal(calls.length, 10);
  assert.equal(res.rendered.view, 'admin/operations');
  assert.deepEqual(res.rendered.data.pets, [{ id: 7, name: 'Thor' }]);
});