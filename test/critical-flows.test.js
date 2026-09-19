const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');

const db = require('../src/backend/config/db');
const adoptionsController = require('../src/backend/controllers/adoptionsController');
const donationsController = require('../src/backend/controllers/donationsController');

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

beforeEach(() => {
  db.query = async () => ({ rows: [] });
});

test('creates an adoption request for an available pet', async () => {
  const calls = mockQueries(
    { rows: [{ id: 7, status: 'available' }] },
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

  assert.equal(calls.length, 2);
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
  const calls = mockQueries(
    { rows: [{ pet_id: 7 }] },
    { rows: [] },
  );
  const req = { body: { status: 'approved' }, params: { id: '12' }, session: {} };
  const res = createResponse();

  await adoptionsController.updateStatus(req, res);

  assert.deepEqual(calls[0].params, ['approved', '12']);
  assert.match(calls[1].text, /UPDATE pets SET status = 'reserved'/);
  assert.deepEqual(calls[1].params, [7]);
  assert.equal(req.session.success, 'Solicitação aprovada!');
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